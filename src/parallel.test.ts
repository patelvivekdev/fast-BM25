import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import { BM25 as EsmBM25 } from '../dist/index.js';

const require = createRequire(import.meta.url);
const { BM25: CjsBM25 } =
  require('../dist/index.cjs') as typeof import('./index');

const documents = [
  { title: 'Running quickly', content: 'the runner is running' },
  { title: 'A quiet walk', content: 'walking slowly' },
  { title: 'Runner results', content: 'running running fast' },
];

const options = {
  fieldBoosts: { title: 3, content: 1 },
  stemming: true,
  stopWords: new Set(['the', 'is', 'a']),
};

describe('parallel document indexing', () => {
  it('matches constructor indexing for the ESM package', async () => {
    const expected = new EsmBM25(documents, options);
    const actual = new EsmBM25(undefined, options);

    await actual.addDocumentsParallel(documents);

    expect(actual.search('running')).toEqual(expected.search('running'));
  });

  it('runs through the CommonJS package export', async () => {
    const index = new CjsBM25();

    await index.addDocumentsParallel(documents);

    expect(index.getDocumentCount()).toBe(documents.length);
    expect(index.search('running')).not.toHaveLength(0);
  });
});
