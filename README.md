# fast-bm25

A high-performance BM25 (Okapi BM25) implementation in TypeScript with field boosting and parallel processing support.

## Features

- Fast BM25 ranking algorithm implementation
- Field boosting support
- Parallel document processing
- Customizable tokenization
- Stop words filtering
- Minimum token length filtering
- Optional stemming

## Installation

```bash
npm install fast-bm25
# or
yarn add fast-bm25
```

## Usage

### Basic Usage

```typescript
import { BM25 } from 'fast-bm25';

// Sample documents for demonstration
const docs = [
  { title: 'The quick brown fox', content: 'jumps over the lazy dog' },
  { title: 'The lazy brown dog', content: 'sleeps all day long' },
  { title: 'Quick fox', content: 'quick brown jumping' },
];
// Create a new BM25 instance
const bm25 = new BM25(docs);

// Query example
const query = 'brown fox';

// Get search results
const results = bm25.search(query, 2);

console.log(results);
// [
//   {
//     index: 2,
//     score: 0.6666956543922424,
//   }, {
//     index: 0,
//     score: 0.5762394666671753,
//   }
// ]
```

### Adding Documents

```typescript
const bm25 = new BM25();

// Add documents
bm25.addDocument({ title: 'Document title', content: 'Document content' });

// Add multiple documents
bm25.addDocuments([
  { title: 'Document 1', content: 'Content 1' },
  { title: 'Document 2', content: 'Content 2' },
]);

// Add documents in parallel

const largeDocs = [
  /* ... lots of documents ... */
];

await bm25.addDocumentsParallel(largeDocs);
```

### Field Boosting

```typescript
// Initialize with field boosts
const bm25WithBoosts = new BM25(docs, {
  fieldBoosts: {
    title: 2.0, // Title field has 2x importance
    content: 1.0,
  },
});
```

### Custom Options

```typescript
const customBM25 = new BM25(docs, {
  k1: 1.5, // Term frequency saturation parameter
  b: 0.75, // Length normalization factor
  minLength: 2, // Minimum token length
  stopWords: new Set(['the', 'a', 'is']), // Custom stop words
  stemming: true, // Enable word stemming
});
```
