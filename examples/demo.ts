import { BM25 } from '../src/index';
// import { BM25 } from 'fast-bm25';

// Sample documents for demonstration
const docs = [
  { title: 'The quick brown fox', content: 'jumps over the lazy dog' },
  { title: 'The lazy brown fox dog', content: 'sleeps all day long' },
  { title: 'Quick fox', content: 'quick brown jumping' },
];
// Create a new BM25 instance
const bm25 = new BM25(docs);

// Query example
const query = 'brown fox';

// Get search results
const results = bm25.search(query, 3);
console.log('results', results);

const bm25_2 = new BM25();
await bm25_2.addDocumentsParallel(docs);

// Get search results

const results_2 = bm25.search(query, 3);
console.log('results_2', results_2);

// Example with field boosts

const bm25_3 = new BM25(docs, { fieldBoosts: { title: 100, content: 1 } });

// Get search results
const results_3 = bm25_3.search(query, 3);

console.log('results_3', results_3);
