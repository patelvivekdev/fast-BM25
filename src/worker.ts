import { parentPort } from 'worker_threads';
import { Tokenizer } from './tokenizer';
import type { Document, BM25Options, FieldBoosts } from './types';

function processDocuments(
  docs: Document[],
  options: BM25Options & { fieldBoosts?: FieldBoosts },
) {
  const tokenizer = new Tokenizer(options);
  const documentLengths = new Uint32Array(docs.length);
  const termToIndex = new Map<string, number>();
  const termDocs = new Map<string, Set<number>>();
  const termFrequencies = new Map<number, Map<number, number>>();
  let totalLength = 0;
  let nextTermIndex = 0;

  docs.forEach((doc, docIndex) => {
    let docLength = 0;
    Object.entries(doc).forEach(([field, content]) => {
      const { tokens } = tokenizer.tokenize(content);
      const fieldBoost = options.fieldBoosts?.[field] || 1;
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
        const freq = tokens.filter((t) => t === term).length * fieldBoost;
        const existingFreq = termFrequencies.get(termIndex)!.get(docIndex) || 0;
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

  // Convert Maps to serializable format
  const serializedTermToIndex = Array.from(termToIndex.entries());
  const serializedTermFrequencies = Array.from(termFrequencies.entries()).map(
    ([termIndex, docFreqs]) => [termIndex, Array.from(docFreqs.entries())],
  );

  // Modify return format for better serialization
  return {
    documentLengths: Array.from(documentLengths),
    termToIndex: serializedTermToIndex,
    documentFrequency: Array.from(documentFrequency),
    averageDocLength: totalLength / docs.length,
    termFrequencies: serializedTermFrequencies,
    documentCount: docs.length,
  };
}

parentPort?.on('message', ({ docs, options }) => {
  const result = processDocuments(docs, options);
  parentPort?.postMessage(result);
});
