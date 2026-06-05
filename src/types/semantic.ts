export type EmbeddingStatus =
  | 'PENDING'
  | 'INDEXING'
  | 'INDEXED'
  | 'FAILED'
  | 'SKIPPED';

/** A single ranked search hit (mirrors know-hub TDD §8.5). */
export interface SearchHit {
  documentId:      string;
  title:           string;
  excerpt:         string;
  similarityScore: number;   // cosine similarity of best chunk (0–1)
  rrfScore:        number;   // RRF combined score (hybrid) — for transparency
  embeddingStatus: EmbeddingStatus;
  ownerId:         string;
}

export interface SearchResponse {
  total:   number;
  results: SearchHit[];
}

export interface SearchParams {
  q:         string;
  hybrid?:   boolean;
  minScore?: number;
  limit?:    number;
  offset?:   number;
}

export interface EmbeddingStatusResponse {
  documentId:      string;
  embeddingStatus: EmbeddingStatus;
}
