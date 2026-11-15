import { parentPort } from 'worker_threads';
import { Tokenizer } from './tokenizer';
import type { Document, BM25Options, FieldBoosts } from './types';
import { processDocuments } from './document-stats';

function processDocumentsForWorker(
  docs: Document[],
  options: BM25Options & { fieldBoosts?: FieldBoosts },
) {
  const tokenizer = new Tokenizer(options);
  const result = processDocuments(
    docs,
    (content) => tokenizer.tokenize(content).tokens,
    options.fieldBoosts || {},
  );

  // Convert Maps to serializable format
  const serializedTermToIndex = Array.from(result.termToIndex.entries());
  const serializedTermFrequencies = Array.from(
    result.termFrequencies.entries(),
  ).map(([termIndex, docFreqs]) => [termIndex, Array.from(docFreqs.entries())]);

  // Modify return format for better serialization
  return {
    documentLengths: Array.from(result.documentLengths),
    termToIndex: serializedTermToIndex,
    documentFrequency: Array.from(result.documentFrequency),
    averageDocLength: result.averageDocLength,
    termFrequencies: serializedTermFrequencies,
    documentCount: docs.length,
  };
}

parentPort?.on('message', ({ docs, options }) => {
  const result = processDocumentsForWorker(docs, options);
  parentPort?.postMessage(result);
});
