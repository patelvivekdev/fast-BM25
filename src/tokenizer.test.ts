import { describe, it, expect } from 'vitest';
import { Tokenizer } from './tokenizer';

describe('Tokenizer', () => {
  describe('constructor', () => {
    it('should create a Tokenizer with default options', () => {
      const tokenizer = new Tokenizer();
      expect(tokenizer).toBeDefined();
    });

    it('should create a Tokenizer with custom options', () => {
      const tokenizer = new Tokenizer({
        stopWords: new Set(['the', 'a']),
        minLength: 3,
        stemming: true,
      });
      expect(tokenizer).toBeDefined();
    });
  });

  describe('tokenize', () => {
    it('should tokenize a simple sentence', () => {
      const tokenizer = new Tokenizer(); // by default, stop words are empty and min length is 2
      const result = tokenizer.tokenize('This is a test sentence');
      expect(result.tokens).toEqual(['this', 'is', 'test', 'sentence']);
    });

    it('should remove stop words', () => {
      const tokenizer = new Tokenizer({ stopWords: new Set(['is', 'a']) });
      const result = tokenizer.tokenize('This is a test sentence');
      expect(result.tokens).toEqual(['this', 'test', 'sentence']);
    });

    it('should filter tokens by minimum length', () => {
      const tokenizer = new Tokenizer({ minLength: 4 });
      const result = tokenizer.tokenize('This is a test sentence');
      expect(result.tokens).toEqual(['this', 'test', 'sentence']);
    });

    it('should apply stemming', () => {
      const tokenizer = new Tokenizer({ stemming: true });
      const result = tokenizer.tokenize('Running and jumped');
      expect(result.tokens).toEqual(['run', 'and', 'jump']);
    });

    it('should handle empty input', () => {
      const tokenizer = new Tokenizer();
      expect(() => tokenizer.tokenize('')).toThrow(
        'Input text cannot be null or empty',
      );
    });

    it('should handle input with only stop words', () => {
      const tokenizer = new Tokenizer({
        stopWords: new Set(['the', 'a', 'an']),
      });
      const result = tokenizer.tokenize('the a an');
      expect(result.tokens).toEqual([]);
    });

    it('should handle input with only short words', () => {
      const tokenizer = new Tokenizer({ minLength: 3 });
      const result = tokenizer.tokenize('a b c');
      expect(result.tokens).toEqual([]);
    });

    it('should include stats when requested', () => {
      const tokenizer = new Tokenizer({
        stopWords: new Set(['is', 'a']),
        stemming: true,
      });
      const result = tokenizer.tokenize('This is a test sentence', true);
      expect(result.stats).toBeDefined();
      expect(result.stats.originalWordCount).toBe(5);
      expect(result.stats.stopWordsRemoved).toBe(2);
      expect(result.stats.stemmedWords).toBe(3);
    });
  });

  describe('cleanText', () => {
    it('should convert text to lowercase', () => {
      const tokenizer = new Tokenizer({
        minLength: 0,
      });
      const result = tokenizer.tokenize('THIS IS A TEST');
      expect(result.tokens).toEqual(['this', 'is', 'a', 'test']);
    });

    it('should remove punctuation', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('Hello, world! How are you?');
      expect(result.tokens).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    it('should handle emojis and special characters', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('Hello 👋 world! ™®©');
      expect(result.tokens).toEqual(['hello', 'world']);

      expect(tokenizer.tokenize('👋').tokens).toEqual([]);
      expect(tokenizer.tokenize('test©').tokens).toEqual(['test']);
    });

    it('should handle accented characters', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('café résumé');
      expect(result.tokens).toEqual(['cafe', 'resume']);
    });

    it('should handle multiple spaces and trim', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('  multiple   spaces  ');
      expect(result.tokens).toEqual(['multiple', 'spaces']);
    });

    it('should handle text with only numbers', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('123 456 789');
      expect(result.tokens).toEqual(['123', '456', '789']);
    });

    it('should handle mixed alphanumeric input', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('abc123 def456');
      expect(result.tokens).toEqual(['abc123', 'def456']);
    });

    it('should handle input with only special characters', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('!@#$%^&*()');
      expect(result.tokens).toEqual([]);
    });

    it('should handle Unicode characters', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('こんにちは 世界');
      expect(result.tokens).toEqual(['こんにちは', '世界']);
    });

    it('should handle a mix of languages', () => {
      const tokenizer = new Tokenizer();
      const result = tokenizer.tokenize('Hello 你好 Bonjour');
      expect(result.tokens).toEqual(['hello', '你好', 'bonjour']);
    });
  });

  describe('edge cases', () => {
    it('should handle very long words', () => {
      const tokenizer = new Tokenizer();
      const longWord = 'a'.repeat(1000);
      const result = tokenizer.tokenize(longWord);
      expect(result.tokens).toEqual([longWord]);
    });
  });

  describe('custom stemming rules', () => {
    it('should apply custom stemming rules', () => {
      const customRules = [
        { pattern: /^(.*?)s$/, replacement: '$1', minMeasure: 1 },
      ];
      const tokenizer = new Tokenizer({
        stemming: true,
        stemmingRules: customRules,
      });
      const result = tokenizer.tokenize('cats');
      expect(result.tokens).toEqual(['cat']);
    });

    it('should apply custom stemming rules with minimum measure', () => {
      const customRules2 = [
        { pattern: /^(.*?)s$/, replacement: '$1', minMeasure: 2 },
      ];

      const tokenizer2 = new Tokenizer({
        stemming: true,
        stemmingRules: customRules2,
      });

      // Word with measure 1 - should not stem
      expect(tokenizer2.tokenize('cats').tokens).toEqual(['cats']);

      // Word with measure 2 - should stem
      expect(tokenizer2.tokenize('standings').tokens).toEqual(['standing']);
    });
  });
});
