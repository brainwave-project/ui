/**
 * Eval Lab contracts — mirror agent-hub/src/agent_hub/eval/lab (models.py, api.py,
 * readiness.py, analysis.py, simulate.py, …). Field names are snake_case on purpose:
 * they are the wire format, and renaming them here would hide the mapping to the
 * Python code.
 */

export type Split = 'dev' | 'holdout';
export type Normalization = 'off' | 'conservative' | 'aggressive';
export type Severity = 'blocker' | 'warning' | 'info' | 'pass';
export type Difficulty = 'easy' | 'medium' | 'hard';

/* ── Dataset ─────────────────────────────────────────────────────────────── */

export interface CorpusDoc {
  doc_id: string;
  lang:   string;
  body:   string;
  source: string;
}

export interface CorpusDocView extends CorpusDoc {
  words:        number;
  relevant_for: string[];
}

export interface Evidence {
  doc_id: string;
  text:   string;
}

export interface GoldenItem {
  id:           string;
  query:        string;
  lang:         string;
  /** doc_id → grade (3 fully answers · 2 substantially · 1 partially) */
  relevant:     Record<string, number>;
  evidence:     Evidence[];
  ground_truth: string;
  difficulty:   Difficulty;
  trap:         string;
  tags:         string[];
  split:        Split | null;
  pinned:       boolean;
  notes:        string;
  /** documents explicitly judged NOT relevant; everything else unlisted is unjudged */
  judged_nonrelevant: string[];
  origin:       string;
}

export type StratifyAttr = 'difficulty' | 'trap' | 'lang';

export interface SplitConfig {
  holdout_fraction: number;
  seed:             number;
  stratify_by:      StratifyAttr[];
  group_by:         'none' | 'primary_doc';
}

export interface DatasetMeta {
  id:          string;
  name:        string;
  description: string;
  lang:        string;
  created_at:  string;
}

export interface DatasetManifest {
  dataset_id:        string;
  version:           number;
  status:            'draft' | 'frozen';
  parent_version:    number | null;
  created_at:        string;
  frozen_at:         string | null;
  content_hash:      string | null;
  split_config:      SplitConfig | null;
  split_assigned_at: string | null;
  changelog:         string;
}

export interface DatasetSummary extends DatasetMeta {
  versions: (DatasetManifest & { items: number; documents: number })[];
}

export interface IndexView {
  normalization: Normalization;
  corpus_hash:   string;
  owner_id:      string;
  documents:     Record<string, { document_id: string; status: string }>;
  started_at:    string;
  finished_at:   string | null;
  current:       boolean;
  reason:        string;
  statuses:      Record<string, number>;
}

export interface SplitSummary {
  dev:               number;
  holdout:           number;
  unassigned:        number;
  holdout_fraction:  number;
  groups:            number;
  pinned:            number;
  strata:            Record<string, { dev: number; holdout: number }>;
  straddling_groups: string[];
}

export interface DatasetBundle {
  meta:          DatasetMeta;
  manifest:      DatasetManifest;
  current_hash:  string;
  corpus_hashes: Record<Normalization, string>;
  corpus:        CorpusDocView[];
  items:         GoldenItem[];
  indexes:       Partial<Record<Normalization, IndexView>>;
  split_summary: SplitSummary;
}

export interface ChunkPreview {
  doc_id:            string;
  config:            { max_tokens: number; overlap: number };
  is_knowhub_config: boolean;
  words:             number;
  chunks: { index: number; content: string; token_count: number; start_word: number; end_word: number }[];
  evidence: {
    item_id:            string;
    text:               string;
    found_in_doc:       boolean;
    chunks_containing:  number[];
    straddles_boundary: boolean;
  }[];
}

/* ── Labelling: pooling, audit, synthetic, diff ──────────────────────────── */

export interface PoolDoc {
  doc_id:       string;
  /** 'relevant:3' | 'nonrelevant' | 'unjudged' */
  judgement:    string;
  best_rank:    number;
  retrieved_by: Record<string, number>;
  excerpt:      string;
}

export interface PoolView {
  exists:            boolean;
  created_at?:       string;
  depth?:            number;
  variants?:         string[];
  skipped_variants?: string[];
  summary?: {
    items:                      number;
    pooled_pairs:               number;
    judged_pairs:               number;
    judged_share:               number;
    items_fully_judged:         number;
    relevant_pooled:            number;
    relevant_never_pooled:      number;
    unique_relevant_by_variant: Record<string, number>;
  };
  items?: {
    item_id:             string;
    query:               string;
    split:               Split | null;
    docs:                PoolDoc[];
    unjudged:            number;
    relevant_not_pooled: string[];
  }[];
}

export interface AnnotationTask {
  annotator: string;
  remaining: number;
  items: { item_id: string; query: string; lang: string; docs: { doc_id: string; excerpt: string }[] }[];
}

export interface AgreementReport {
  rater_a:                  string;
  rater_b:                  string;
  items:                    number;
  pairs:                    number;
  assumed_pairs:            number;
  percent_agreement:        number | null;
  percent_agreement_binary: number | null;
  kappa_binary:             number | null;
  kappa_weighted:           number | null;
  interpretation_binary:    string;
  interpretation_weighted:  string;
  prevalence_relevant:      number;
  confusion:                number[][];
  confusion_binary:         number[][];
  disagreements: {
    item_id: string; query: string; doc_id: string; a: number; b: number;
    distance: number; binary_flip: boolean; gold_assumed: boolean;
  }[];
  notes: string[];
}

export interface Candidate {
  id:              string;
  doc_id:          string;
  chunk_index:     number;
  query:           string;
  evidence:        string;
  answer:          string;
  difficulty:      string;
  style:           string;
  model:           string;
  prompt_version:  string;
  temperature:     number;
  seed:            number;
  evidence_found:  boolean;
  lexical_overlap: number;
  copied:          boolean;
  status:          'pending' | 'accepted' | 'rejected';
  reject_reason:   string;
  item_id:         string | null;
  created_at:      string;
}

export interface CandidatesView {
  candidates: Candidate[];
  summary: {
    total: number; pending: number; accepted: number; rejected: number;
    acceptance_rate: number | null; evidence_found_rate: number | null; mean_overlap: number | null;
    copied: number; reject_reasons: Record<string, number>;
  };
}

export interface DatasetDiff {
  from_version: number;
  to_version:   number;
  from_hash:    string;
  to_hash:      string;
  docs:  { added: string[]; removed: string[]; changed: { doc_id: string; words_before: number; words_after: number }[] };
  items: { added: string[]; removed: string[]; changed: { id: string; fields: Record<string, { before: unknown; after: unknown }> }[] };
  split_moves:  { id: string; from: string | null; to: string | null }[];
  relabeled:    string[];
  consequences: ReportWarning[];
  comparable:   boolean;
}

/* ── Jobs & status ───────────────────────────────────────────────────────── */

export interface Job {
  id:          string;
  kind:        string;
  label:       string;
  status:      'running' | 'done' | 'failed';
  total:       number;
  done:        number;
  message:     string;
  error:       string | null;
  result:      Record<string, unknown>;
  started_at:  string;
  finished_at: string | null;
}

export interface EvalStatus {
  eval_api:      boolean;
  know_hub:      boolean;
  know_hub_grpc: boolean;
  know_hub_url:  string;
  lab_dir:       string;
  metrics:       string[];
  chunking:      { max_tokens: number; overlap: number };
  time:          string;
}

/* ── Readiness ───────────────────────────────────────────────────────────── */

export interface ReadinessCheck {
  id:       string;
  category: string;
  severity: Severity;
  title:    string;
  detail:   string;
  learn:    string;
  affected: string[];
}

export interface ReadinessReport {
  verdict: 'ready' | 'ready_with_caveats' | 'not_ready';
  counts:  Partial<Record<Severity, number>>;
  checks:  ReadinessCheck[];
  stats: {
    items:           number;
    answerable:      number;
    documents:       number;
    distractors:     number;
    dev:             number;
    holdout:         number;
    score_sd:        number;
    score_sd_source: 'run' | 'assumed';
    relevant_set_size: { mean: number; max: number; distribution: Record<string, number> };
    by_difficulty:   Record<string, number>;
    by_trap:         Record<string, number>;
    by_lang:         Record<string, number>;
    split:           SplitSummary;
    content_hash:    string;
  };
}

/* ── Retrieval ───────────────────────────────────────────────────────────── */

export interface VariantSpec {
  name:                string;
  level:               'document' | 'chunk';
  hybrid:              boolean;
  corpus_index:        Normalization;
  query_normalization: Normalization;
  min_score:           number;
  fetch:               number;
}

export interface RankedHit {
  rank:        number;
  unit_id:     string;
  doc_id:      string;
  document_id: string;
  chunk_id:    string;
  score:       number;
  rrf_score:   number;
  excerpt:     string;
  grade:       number;
  novel:       boolean;
}

export interface QueryResult {
  item_id:        string;
  query:          string;
  query_sent:     string;
  ranked:         RankedHit[];
  relevant_units: Record<string, number>;
  metrics:        Record<string, number>;
  judged_at_k:    number | null;
  latency_ms:     number;
  error:          string | null;
}

export interface ExplainRow {
  rank:              number;
  unit_id:           string;
  relevant:          boolean;
  grade:             number;
  in_k:              boolean;
  discount:          number;
  dcg_gain:          number;
  graded_gain:       number;
  precision_at_rank: number | null;
  cumulative_hits:   number;
}

export interface Explain {
  k:                   number;
  deep_k:              number;
  relevant_count:      number;
  found_in_k:          number;
  returned_in_k:       number;
  first_relevant_rank: number | null;
  dcg:                 number;
  idcg:                number;
  graded_dcg:          number;
  graded_idcg:         number;
  ap_sum:              number;
  ap_denominator:      number;
  rows:                ExplainRow[];
}

export interface SearchRequest {
  dataset_id: string;
  version:    number;
  variant:    VariantSpec;
  query:      string;
  k:          number;
  item_id?:   string | null;
  relevant?:  Record<string, number> | null;
}

export interface SearchResponse {
  result:  QueryResult;
  explain: Explain;
  notes:   string[];
}

/* ── Runs ────────────────────────────────────────────────────────────────── */

export interface Aggregate {
  mean: number;
  low:  number;
  high: number;
  n:    number;
  sd:   number;
}

export interface RunSummary {
  id:                   string;
  experiment_id:        string | null;
  arm:                  'baseline' | 'treatment' | 'adhoc';
  dataset_id:           string;
  dataset_version:      number;
  dataset_hash:         string;
  dataset_status:       'draft' | 'frozen';
  corpus_hash:          string;
  variant:              VariantSpec;
  split:                'dev' | 'holdout' | 'all';
  k:                    number;
  status:               'running' | 'done' | 'failed';
  created_at:           string;
  finished_at:          string | null;
  skipped_unanswerable: string[];
  aggregates:           Record<string, Aggregate>;
  diagnostics?:         { judged_at_k?: number; empty_results_share?: number; mean_latency_ms?: number; errors?: number };
  error:                string | null;
}

export interface Run extends RunSummary {
  results: QueryResult[];
}

export interface Sweeps {
  k: { ks: number[]; series: Record<string, number[]>; n: number; run_k: number };
  threshold: {
    k: number; n: number; score_kind: string;
    points: { threshold: number; recall: number; precision: number; mrr: number; mean_kept_in_k: number; empty_share: number }[];
  };
}

export interface FailureRow {
  item_id:        string;
  query:          string;
  value:          number;
  difficulty:     string;
  trap:           string;
  relevant:       string[];
  relevant_ranks: Record<string, number>;
  top:            { rank: number; doc_id: string; grade: number; judged: boolean; score: number }[];
  suggested:      string[];
  tags:           string[];
  note:           string;
}

export interface FailureReport {
  metric:           string;
  threshold:        number;
  scored:           number;
  failed:           number;
  failure_rate:     number;
  tagged:           number;
  suggested_counts: Record<string, number>;
  tag_counts:       Record<string, number>;
  taxonomy:         Record<string, { auto: boolean; label: string; hint: string }>;
  failures:         FailureRow[];
}

/* ── Experiments ─────────────────────────────────────────────────────────── */

export interface Guardrail {
  metric:   string;
  max_drop: number;
}

export interface SuccessCriteria {
  primary_metric: string;
  k:              number;
  direction:      'increase' | 'decrease' | 'non_inferior';
  min_effect:     number;
  confidence:     number;
  guardrails:     Guardrail[];
}

export interface Experiment {
  id:                string;
  name:              string;
  hypothesis:        string;
  rationale:         string;
  dataset_id:        string;
  dataset_version:   number;
  dataset_hash:      string | null;
  baseline:          VariantSpec;
  treatment:         VariantSpec;
  criteria:          SuccessCriteria;
  secondary_metrics: string[];
  status:            'draft' | 'registered' | 'concluded';
  created_at:        string;
  registered_at:     string | null;
  concluded_at:      string | null;
  runs:              string[];
  holdout_access:    { at: string; reason: string; run_ids: string[] }[];
  conclusion:        { decision?: Decision; confirmatory?: boolean } | null;
  conclusion_note:   string;
  variant_diff:      string[];
}

export type ExperimentInput = Pick<
  Experiment,
  'name' | 'hypothesis' | 'rationale' | 'dataset_id' | 'dataset_version' |
  'baseline' | 'treatment' | 'criteria' | 'secondary_metrics'
> & { id?: string };

export interface IntervalBounds {
  low:  number | null;
  high: number | null;
}

export interface ArmSummary {
  n:           number;
  mean?:       number;
  sd?:         number;
  bootstrap?:  IntervalBounds;
  t?:          IntervalBounds;
  cluster?:    IntervalBounds & { clusters: number };
  share_zero?: number;
  share_one?:  number;
}

export interface PairedDelta {
  n:               number;
  dropped:         string[];
  mean:            number;
  low:             number | null;
  high:            number | null;
  significant:     boolean;
  cluster:         IntervalBounds & { clusters: number; significant: boolean };
  p_permutation:   number;
  p_ttest?:        number;
  p_holm?:         number;
  effect_size_dz?: number;
  sd_delta:        number;
  wins:            number;
  losses:          number;
  ties:            number;
  per_query:       { item_id: string; baseline: number; treatment: number; delta: number }[];
}

export type MetricRole = 'primary' | 'guardrail' | 'secondary' | 'exploratory';

export interface MetricComparison {
  baseline:  ArmSummary;
  treatment: ArmSummary;
  delta:     PairedDelta;
  role?:     MetricRole;
}

export interface ReportWarning {
  severity: Severity;
  title:    string;
  detail:   string;
}

export type Verdict =
  | 'success' | 'detectable_but_small' | 'harm' | 'no_meaningful_effect'
  | 'inconclusive' | 'guardrail_breach';

export interface Decision {
  verdict:  Verdict;
  headline: string;
  reasons:  string[];
}

export interface Bin {
  lo:    number;
  hi:    number;
  count: number;
}

export interface ExperimentReport {
  experiment_id:  string;
  split:          Split;
  criteria:       SuccessCriteria;
  status:         'ok' | 'missing_runs' | 'invalid';
  missing?:       string[];
  warnings:       ReportWarning[];
  holdout_access: Experiment['holdout_access'];
  all_runs: {
    id: string; arm: string; split: string; status: string; created_at: string;
    dataset_hash: string; primary_mean: number | null; used_in_report: boolean;
  }[];
  confirmatory?:      boolean;
  holdout_runs?:      number;
  baseline_run?:      string;
  treatment_run?:     string;
  baseline_variant?:  VariantSpec;
  treatment_variant?: VariantSpec;
  decision?:          Decision;
  guardrails?:        { metric: string; max_drop: number; delta: number; low: number | null; passed: boolean }[];
  metrics?:           Record<string, MetricComparison>;
  strata?:            Record<string, Record<string, { n: number; baseline: number; treatment: number; delta: number }>>;
  per_query?: {
    item_id: string; query: string; difficulty: string; trap: string;
    baseline: number; treatment: number; delta: number;
  }[];
  power?:        { n: number; sd_delta: number; mde: number | null; n_needed_for_min_effect: number | null };
  primary_bootstrap?: Bin[];
  variant_diff?: string[];
}

export interface CompareReport {
  run_a:     string;
  run_b:     string;
  variant_a: VariantSpec;
  variant_b: VariantSpec;
  warnings:  ReportWarning[];
  metrics:   Record<string, MetricComparison>;
}

/* ── Stats Lab ───────────────────────────────────────────────────────────── */

export type PopulationKind = 'run' | 'bernoulli' | 'bimodal' | 'skewed';

export interface PopulationSpec {
  kind:    PopulationKind;
  run_id?: string | null;
  metric?: string;
  p?:      number;
  p_zero?: number;
}

export type IntervalMethodName = 'bootstrap' | 't' | 'normal';

export interface BootstrapDemo {
  n: number; mean: number; sd: number; se: number;
  distinct_values: number; distinct_resample_means: number;
  bootstrap_sd: number; bootstrap_skew: number;
  intervals: Record<IntervalMethodName, IntervalBounds>;
  values_hist: Bin[]; bootstrap_hist: Bin[];
  population: string; population_mean: number; sampled: boolean; sample: number[] | null;
}

export interface CoverageMethod {
  coverage: number; mean_width: number | null; outside_range_share: number; zero_width_share: number;
  miss_above: number; miss_below: number;
  examples: { low: number | null; high: number | null; covers: boolean }[];
}

export interface CoverageResult {
  true_mean: number; n: number; sims: number; confidence: number;
  methods: Record<IntervalMethodName, CoverageMethod>;
  sample_means_hist: Bin[]; population: string;
}

export interface CltResult {
  population_mean: number; population_sd: number; population_skew: number; population_hist: Bin[];
  population: string;
  distributions: { n: number; mean: number; sd: number; theoretical_se: number; skew: number; share_at_bounds: number; hist: Bin[] }[];
}

export interface PowerResult {
  n: number; effect: number; discordance: number; p_win: number; p_loss: number; sd_delta: number; alpha: number;
  analytic_power: number; empirical_power: number; empirical_se: number; wrong_sign_rate: number;
  n_for_80: number | null; curve: { n: number; power: number }[]; observed_effect_hist: Bin[];
}

export interface PhackingResult {
  alpha: number; n: number; sims: number;
  many_metrics: {
    metrics: number; correlation: number; raw_fwer: number; bonferroni_fwer: number; holm_fwer: number;
    independent_formula: number; min_p_hist: Bin[];
  };
  optional_stopping: {
    batch: number; looks: number; fixed_n_fpr: number; peeking_fpr: number;
    mean_stop_n: number | null; stop_hist: Bin[];
  };
}

/* ── Learning Path ───────────────────────────────────────────────────────── */

export interface Mission {
  id:           string;
  check:        'auto' | 'reflection';
  concept:      string;
  title:        string;
  why:          string;
  steps:        string[];
  tab:          string;
  status:       'done' | 'todo';
  evidence:     string;
  reflection:   string;
  completed_at: string | null;
}

export interface LearningPath {
  modules: { id: string; title: string; missions: Mission[]; done: number }[];
  done:    number;
  total:   number;
  share:   number;
  min_reflection_chars: number;
}
