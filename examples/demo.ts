import { BM25 } from '../src/index';
// import { BM25 } from 'fast-bm25';

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

// // Print the results
// console.log('Search query:', query);
// console.log('Results (document index and score):');
// results.forEach((result) => {
//   console.log(`Document ${result.index}: ${result.score.toFixed(4)}`);
//   console.log(
//     `Content: "${docs[result.index].title}: ${docs[result.index].content}"`,
//   );
//   console.log('---');
// });
