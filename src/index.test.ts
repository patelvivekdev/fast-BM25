import { describe, it, expect } from 'vitest';
import { BM25 } from './index';

describe('BM25', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with documents', () => {
      const docs = [{ content: 'hello world' }, { content: 'hello test' }];
      const bm25 = new BM25(docs);
      expect(bm25).toBeDefined();
    });
  });

  describe('Search Functionality', () => {
    const docs = [
      { title: 'The quick brown fox', content: 'jumps over the lazy dog' },
      { title: 'The lazy brown dog', content: 'sleeps all day long' },
      { title: 'Quick fox', content: 'quick brown jumping' },
    ];

    it('should return ranked search results', () => {
      const bm25 = new BM25(docs);
      const results = bm25.search('quick fox', 2);
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should handle field boosts', () => {
      const bm25 = new BM25(docs, {
        fieldBoosts: { title: 2.0, content: 1.0 },
      });
      const results = bm25.search('quick');
      expect(results[0].index).toBe(2); // "Quick fox" document should rank higher
    });
  });

  describe('Options Handling', () => {
    it('should respect stopWords option', () => {
      const docs = [{ content: 'the quick brown fox' }];
      const bm25 = new BM25(docs, { stopWords: new Set(['the']) });
      const results = bm25.search('the');
      expect(results).toHaveLength(0);
    });

    it('should respect minLength option', () => {
      const docs = [{ content: 'a quick brown fox' }];
      const bm25 = new BM25(docs, { minLength: 2 });
      const results = bm25.search('a');
      expect(results).toHaveLength(0);
    });
  });

  describe('Document Management', () => {
    it('should add documents', async () => {
      const bm25 = new BM25();
      await bm25.addDocument({ content: 'hello world' });
      expect(bm25.getDocumentCount()).toBe(1);
    });

    it('should add documents', async () => {
      const docs = [
        { content: 'hello world' },
        { content: 'hello test' },
        { content: 'hello again' },
      ];
      const bm25 = new BM25();
      await bm25.addDocuments(docs);
      expect(bm25.getDocumentCount()).toBe(3);
    });

    it('should clear documents', async () => {
      const bm25 = new BM25([{ content: 'hello world' }]);
      bm25.clearDocuments();
      expect(bm25.getDocumentCount()).toBe(0);
    });
  });

  describe('Incremental indexing parity', () => {
    const docs = [
      { title: 'Rust guide', content: 'rust ownership and borrowing in rust' },
      { title: 'Go guide', content: 'goroutines and channels' },
      { title: 'Python tips', content: 'list comprehensions' },
    ];

    it('matches constructor scores for multi-field documents', async () => {
      const fromCtor = new BM25(docs);
      const fromAdd = new BM25();
      await fromAdd.addDocuments(docs);

      const expected = [{ index: 0, score: 1.4523817300796509 }];
      expect(fromCtor.search('rust')).toEqual(expected);
      expect(fromAdd.search('rust')).toEqual(expected);
    });

    it('keeps a single multi-field document searchable', async () => {
      const doc = { title: 'Rust guide', content: 'rust ownership' };
      const fromCtor = new BM25([doc]);
      const fromAdd = new BM25();
      await fromAdd.addDocument(doc);

      const expected = [{ index: 0, score: 0.3955628573894501 }];
      expect(fromCtor.search('rust')).toEqual(expected);
      expect(fromAdd.search('rust')).toEqual(expected);
    });

    it('applies fieldBoosts the same way as the constructor', async () => {
      const boostedDocs = [
        { title: 'rust guide', content: 'systems programming overview' },
        { title: 'general notes', content: 'rust tips and rust tricks' },
        { title: 'python intro', content: 'scripting basics' },
      ];
      const opts = { fieldBoosts: { title: 3, content: 1 } };
      const fromCtor = new BM25(boostedDocs, opts);
      const fromAdd = new BM25([], opts);
      await fromAdd.addDocuments(boostedDocs);

      const results = fromCtor.search('rust');
      expect(fromAdd.search('rust')).toEqual(results);
      expect(results.map((result) => result.index)).toEqual([0, 1]);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });
});
