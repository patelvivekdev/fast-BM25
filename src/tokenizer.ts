import { stem } from 'porter2';
import type {
  TokenizerOptions,
  TokenizationResult,
  TokenizationStats,
  StemmingRule,
} from './types';

/**
 * Text tokenization with configurable filters and stemming
 */
export class Tokenizer {
  private readonly stopWords: Set<string>;
  private readonly minLength: number;
  private readonly stemming: boolean;
  private readonly stemmingRules: StemmingRule[];

  private static readonly DEFAULT_OPTIONS: Required<TokenizerOptions> = {
    stopWords: new Set<string>(),
    minLength: 2,
    stemming: false,
    stemmingRules: [],
  };

  /**
   * Creates a new tokenizer instance
   * @param options - Tokenization options including stop words and stemming
   */
  constructor(options: TokenizerOptions = {}) {
    const mergedOptions = { ...Tokenizer.DEFAULT_OPTIONS, ...options };
    this.stopWords = mergedOptions.stopWords;
    this.minLength = mergedOptions.minLength;
    this.stemming = mergedOptions.stemming;
    this.stemmingRules = mergedOptions.stemmingRules.map((rule) => ({
      ...rule,
      pattern:
        typeof rule.pattern === 'string'
          ? new RegExp(rule.pattern)
          : rule.pattern,
    }));
  }
  /**
   * Tokenize text into an array of terms with optional statistics
   * @param text - Input text to tokenize
   * @param includeStats - Whether to include tokenization statistics
   * @returns TokenizationResult containing tokens and optional stats
   * @throws {Error} If input text is null or empty
   */
  public tokenize(text: string, includeStats = false): TokenizationResult {
    if (!text) {
      throw new Error('Input text cannot be null or empty');
    }

    const startTime = Date.now();
    const originalWords = text.split(/\s+/).filter((word) => word.length > 0);

    const cleaned = this.cleanText(text);
    const tokens = cleaned
      .split(/\s+/)
      .filter((token) => this.isValidToken(token))
      .map((token) => (this.stemming ? this.stemWord(token) : token));

    const stats: TokenizationStats = includeStats
      ? {
          originalWordCount: originalWords.length,
          stopWordsRemoved: originalWords.length - tokens.length,
          stemmedWords: this.stemming ? tokens.length : 0,
          processingTimeMs: Date.now() - startTime,
        }
      : {
          originalWordCount: 0,
          stopWordsRemoved: 0,
          stemmedWords: 0,
          processingTimeMs: 0,
        };

    return { tokens, stats };
  }

  /**
   * Cleans and normalizes text by removing unwanted characters while preserving meaningful content.
   * Handles Unicode, emojis, symbols, accents, and multiple writing systems automatically.
   *
   * @param text - Input text to clean
   * @returns Cleaned and normalized text
   *
   * @example
   * cleanText("Hello, World™!") // "hello world"
   * cleanText("héllo 👋") // "hello"
   * cleanText("Hello 世界!") // "hello 世界"
   * cleanText("I'm don't") // "i'm don't"
   * cleanText("test©2023") // "test 2023"
   */
  private cleanText(text: string): string {
    return (
      text
        .toLowerCase()
        // Normalize Unicode characters to their canonical form
        .normalize('NFKD')
        // Remove control characters and zero-width characters
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
        // Remove combining diacritical marks
        .replace(/[\u0300-\u036f]/g, '')
        // Remove emojis and symbols while preserving basic punctuation
        // .replace(
        //   /[\p{Extended_Pictographic}\p{Emoji}\p{Emoji_Component}\p{Symbol}\p{So}]/gu,
        //   '',
        // )
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        // Remove trademark, copyright, and similar symbols
        .replace(/[™®©℠‼]/g, '')
        // Replace punctuation with space
        .replace(/[\p{P}]/gu, ' ')
        // Keep alphanumeric, CJK, Hangul intact and replace others with space
        .replace(
          /[^a-z0-9\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\s]/gu,
          ' ',
        )
        // Normalize whitespace: collapse multiple spaces and trim
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Check if a token is valid based on length and stop words
   * @param token - Token to validate
   * @returns Whether the token is valid
   */
  private isValidToken(token: string): boolean {
    const isNumeric = /^\d+$/.test(token);
    return (
      (token.length >= this.minLength || isNumeric) &&
      !this.stopWords.has(token)
    );
  }

  /**
   * Apply stemming rules to a word
   * @param word - Word to stem
   * @returns Stemmed word
   */
  private stemWord(word: string): string {
    if (word.length < 3) return word;
    let customRule = false;

    let stemmed = word;

    // Apply custom stemming rules first
    for (const rule of this.stemmingRules) {
      const match = stemmed.match(rule.pattern);
      if (match) {
        customRule = true;
        if (!rule.minMeasure || this.measure(stemmed) >= rule.minMeasure) {
          if (typeof rule.replacement === 'string') {
            // Handle string replacement
            stemmed = stemmed.replace(rule.pattern, rule.replacement);
          } else {
            // Handle function replacement
            stemmed = stemmed.replace(rule.pattern, rule.replacement);
          }
        }
      }
    }

    // Skip default stemming rules if a custom rule matched
    if (customRule) return stemmed;

    stemmed = stem(stemmed);

    return stemmed;
  }

  private isConsonant(word: string, i: number): boolean {
    const char = word[i];
    if ('aeiou'.includes(char)) return false;
    return char !== 'y' || (i === 0 ? true : !this.isConsonant(word, i - 1));
  }

  private measure(word: string): number {
    let m = 0;
    let vowelSeen = false;
    for (let i = 0; i < word.length; i++) {
      if (this.isConsonant(word, i)) {
        if (vowelSeen) {
          m++;
          vowelSeen = false;
        }
      } else {
        vowelSeen = true;
      }
    }
    return m;
  }
}
