import { parentPort } from 'worker_threads';
import { Tokenizer } from './tokenizer';
import type { BM25Options, Document, FieldBoosts } from './types';

function processDocuments(
  docs: Document[],
  options: BM25Options & { fieldBoosts?: FieldBoosts },
): {
  documentLengths: Uint32Array;
  termToIndex: Map<string, number>;
  documentFrequency: Uint32Array;
  averageDocLength: number;
  termFrequencies: Map<number, Map<number, number>>;
} {
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
      const tokens = tokenizer.tokenize(content);
      docLength += tokens.length * (options.fieldBoosts?.[field] || 1);

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
        const freq = tokens.filter((t) => t === term).length;
        termFrequencies.get(termIndex)!.set(docIndex, freq);
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

parentPort?.on('message', ({ docs, options }) => {
  const result = processDocuments(docs, options);
  parentPort?.postMessage(result);
});
