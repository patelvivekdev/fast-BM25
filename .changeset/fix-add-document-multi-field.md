---
'fast-bm25': patch
---

Fix `addDocument`/`addDocuments` so multi-field terms are counted once per document, term frequencies accumulate across fields, and `fieldBoosts` scale term frequency. Scores now match `new BM25(docs, options)` and `addDocumentsParallel` (#13).
