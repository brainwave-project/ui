import { evalClient } from '@/api/eval.api';
import type { Job } from '@/types/eval';
import type {
  BlindTask, DriftReport, FaultMatrix, GateDecision, GatePolicy, GateResult, GateRunRow, GateSnapshot,
  GenCompare, GenConfig, GenRun, GenRunSummary, HumanLabel, Judge, JudgeInput, JudgeRun, JudgeRunSummary,
  JudgeSet, JudgeSetSummary, PipelineSpec, PlaygroundResponse, Scenario, ValidationReport,
} from '@/types/evalGen';

/**
 * Generation half of the Eval Lab — same standalone eval API (:3005, via the
 * Vite proxy), same no-JWT client. Long work returns a Job to poll.
 */
const get = <T,>(url: string, params?: object) => evalClient.get<T>(url, { params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => evalClient.post<T>(url, body).then((r) => r.data);
const put = <T,>(url: string, body?: unknown) => evalClient.put<T>(url, body).then((r) => r.data);
const del = <T,>(url: string) => evalClient.delete<T>(url).then((r) => r.data);
const enc = encodeURIComponent;

export const genApi = {
  config:     () => get<GenConfig>('/gen/config'),
  scenarios:  () => get<Scenario[]>('/gen/scenarios'),
  playground: (body: { question: string; contexts: string[]; answer: string; reference: string; metrics?: string[]; model?: string | null; embedding_relevance?: boolean }) =>
    post<PlaygroundResponse>('/gen/metrics/playground', body),

  startRun: (body: { dataset_id: string; version: number; spec: PipelineSpec; split: 'dev'; item_ids?: string[] | null; limit?: number | null; llm_context_metrics: boolean; judge_model?: string | null }) =>
    post<Job>('/gen/runs', body),
  runs:      (datasetId?: string | null) => get<GenRunSummary[]>('/gen/runs', { dataset_id: datasetId ?? undefined }),
  run:       (id: string) => get<GenRun>(`/gen/runs/${enc(id)}`),
  deleteRun: (id: string) => del(`/gen/runs/${enc(id)}`),
  compare:   (a: string, b: string) => post<GenCompare>('/gen/compare', { run_a: a, run_b: b }),
  faultSuite: (body: { dataset_id: string; version: number; spec: PipelineSpec; faults: string[]; limit: number | null }) =>
    post<Job>('/gen/fault-suite', body),
  faultMatrix: (runIds: string[]) => post<FaultMatrix>('/gen/fault-matrix', { run_ids: runIds }),

  judges:      () => get<Judge[]>('/judges'),
  createJudge: (body: JudgeInput) => post<Judge>('/judges', body),
  updateJudge: (id: string, body: JudgeInput) => put<Judge>(`/judges/${enc(id)}`, body),
  deleteJudge: (id: string) => del(`/judges/${enc(id)}`),
  tryJudge:    (id: string, body: { question: string; answer: string; reference: string; contexts: string[] }) =>
    post<{ system: string; user: string; result: { score: number | null; verdict: string; reasoning: string } }>(`/judges/${enc(id)}/try`, body),

  sets:        () => get<JudgeSetSummary[]>('/judge-sets'),
  set:         (id: string) => get<JudgeSet>(`/judge-sets/${enc(id)}`),
  createSet:   (body: { name: string; id?: string; description?: string; jsonl?: string }) => post<JudgeSet>('/judge-sets', body),
  deleteSet:   (id: string) => del(`/judge-sets/${enc(id)}`),
  importSamples: (id: string, jsonl: string, mode: 'append' | 'replace') =>
    post<JudgeSetSummary>(`/judge-sets/${enc(id)}/import`, { jsonl, mode }),
  setFromRun:  (body: { run_id: string; name: string; limit: number }) => post<JudgeSetSummary>('/judge-sets/from-gen-run', body),
  task:        (id: string, rater: string) => get<BlindTask>(`/judge-sets/${enc(id)}/task`, { rater }),
  label:       (id: string, rater: string, sampleId: string, label: HumanLabel) =>
    put<BlindTask>(`/judge-sets/${enc(id)}/labels/${enc(rater)}/${enc(sampleId)}`, label),
  clearLabels: (id: string, rater: string) => del<JudgeSetSummary>(`/judge-sets/${enc(id)}/labels/${enc(rater)}`),

  startJudgeRun: (body: { judge_id: string; set_id: string; repeats: number; temperature?: number | null; probe: 'standard' | 'consistency' }) =>
    post<Job>('/judge-runs', body),
  verbosity: (body: { judge_id: string; set_id: string; padding: string; limit?: number | null; rater?: string | null; with_faithfulness: boolean }) =>
    post<Job>('/judge-runs/verbosity', body),
  position:  (body: { judge_id: string; set_id: string; rater?: string | null; identical: number; limit?: number | null }) =>
    post<Job>('/judge-runs/position', body),
  judgeRuns: (setId?: string | null) => get<JudgeRunSummary[]>('/judge-runs', { set_id: setId ?? undefined }),
  judgeRun:  (id: string) => get<JudgeRun>(`/judge-runs/${enc(id)}`),
  validation: (setId: string, runId: string, rater: string) =>
    get<ValidationReport>(`/judge-sets/${enc(setId)}/validation`, { run_id: runId, rater }),
  drift: (a: string, b: string, rater?: string | null) => get<DriftReport>('/judge-runs/drift', { a, b, rater: rater ?? undefined }),

  policies:     () => get<GatePolicy[]>('/gate/policies'),
  savePolicy:   (p: GatePolicy) => put<GatePolicy>(`/gate/policies/${enc(p.id)}`, p),
  resetPolicy:  (id: string) => post<GatePolicy>(`/gate/policies/${enc(id)}/reset`),
  gateRuns:     (datasetId?: string | null) => get<GateRunRow[]>('/gate/runs', { dataset_id: datasetId ?? undefined }),
  baselines:    () => get<Record<string, Record<string, { run_id: string; note: string; promoted_at: string }>>>('/gate/baselines'),
  promote:      (policyId: string, runId: string, note = '') => put(`/gate/baselines/${enc(policyId)}`, { run_id: runId, note }),
  evaluate:     (body: { policy_id: string; candidate_run: string; baseline_run?: string | null }) => post<GateResult>('/gate/evaluate', body),
  recordDecision: (body: { policy_id: string; candidate_run: string; baseline_run?: string | null; override_reason?: string; author?: string }) =>
    post<GateDecision>('/gate/decisions', body),
  decisions:    () => get<GateDecision[]>('/gate/decisions'),
  exportGate:   (body: { policy_id: string; candidate_run: string; baseline_run?: string | null }) => post<GateSnapshot>('/gate/export', body),
  snapshot:     () => get<GateSnapshot>('/gate/export'),
};
