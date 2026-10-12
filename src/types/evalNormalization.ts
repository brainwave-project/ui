/** Standalone passage benchmark, intentionally separate from Golden Set indexes. */
export type NormalizationPreset = 'raw' | 'diacritics' | 'tatweel' | 'alef' | 'conservative' | 'aggressive';
export type NormalizationRetriever = 'bm25' | 'dense';
export type NormalizationMetric = 'ndcg@10' | 'recall@5' | 'recall@10' | 'recall@100' | 'mrr@10';
export type NormalizationMetrics = Record<NormalizationMetric, number>;

export interface NormalizationConfig {
  retrievers: NormalizationRetriever[];
  presets: NormalizationPreset[];
  normalization_side: 'both' | 'query';
  bootstrap_samples: number;
  seed: number;
  dense_model: string | null;
  dense_revision: string | null;
  dense_batch_size: number;
  dense_max_seq_length: number;
  query_prefix: string;
  document_prefix: string;
  top_k: number;
}

export interface NormalizationOptions {
  presets: { id: NormalizationPreset; label: string; description: string }[];
  metrics: NormalizationMetric[];
  defaults: NormalizationConfig;
  tokenizer: string;
}

export interface NormalizationDataset {
  dataset_id: string;
  name: string;
  created_at: string;
  document_count: number;
  query_count: number;
  qrel_count: number;
  hashes: { corpus: string; queries: string; qrels: string };
  provenance: { source?: string; scope?: string; [key: string]: unknown };
  warnings: string[];
}

export interface NormalizationComparison {
  delta: number;
  ci_low: number;
  ci_high: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface NormalizationCondition {
  retriever: NormalizationRetriever;
  preset: NormalizationPreset;
  metrics: NormalizationMetrics;
  changed_queries: number;
  changed_documents: number;
  slices: Record<string, { query_count: number; metrics: NormalizationMetrics }>;
  comparison_to_raw: Partial<Record<NormalizationMetric, NormalizationComparison>>;
}

export interface NormalizationRunSummary {
  run_id: string;
  dataset_id: string;
  created_at: string;
}

export interface NormalizationReport extends NormalizationRunSummary {
  config: NormalizationConfig;
  dataset: NormalizationDataset;
  conditions: NormalizationCondition[];
  warnings: string[];
  provenance?: Record<string, unknown>;
}

export interface NormalizationQuery {
  qid: string;
  query: string;
  normalized_query: string;
  tags: string[];
  query_changed: boolean;
  metrics: NormalizationMetrics;
  ranking: { passage_id: string; score: number; relevance: number | null }[];
}

export interface NormalizationQueryPage {
  total: number;
  offset: number;
  limit: number;
  items: NormalizationQuery[];
}

export interface NormalizationPassage {
  passage_id: string;
  title: string;
  text: string;
  retrieval_input: string;
  normalized_input: string;
  preset: NormalizationPreset;
  normalization_side: 'both' | 'query';
}
