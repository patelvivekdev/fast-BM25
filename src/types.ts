/**
 * Search result containing document index and relevance score
 */
export interface SearchResult {
  /** Index of the matched document */
  index: number;
  /** BM25 relevance score */
  score: number;
}

/**
 * Options for configuring the BM25 algorithm
 */
export interface BM25Options {
  /** Term frequency saturation parameter (default: 1.5) */
  k1?: number;
  /** Length normalization factor (default: 0.75) */
  b?: number;
  /** Minimum token length to consider (default: 2) */
  minLength?: number;
  /** Set of stop words to filter out */
  stopWords?: Set<string>;
  /** Enable word stemming (default: false) */
  stemming?: boolean;
  /** Custom word stemming function */
  stemWords?: (word: string) => string;
}

/**
 * Options for configuring the tokenizer
 */
export interface TokenizerOptions {
  /** Set of words to exclude from tokenization */
  stopWords?: Set<string>;
  /** Minimum length for a token to be included */
  minLength?: number;
  /** Whether to apply stemming to tokens */
  stemming?: boolean;
  /** Custom stemming rules to apply (optional) */
  stemmingRules?: StemmingRule[];
}

export interface StemmingRule {
  /** Regular expression pattern to match */
  pattern: string | RegExp;
  /** Replacement string or function */
  replacement: string | ((match: string, ...args: string[]) => string);
  /** Minimum measure value required to apply rule */
  minMeasure?: number;
}

export interface TokenizationResult {
  /** Array of processed tokens */
  tokens: string[];
  /** Statistics about the tokenization process */
  stats: TokenizationStats;
}

export interface TokenizationStats {
  /** Original word count before processing */
  originalWordCount: number;
  /** Number of stop words removed */
  stopWordsRemoved: number;
  /** Number of words stemmed */
  stemmedWords: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Field boost factors to control importance of different fields
 */
export interface FieldBoosts {
  /** Field name to boost factor mapping */
  [field: string]: number;
}

/**
 * Document structure where each field contains text content
 */
export interface Document {
  /** Field name to text content mapping */
  [field: string]: string;
}

export interface SerializableResult {
  documentLengths: number[]; // Will be converted to Uint32Array
  termToIndex: [string, number][]; // Map as array of entries
  documentFrequency: number[]; // Will be converted to Uint32Array
  averageDocLength: number;
  termFrequencies: [number, [number, number][]][]; // Nested Maps as arrays of entries
  documentCount: number;
}
