import type { Document, FieldBoosts } from './types';

export interface DocumentTermStats {
  docLength: number;
  termFrequencies: Map<string, number>;
}

/**
 * Collects a document's length and per-term frequencies across all fields.
 * Document frequency is implied by the unique keys: a term is counted once
 * per document even when it appears in multiple fields. Field boosts scale
 * both length and term frequency.
 */
export function collectDocumentTermStats(
  doc: Document,
  tokenize: (content: string) => string[],
  fieldBoosts: FieldBoosts,
): DocumentTermStats {
  let docLength = 0;
  const termFrequencies = new Map<string, number>();

  Object.entries(doc).forEach(([field, content]) => {
    const fieldBoost = fieldBoosts[field] || 1;
    const tokens = tokenize(content);
    docLength += tokens.length * fieldBoost;

    const uniqueTerms = new Set(tokens);
    uniqueTerms.forEach((term) => {
      const freq = tokens.filter((t) => t === term).length * fieldBoost;
      termFrequencies.set(term, (termFrequencies.get(term) || 0) + freq);
    });
  });

  return { docLength, termFrequencies };
}

export function processDocuments(
  docs: Document[],
  tokenize: (content: string) => string[],
  fieldBoosts: FieldBoosts,
): {
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
    const { docLength, termFrequencies: docTermFreqs } =
      collectDocumentTermStats(doc, tokenize, fieldBoosts);

    docTermFreqs.forEach((freq, term) => {
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
      termFrequencies.get(termIndex)!.set(docIndex, freq);
    });

    documentLengths[docIndex] = docLength;
    totalLength += docLength;
  });

  const documentFrequency = new Uint32Array(termToIndex.size);
  termDocs.forEach((docsForTerm, term) => {
    const termIndex = termToIndex.get(term)!;
    documentFrequency[termIndex] = docsForTerm.size;
  });

  return {
    documentLengths,
    termToIndex,
    documentFrequency,
    averageDocLength: docs.length === 0 ? 0 : totalLength / docs.length,
    termFrequencies,
  };
}
