/**
 * Generation half of the Eval Lab — mirrors agent-hub/src/agent_hub/eval/lab
 * (genmodels.py, genmetrics.py, pipeline.py, judgelab.py, release_gate.py).
 * snake_case on purpose: this is the wire format.
 */

export type Stage = 'ingestion' | 'retrieval' | 'rerank' | 'grade' | 'generation';
export type Fault = 'none' | Stage;
export type StageStatus = 'ok' | 'warn' | 'fail' | 'skip';

export interface MetricResult {
  name:   string;
  score:  number | null;
  steps:  Record<string, unknown>[];
  note:   string;
  flags:  string[];
  calls?: number;
  error?: string;
}

export interface JudgeConfig {
  model: string; temperature: number; seed: number; prompt_version: string; fingerprint?: string;
}

export interface GenConfig {
  stages:            Stage[];
  faults:            Record<Fault, string>;
  generator_prompts: Record<string, string>;
  rerank_modes:      string[];
  metrics:           string[];
  failure_modes:     Record<string, string>;
  metric_prompts:    Record<string, string>;
  prompt_version:    string;
  judge:             JudgeConfig & { fingerprint: string };
  default_model:     string;
  models:            string[];
  paddings:          Record<string, string>;
}

export interface Scenario {
  id: string; title: string; lesson: string;
  question: string; contexts: string[]; answer: string; reference: string;
  expect: Record<string, string>;
}

export interface PlaygroundResponse {
  results:    Record<string, MetricResult>;
  abstention: boolean;
  judge:      JudgeConfig & { fingerprint: string };
  calls:      number;
}

export interface PipelineSpec {
  name:                 string;
  candidate_k:          number;
  min_score:            number;
  rerank:               'none' | 'lexical' | 'llm';
  top_n:                number;
  grader:               boolean;
  generator:            'strict' | 'lenient' | 'verbose';
  generate_temperature: number;
  grounding:            boolean;
  fault:                Fault;
  model:                string | null;
}

export interface CtxChunk {
  rank: number; doc_id: string; chunk_id: string; score: number; text: string; evidence_units: number[];
}

export interface StageResult {
  stage: string; status: StageStatus; detail: string; data: Record<string, unknown>;
}

export interface GenItemResult {
  item_id:      string;
  query:        string;
  answerable:   boolean;
  ground_truth: string;
  trap:         string;
  difficulty:   string;
  units:        string[];
  candidates:   CtxChunk[];
  contexts:     CtxChunk[];
  grade:        { relevant: boolean; reason: string } | null;
  answer:       string;
  abstained:    boolean;
  grounding:    { grounded: boolean; reason: string; regenerated: boolean } | null;
  metrics:      Record<string, number>;
  details:      Record<string, Partial<MetricResult> & Record<string, unknown>>;
  stages:       StageResult[];
  blame:        string;
  outcome:      string;
  flags:        string[];
  latency_ms:   number;
  error:        string | null;
}

export interface Aggregate { mean: number; low: number; high: number; n: number; sd: number }

export interface Components {
  stages:        Record<string, Partial<Record<StageStatus, number>>>;
  blame:         Record<string, number>;
  blame_by_trap: Record<string, Record<string, number>>;
  outcomes:      Record<string, number>;
  funnel:        { step: string; n: number }[];
  flags:         Record<string, number>;
}

export interface GenRunSummary {
  kind: 'generation';
  id: string;
  dataset_id: string;
  dataset_version: number;
  dataset_hash: string;
  dataset_status: 'draft' | 'frozen';
  spec: PipelineSpec;
  split: string;
  item_ids: string[];
  llm_context_metrics: boolean;
  judge: JudgeConfig;
  judge_fingerprint: string;
  status: 'running' | 'done' | 'failed';
  created_at: string;
  finished_at: string | null;
  aggregates: Record<string, Aggregate>;
  components: Components;
  diagnostics: Record<string, number>;
  error: string | null;
}

export interface GenRun extends GenRunSummary { results: GenItemResult[] }

export interface GenCompare {
  n: number;
  metrics: { metric: string; n: number; a: number; b: number; delta: number; low: number | null; high: number | null; wins: number; losses: number; ties: number }[];
  spec_diff: string[];
  transitions: { from: string; to: string; n: number }[];
  blame_a: Record<string, number>;
  blame_b: Record<string, number>;
  items: { item_id: string; a: string; b: string; blame_a: string; blame_b: string }[];
  warnings: string[];
}

export interface FaultMatrix {
  stages: Stage[];
  rows: { run_id: string; fault: Fault; items: number; failed: number; masked: number; blamed: Record<string, number>; accuracy: number | null }[];
}

/* ── Judge Lab ──────────────────────────────────────────────────────────── */

export interface JudgeInput {
  id?: string;
  name: string;
  model: string | null;
  temperature: number;
  seed: number;
  mode: 'pointwise' | 'binary';
  rubric: string;
  reference_guided: boolean;
  show_context: boolean;
  reasoning_first: boolean;
  scale_max: number;
  pass_threshold: number;
  notes: string;
}

export interface Judge extends JudgeInput {
  id: string;
  version: number;
  created_at: string;
  history: (Record<string, unknown> & { version: number; fingerprint: string; retired_at: string })[];
  fingerprint: string;
  resolved_model: string;
}

export interface HumanLabel { verdict: 'pass' | 'fail'; score: number | null; note: string; at?: string }

export interface JudgeSample {
  id: string; question: string; answer: string; reference: string; contexts: string[];
  kind: string; source: string; labels: Record<string, HumanLabel>;
}

export interface JudgeSetSummary {
  id: string; name: string; description: string; created_at: string;
  samples: number; raters: Record<string, number>; kinds: Record<string, number>;
}

export interface JudgeSet { id: string; name: string; description: string; created_at: string; samples: JudgeSample[] }

export interface BlindTask {
  rater: string; total: number; done: number; remaining: number;
  next: { id: string; question: string; answer: string; reference: string; contexts: string[] }[];
}

export interface JudgeRunSummary {
  id: string; set_id: string; judge_id: string; judge_version: number; fingerprint: string;
  spec: Record<string, unknown>; probe: 'standard' | 'consistency' | 'verbosity' | 'position';
  repeats: number; status: string; created_at: string; finished_at: string | null;
  summary: Record<string, unknown>; error: string | null;
}

export interface JudgeRun extends JudgeRunSummary { results: Record<string, unknown>[] }

export interface ValidationReport {
  n: number;
  note?: string;
  rater: string;
  judge: { id: string; version: number; fingerprint: string };
  accuracy: number;
  kappa: number | null;
  kappa_ci: [number | null, number | null];
  kappa_reading: string;
  confusion: { labels: string[]; matrix: number[][] };
  fail_recall: number | null;
  pass_recall: number | null;
  fail_precision: number | null;
  human_pass_rate: number;
  judge_pass_rate: number;
  pass_rate_gap: number;
  corrected_pass_rate: number | null;
  scores: { n: number; spearman: number | null; mean_bias: number; mae: number; labels: string[]; confusion: number[][] } | null;
  per_kind: { kind: string; n: number; human_pass_rate: number; judge_pass_rate: number; agreement: number }[];
  disagreements: { sample_id: string; kind: string; question: string; answer: string; human: string; human_score: number | null; judge: string; judge_score: number | null; reasoning: string; human_note: string }[];
  human_human: { rater: string; n: number; kappa: number | null; agreement: number }[];
}

export interface DriftReport {
  n: number;
  same_fingerprint: boolean;
  changed_fields: string[];
  verdict_agreement: number | null;
  kappa_between_runs: number | null;
  pass_rate_a: number | null;
  pass_rate_b: number | null;
  flips: { sample_id: string; kind: string; from: string; to: string; score_a: number | null; score_b: number | null }[];
  score_shift?: { mean: number; low: number; high: number; n: number };
  mean_score_a?: number;
  mean_score_b?: number;
  validation?: { a: Partial<ValidationReport>; b: Partial<ValidationReport> };
}

/* ── Release gate ───────────────────────────────────────────────────────── */

export interface GateRule {
  id: string;
  metric: string;
  kind: 'floor' | 'ceiling' | 'max_drop' | 'non_inferior';
  threshold: number;
  severity: 'block' | 'warn';
  applies_to: 'retrieval' | 'generation';
  rationale: string;
}

export interface GatePolicy {
  id: string; name: string; description: string; version: number; confidence: number;
  require_same_dataset: boolean; require_frozen_dataset: boolean; require_same_judge: boolean;
  min_items: number; max_error_rate: number; rules: GateRule[]; updated_at: string;
}

export interface GateRunRow {
  id: string; kind: 'retrieval' | 'generation'; name: string; split: string; status: string;
  dataset_id: string; dataset_version: number; created_at: string; fault?: string; arm?: string;
}

export interface GateRuleResult extends GateRule {
  status: 'pass' | 'fail';
  detail: string;
  advisory?: string;
  lower_is_better: boolean;
  candidate?: { mean: number; low: number; high: number; n: number };
  baseline?: { mean: number; n: number };
  delta?: { mean: number; low: number; high: number; n: number; sd: number; wins: number; losses: number; detectable: number };
}

export interface GateRunMeta {
  id: string; kind: string; name: string; dataset: string; dataset_hash: string; split: string;
  judge_fingerprint: string | null; n: number; errors: number; created_at: string;
}

export interface GateResult {
  decision: 'pass' | 'warn' | 'block';
  policy: { id: string; version: number; name: string };
  baseline: GateRunMeta;
  candidate: GateRunMeta;
  preconditions: { ok: boolean; title: string; detail: string }[];
  rules: GateRuleResult[];
  reasons: string[];
  evaluated_at: string;
  exit_code: number;
  markdown?: string;
}

export interface GateDecision {
  id: string; recorded_at: string; policy_id: string; policy_version: number;
  baseline_run: string; candidate_run: string; decision: string; final: string;
  override: { reason: string; author: string; at: string } | null; reasons: string[];
}

export interface GateSnapshot {
  dir: string;
  present: Record<'policy' | 'baseline' | 'candidate', boolean>;
  result?: Pick<GateResult, 'decision' | 'exit_code' | 'reasons' | 'baseline' | 'candidate' | 'policy'>;
  markdown?: string;
}
