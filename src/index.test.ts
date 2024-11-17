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
});
