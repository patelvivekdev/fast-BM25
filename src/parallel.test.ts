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

  it('matches constructor and addDocuments for multi-field terms and fieldBoosts', async () => {
    const docs = [
      { title: 'Rust guide', content: 'rust ownership and borrowing in rust' },
      { title: 'Go guide', content: 'goroutines and channels' },
      { title: 'Python tips', content: 'list comprehensions' },
    ];
    const fromCtor = new EsmBM25(docs);
    const fromAdd = new EsmBM25();
    await fromAdd.addDocuments(docs);
    const fromParallel = new EsmBM25();
    await fromParallel.addDocumentsParallel(docs);

    const expected = fromCtor.search('rust');
    expect(fromAdd.search('rust')).toEqual(expected);
    expect(fromParallel.search('rust')).toEqual(expected);

    const boostedDocs = [
      { title: 'rust guide', content: 'systems programming overview' },
      { title: 'general notes', content: 'rust tips and rust tricks' },
      { title: 'python intro', content: 'scripting basics' },
    ];
    const opts = { fieldBoosts: { title: 3, content: 1 } };
    const boostedCtor = new EsmBM25(boostedDocs, opts);
    const boostedAdd = new EsmBM25(undefined, opts);
    await boostedAdd.addDocuments(boostedDocs);
    const boostedParallel = new EsmBM25(undefined, opts);
    await boostedParallel.addDocumentsParallel(boostedDocs);

    const boostedExpected = boostedCtor.search('rust');
    expect(boostedAdd.search('rust')).toEqual(boostedExpected);
    expect(boostedParallel.search('rust')).toEqual(boostedExpected);
    expect(boostedExpected[0].index).toBe(0);
    expect(boostedExpected[1].index).toBe(1);
  });
});
