import { Worker } from 'worker_threads';
import { Tokenizer } from './tokenizer';
import type {
  BM25Options,
  SearchResult,
  FieldBoosts,
  Document,
  SerializableResult,
} from './types';
import { DEFAULT_OPTIONS } from './constants';
import path from 'path';

/**
 * Implementation of the Okapi BM25 ranking algorithm with field boosting support
 */
export class BM25 {
  private readonly termFrequencySaturation: number;
  private readonly lengthNormalizationFactor: number;
  private readonly tokenizer: Tokenizer;
  private documentLengths: Uint32Array;
  private averageDocLength: number;
  private readonly termToIndex: Map<string, number>;
  private documentFrequency: Uint32Array;
  private readonly termFrequencies: Map<number, Map<number, number>>;
  private readonly fieldBoosts: FieldBoosts;
  private documents: Document[];

  /**
   * Creates a new BM25 search instance
   * @param docs - Optional array of documents to index
   * @param options - BM25 algorithm options and field boost settings
   */
  constructor(
    docs?: Document[],
    options: BM25Options & { fieldBoosts?: FieldBoosts } = {},
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.termFrequencySaturation = opts.k1;
    this.lengthNormalizationFactor = opts.b;
    this.tokenizer = new Tokenizer(opts);
    this.fieldBoosts = opts.fieldBoosts || {};

    // Initialize empty data structures
    this.documents = [];
    this.documentLengths = new Uint32Array(0);
    this.termToIndex = new Map();
    this.documentFrequency = new Uint32Array(0);
    this.averageDocLength = 0;
    this.termFrequencies = new Map();

    // Process documents if provided
    if (docs && docs.length > 0) {
      this.documents = [...docs];
      const {
        documentLengths,
        termToIndex,
        documentFrequency,
        averageDocLength,
        termFrequencies,
      } = this.processDocuments(docs);

      this.documentLengths = documentLengths;
      this.termToIndex = termToIndex;
      this.documentFrequency = documentFrequency;
      this.averageDocLength = averageDocLength;
      this.termFrequencies = termFrequencies;
    }
  }

  private processDocuments(docs: Document[]): {
    documentLengths: Uint32Array;
    termToIndex: Map<string, number>;
    documentFrequency: Uint32Array;
    averageDocLength: number;
    termFrequencies: Map<number, Map<number, number>>;
  } {
    const documentLengths = new Uint32Array(docs.length);
    const termToIndex = new Map<string, number>();
    const termDocs = new Map<string, Set<number>>();
    const termFrequencies = new Map<number, Map<number, number>>();
    let totalLength = 0;
    let nextTermIndex = 0;

    docs.forEach((doc, docIndex) => {
      let docLength = 0;
      Object.entries(doc).forEach(([field, content]) => {
        const fieldBoost = this.fieldBoosts[field] || 1;
        const { tokens } = this.tokenizer.tokenize(content);
        docLength += tokens.length * fieldBoost;

        const uniqueTerms = new Set(tokens);
        uniqueTerms.forEach((term) => {
          if (!termToIndex.has(term)) {
            termToIndex.set(term, nextTermIndex++);
          }
          const termIndex = termToIndex.get(term)!;

          if (!termDocs.has(term)) {
            termDocs.set(term, new Set());
          }
          termDocs.get(term)!.add(docIndex);

          if (!termFrequencies.has(termIndex)) {
            termFrequencies.set(termIndex, new Map());
          }
          const freq = tokens.filter((t) => t === term).length * fieldBoost; // Apply boost to term frequency
          const existingFreq =
            termFrequencies.get(termIndex)!.get(docIndex) || 0;
          termFrequencies.get(termIndex)!.set(docIndex, existingFreq + freq);
        });
      });

      documentLengths[docIndex] = docLength;
      totalLength += docLength;
    });

    const documentFrequency = new Uint32Array(termToIndex.size);
    termDocs.forEach((docs, term) => {
      const termIndex = termToIndex.get(term)!;
      documentFrequency[termIndex] = docs.size;
    });

    return {
      documentLengths,
      termToIndex,
      documentFrequency,
      averageDocLength: totalLength / docs.length,
      termFrequencies,
    };
  }

  /**
   * Adds multiple documents to the index using parallel processing
   * @param docs - Array of documents to add
   */
  public async addDocumentsParallel(docs: Document[]): Promise<void> {
    if (!docs || docs.length === 0) return;

    const numWorkers = Math.ceil(require('os').cpus().length / 2) || 2;
    const batchSize = Math.ceil(docs.length / numWorkers);
    const workers: Worker[] = [];

    try {
      const workerPromises = Array.from({ length: numWorkers }, (_, i) => {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, docs.length);
        const worker = new Worker(path.resolve(__dirname, './worker.js'));
        workers.push(worker);

        return new Promise<SerializableResult>((resolve, reject) => {
          worker.on('message', resolve);
          worker.on('error', reject);
          worker.postMessage({
            docs: docs.slice(start, end),
            options: { fieldBoosts: this.fieldBoosts },
          });
        });
      });

      const results = await Promise.all(workerPromises);

      // Initialize arrays with proper size
      const totalDocs = docs.length;
      const newDocLengths = new Uint32Array(
        this.documentLengths.length + totalDocs,
      );
      newDocLengths.set(this.documentLengths);
      this.documentLengths = newDocLengths;

      // Store new documents
      const startIndex = this.documents.length;
      this.documents.push(...docs);

      let offset = startIndex;
      results.forEach((result) => {
        // Update document lengths
        for (let i = 0; i < result.documentLengths.length; i++) {
          this.documentLengths[offset + i] = result.documentLengths[i];
        }

        // Merge term mappings and frequencies
        result.termToIndex.forEach(([term, index]) => {
          if (!this.termToIndex.has(term)) {
            this.termToIndex.set(term, this.termToIndex.size);
          }
          const newIndex = this.termToIndex.get(term)!;

          // Update term frequencies with correct document offset
          const freqMap = new Map(
            result.termFrequencies
              .filter(([tIndex]) => tIndex === index)
              .flatMap(([_, docFreqs]) => docFreqs)
              .map(([docIdx, freq]) => [docIdx + offset, freq]),
          );

          if (!this.termFrequencies.has(newIndex)) {
            this.termFrequencies.set(newIndex, freqMap);
          } else {
            freqMap.forEach((freq, docIdx) => {
              this.termFrequencies.get(newIndex)!.set(docIdx, freq);
            });
          }
        });

        offset += result.documentCount;
      });

      // Recalculate document frequency and average length
      this.updateDocumentFrequency();
      this.recalculateAverageLength();
    } finally {
      workers.forEach((worker) => worker.terminate());
    }
  }

  private updateDocumentFrequency(): void {
    this.documentFrequency = new Uint32Array(this.termToIndex.size);
    this.termFrequencies.forEach((docFreqs, termIndex) => {
      this.documentFrequency[termIndex] = docFreqs.size;
    });
  }

  private recalculateAverageLength(): void {
    const totalLength = this.documentLengths.reduce((sum, len) => sum + len, 0);
    this.averageDocLength = totalLength / this.documentLengths.length;
  }

  /**
   * Searches the indexed documents using BM25 ranking
   * @param query - Search query text
   * @param limit - Maximum number of results to return
   * @returns Array of search results sorted by relevance score
   */
  public search(query: string, topK: number = 10): SearchResult[] {
    const { tokens: queryTokens } = this.tokenizer.tokenize(query);
    const scores = new Float32Array(this.documentLengths.length);

    queryTokens.forEach((term) => {
      const termIndex = this.termToIndex.get(term);
      if (termIndex === undefined) return;

      const idf = this.calculateIDF(termIndex);
      const termFreqs = this.termFrequencies.get(termIndex)!;

      termFreqs.forEach((tf, docIndex) => {
        const docLength = this.documentLengths[docIndex];
        const normalizedTF =
          (tf * (this.termFrequencySaturation + 1)) /
          (tf +
            this.termFrequencySaturation *
              (1 -
                this.lengthNormalizationFactor +
                (this.lengthNormalizationFactor * docLength) /
                  this.averageDocLength));
        scores[docIndex] += idf * normalizedTF;
      });
    });

    return Array.from({ length: scores.length }, (_, i) => ({
      index: i,
      score: scores[i],
    }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  public searchPhrase(phrase: string, topK: number = 10): SearchResult[] {
    const { tokens: phraseTokens } = this.tokenizer.tokenize(phrase);
    const candidateDocs = new Set<number>();

    // Find documents containing all terms in the phrase
    phraseTokens.forEach((term) => {
      const termIndex = this.termToIndex.get(term);
      if (termIndex !== undefined) {
        const docs = this.termFrequencies.get(termIndex)!.keys();
        if (candidateDocs.size === 0) {
          for (const doc of docs) {
            candidateDocs.add(doc);
          }
        } else {
          for (const doc of candidateDocs) {
            if (!this.termFrequencies.get(termIndex)!.has(doc)) {
              candidateDocs.delete(doc);
            }
          }
        }
      }
    });

    // Check for exact phrase matches and calculate scores
    const scores = new Map<number, number>();
    candidateDocs.forEach((docIndex) => {
      const doc = this.getDocument(docIndex);
      let hasMatch = false;

      // Search through each field separately
      Object.entries(doc).forEach(([field, content]) => {
        const fieldBoost = this.fieldBoosts[field] || 1;
        const { tokens: docTokens } = this.tokenizer.tokenize(content);

        for (let i = 0; i <= docTokens.length - phraseTokens.length; i++) {
          if (phraseTokens.every((token, j) => token === docTokens[i + j])) {
            const score =
              this.calculatePhraseScore(phraseTokens, docIndex) * fieldBoost;
            scores.set(docIndex, (scores.get(docIndex) || 0) + score);
            hasMatch = true;
            break;
          }
        }
      });
    });

    return Array.from(scores.entries())
      .map(([index, score]) => ({ index, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private calculatePhraseScore(
    phraseTokens: string[],
    docIndex: number,
  ): number {
    return phraseTokens.reduce((score, term) => {
      const termIndex = this.termToIndex.get(term);
      if (termIndex === undefined) return score;

      const idf = this.calculateIDF(termIndex);
      const tf = this.termFrequencies.get(termIndex)!.get(docIndex) || 0;
      const docLength = this.documentLengths[docIndex];
      const normalizedTF =
        (tf * (this.termFrequencySaturation + 1)) /
        (tf +
          this.termFrequencySaturation *
            (1 -
              this.lengthNormalizationFactor +
              (this.lengthNormalizationFactor * docLength) /
                this.averageDocLength));
      return score + idf * normalizedTF;
    }, 0);
  }

  /**
   * Adds a new document to the index
   * @param doc - Document to add
   */
  public async addDocument(doc: Document): Promise<void> {
    if (!doc) throw new Error('Document cannot be null');

    const docIndex = this.documentLengths.length;
    this.documents.push(doc);

    let docLength = 0;

    Object.entries(doc).forEach(([field, content]) => {
      const { tokens } = this.tokenizer.tokenize(content);
      docLength += tokens.length * (this.fieldBoosts[field] || 1);

      const uniqueTerms = new Set(tokens);
      uniqueTerms.forEach((term) => {
        if (!this.termToIndex.has(term)) {
          this.termToIndex.set(term, this.termToIndex.size);
        }
        const termIndex = this.termToIndex.get(term)!;

        if (this.documentFrequency.length <= termIndex) {
          const newDocFreq = new Uint32Array(this.documentFrequency.length * 2);
          newDocFreq.set(this.documentFrequency);
          this.documentFrequency = newDocFreq;
        }
        this.documentFrequency[termIndex]++;

        if (!this.termFrequencies.has(termIndex)) {
          this.termFrequencies.set(termIndex, new Map());
        }
        const freq = tokens.filter((t) => t === term).length;
        this.termFrequencies.get(termIndex)!.set(docIndex, freq);
      });
    });

    const newDocLengths = new Uint32Array(this.documentLengths.length + 1);
    newDocLengths.set(this.documentLengths);
    newDocLengths[docIndex] = docLength;
    this.documentLengths = newDocLengths;

    const totalLength = this.documentLengths.reduce(
      (sum, length) => sum + length,
      0,
    );
    this.averageDocLength = totalLength / this.documentLengths.length;
  }

  private calculateIDF(termIndex: number): number {
    const docFreq = this.documentFrequency[termIndex];
    if (docFreq === 0) return 0;

    const N = this.documentLengths.length;
    return Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
  }

  private getTermFrequency(termIndex: number, docIndex: number): number {
    return this.termFrequencies.get(termIndex)?.get(docIndex) || 0;
  }

  private getDocument(index: number): Document {
    if (index < 0 || index >= this.documents.length) {
      throw new Error('Document index out of bounds');
    }
    return this.documents[index];
  }

  public clearDocuments(): void {
    this.documents = [];
    this.documentLengths = new Uint32Array(0);
    this.termToIndex.clear();
    this.documentFrequency = new Uint32Array(0);
    this.averageDocLength = 0;
    this.termFrequencies.clear();
  }

  public getDocumentCount(): number {
    return this.documents.length;
  }

  public async addDocuments(docs: Document[]): Promise<void> {
    docs.forEach((doc) => this.addDocument(doc));
  }
}
