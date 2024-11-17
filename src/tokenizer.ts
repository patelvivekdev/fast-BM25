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
    this.stopWords = mergedOptions.stopWords || new Set<string>();
    this.minLength =
      mergedOptions.minLength ?? Tokenizer.DEFAULT_OPTIONS.minLength;
    this.stemming = !!mergedOptions.stemming;
    this.stemmingRules = (mergedOptions.stemmingRules || [])
      .map((rule) => {
        try {
          return {
            ...rule,
            pattern:
              typeof rule.pattern === 'string'
                ? new RegExp(rule.pattern)
                : rule.pattern,
          };
        } catch (e) {
          console.warn(`Invalid stemming rule pattern: ${rule.pattern}`);
          return null;
        }
      })
      .filter((rule) => rule !== null);
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
      .split(' ')
      .filter((token) => this.isValidToken(token));

    const stemmedTokens = this.stemming
      ? tokens.map((token) => this.stemWord(token))
      : tokens;

    if (!includeStats) {
      return {
        tokens: stemmedTokens,
        stats: this.createEmptyStats(),
      };
    }

    return {
      tokens: stemmedTokens,
      stats: {
        originalWordCount: originalWords.length,
        stopWordsRemoved: originalWords.length - tokens.length,
        stemmedWords: this.stemming ? tokens.length : 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
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
        .replace(
          /[\p{Extended_Pictographic}\p{Emoji}\p{Emoji_Component}\p{Symbol}\p{So}]/gu,
          '',
        )
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

    stemmed = this.applyDefaultStemmingRules(stemmed);

    return stemmed;
  }

  /**
   * Apply the default Porter stemming algorithm rules
   * @param word - Word to stem
   * @returns Stemmed word
   */
  private applyDefaultStemmingRules(word: string): string {
    // Step 1a
    word = word
      .replace(/^(.+?)(ss|i)es$/, '$1$2')
      .replace(/(.+?)([^s])s$/, '$1$2');

    // Step 1b
    if (word.match(/(.+?)eed$/)) {
      const stem = RegExp.$1;
      if (this.measure(stem) > 0) word = stem + 'ee';
    } else {
      let match = word.match(/(.+?)(ed|ing)$/);
      if (match) {
        const stem = match[1];
        if (/[aeiou]/.test(stem)) {
          word = stem;
          if (/(?:at|bl|iz)$/.test(word)) word += 'e';
          else if (/([^aeiou])\1$/.test(word)) word = word.slice(0, -1);
          else if (
            this.measure(word) === 1 &&
            /[^aeiou][aeiou][^aeiouwxy]$/.test(word)
          )
            word += 'e';
        }
      }
    }

    // Step 2
    word = word.replace(
      /(.+?)(ational|tional|enci|anci|izer|abli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti)$/,
      (_, stem, suffix) => {
        return this.measure(stem) > 0 ? stem + 'ate' : stem + suffix;
      },
    );

    return word;
  }

  /**
   * Create empty statistics object
   * @returns Empty TokenizationStats
   */
  private createEmptyStats(): TokenizationStats {
    return {
      originalWordCount: 0,
      stopWordsRemoved: 0,
      stemmedWords: 0,
      processingTimeMs: 0,
    };
  }

  private isConsonant(word: string, i: number): boolean {
    const char = word.charAt(i);
    if ('aeiou'.includes(char)) return false;
    return char !== 'y' || (i === 0 ? true : !this.isConsonant(word, i - 1));
  }

  private measure(word: string): number {
    let count = 0;
    let inVCSequence = false;
    for (let i = 0; i < word.length; i++) {
      if (this.isConsonant(word, i)) {
        if (inVCSequence) {
          count++;
          inVCSequence = false;
        }
      } else {
        inVCSequence = true;
      }
    }
    return count;
  }
}
