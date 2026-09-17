import axios from 'axios';
import type {
  AgreementReport, AnnotationTask, BootstrapDemo, CandidatesView, ChunkPreview, CltResult, CompareReport,
  CorpusDoc, CoverageResult, DatasetBundle, DatasetDiff, DatasetSummary, EvalStatus, Experiment,
  ExperimentInput, ExperimentReport, FailureReport, GoldenItem, Job, LearningPath, Normalization,
  PhackingResult, PoolView, PopulationSpec, PowerResult, ReadinessReport, Run, RunSummary, SearchRequest,
  SearchResponse, Split, SplitConfig, Sweeps, VariantSpec,
} from '@/types/eval';

/**
 * Eval Lab client — talks to agent-hub's standalone eval API (python -m agent_hub.eval.lab).
 *
 * Deliberately NOT the shared apiClient: the eval API is not behind Kong and takes
 * no JWT. It exists only on the lean eval stack (make evals-lab), reached through
 * the Vite dev proxy (/api/eval → :3005). Long timeout — reports and simulations
 * run thousands of resamples on the server.
 */
export const evalClient = axios.create({
  baseURL: '/api/eval',
  headers: { 'Content-Type': 'application/json' },
  timeout: 180_000,
});

/** Human-readable message from an eval API error (409 guards carry teaching text). */
export function evalErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data as
    | { detail?: unknown; problems?: string[] }
    | undefined;
  const detail = data?.detail as { problems?: string[]; detail?: string; errors?: string[] } | string | undefined;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    if (detail.problems) return detail.problems.join(' · ');
    if (detail.errors)   return detail.errors.join(' · ');
    if (detail.detail)   return detail.detail;
    if (Array.isArray(detail)) {
      return (detail as { msg?: string; loc?: unknown[] }[])
        .map((d) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg}`).join(' · ');
    }
  }
  return (err as Error)?.message ?? 'Request failed';
}

const ver = (id: string, version: number) => `/datasets/${encodeURIComponent(id)}/versions/${version}`;
const get = <T,>(url: string, params?: object) => evalClient.get<T>(url, { params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => evalClient.post<T>(url, body).then((r) => r.data);
const put = <T,>(url: string, body?: unknown) => evalClient.put<T>(url, body).then((r) => r.data);
const patch = <T,>(url: string, body?: unknown) => evalClient.patch<T>(url, body).then((r) => r.data);

export const evalApi = {
  status: () => get<EvalStatus>('/status'),
  job:    (id: string) => get<Job>(`/jobs/${id}`),

  /* Datasets */
  datasets:      () => get<DatasetSummary[]>('/datasets'),
  createDataset: (body: { name: string; id?: string; description?: string; lang?: string }) =>
    post<DatasetBundle>('/datasets', body),
  importBuiltin: (lang: 'en' | 'ar') => post<DatasetBundle>('/datasets/import-builtin', { lang }),
  version:       (id: string, version: number) => get<DatasetBundle>(ver(id, version)),
  putDoc: (id: string, version: number, doc: CorpusDoc) =>
    put<DatasetBundle>(`${ver(id, version)}/corpus/${encodeURIComponent(doc.doc_id)}`, doc),
  deleteDoc: (id: string, version: number, docId: string) =>
    evalClient.delete<DatasetBundle>(`${ver(id, version)}/corpus/${encodeURIComponent(docId)}`).then((r) => r.data),
  putItem: (id: string, version: number, item: GoldenItem) =>
    put<DatasetBundle>(`${ver(id, version)}/items/${encodeURIComponent(item.id)}`, item),
  deleteItem: (id: string, version: number, itemId: string) =>
    evalClient.delete<DatasetBundle>(`${ver(id, version)}/items/${encodeURIComponent(itemId)}`).then((r) => r.data),
  importItems: (id: string, version: number, jsonl: string, mode: 'append' | 'replace') =>
    post<DatasetBundle>(`${ver(id, version)}/items/import`, { jsonl, mode }),
  split:  (id: string, version: number, config: SplitConfig) =>
    post<{ summary: DatasetBundle['split_summary']; bundle: DatasetBundle }>(`${ver(id, version)}/split`, config),
  freeze: (id: string, version: number) => post<DatasetBundle>(`${ver(id, version)}/freeze`),
  fork:   (id: string, version: number, changelog: string) =>
    post<DatasetBundle>(`${ver(id, version)}/fork`, { changelog }),
  export: (id: string, version: number) =>
    get<{ golden_jsonl: string; content_hash: string }>(`${ver(id, version)}/export`),
  chunks: (id: string, version: number, docId: string, maxTokens: number, overlap: number) =>
    get<ChunkPreview>(`${ver(id, version)}/chunks/${encodeURIComponent(docId)}`, { max_tokens: maxTokens, overlap }),
  index: (id: string, version: number, normalization: Normalization) =>
    post<Job>(`${ver(id, version)}/index`, { normalization }),
  readiness: (id: string, version: number, k: number, scoreSd?: number) =>
    get<ReadinessReport>(`${ver(id, version)}/readiness`, { k, score_sd: scoreSd }),
  diff: (id: string, from: number, to: number) =>
    get<DatasetDiff>(`/datasets/${encodeURIComponent(id)}/diff`, { from, to }),

  /* Pooled judging */
  pool:      (id: string, version: number) => get<PoolView>(`${ver(id, version)}/pool`),
  startPool: (id: string, version: number, depth: number) => post<Job>(`${ver(id, version)}/pool`, { depth }),
  judge: (id: string, version: number, body: { item_id: string; doc_id: string; grade: number; clear?: boolean }) =>
    post<DatasetBundle>(`${ver(id, version)}/judge`, body),
  simulateJudge: (id: string, version: number, itemId?: string) =>
    post<DatasetBundle>(`${ver(id, version)}/judge/simulate`, itemId ? { item_id: itemId } : {}),

  /* Label audit */
  annotations: (id: string, version: number) =>
    get<{ annotators: Record<string, number>; raters: string[] }>(`${ver(id, version)}/annotations`),
  renameAnnotator: (id: string, version: number, annotator: string, name: string) =>
    patch<{ annotators: Record<string, number>; raters: string[]; annotator: string }>(
      `${ver(id, version)}/annotations/${encodeURIComponent(annotator)}`,
      { name },
    ),
  simulateAudit: (id: string, version: number, body: { annotator: string; sample: number; agreement?: number; seed?: number }) =>
    post<{ annotator: string; annotated: number; simulated: boolean }>(`${ver(id, version)}/annotations/simulate`, body),
  annotationTask: (id: string, version: number, annotator: string, sample: number, seed: number) =>
    get<AnnotationTask>(`${ver(id, version)}/annotations/task`, { annotator, sample, seed }),
  annotate: (id: string, version: number, annotator: string, itemId: string, grades: Record<string, number>, seconds: number) =>
    put<{ annotated: number }>(`${ver(id, version)}/annotations/${encodeURIComponent(annotator)}/${encodeURIComponent(itemId)}`, { grades, seconds }),
  agreement: (id: string, version: number, a: string, b: string) =>
    get<AgreementReport>(`${ver(id, version)}/agreement`, { a, b }),

  /* Synthetic generation */
  generate: (id: string, version: number, body: { doc_ids?: string[] | null; per_doc: number; style: string; temperature: number; seed: number }) =>
    post<Job>(`${ver(id, version)}/generate`, body),
  candidates: (id: string, version: number) => get<CandidatesView>(`${ver(id, version)}/candidates`),
  acceptCandidate: (id: string, version: number, cid: string, body: { query?: string; evidence?: string; difficulty?: string; split?: Split | null }) =>
    post<DatasetBundle>(`${ver(id, version)}/candidates/${cid}/accept`, body),
  rejectCandidate: (id: string, version: number, cid: string, reason: string) =>
    post<CandidatesView>(`${ver(id, version)}/candidates/${cid}/reject`, { reason }),

  /* Retrieval */
  search: (body: SearchRequest) => post<SearchResponse>('/search', body),
  runs:   (datasetId?: string) => get<RunSummary[]>('/runs', { dataset_id: datasetId }),
  run:    (id: string) => get<Run>(`/runs/${id}`),
  adhocRun: (body: { dataset_id: string; version: number; variant: VariantSpec; split: 'dev' | 'all'; k: number }) =>
    post<Job>('/runs', body),
  compare: (runA: string, runB: string, confidence = 0.95) =>
    post<CompareReport>('/compare', { run_a: runA, run_b: runB, confidence }),
  sweeps:   (runId: string, maxK = 20) => get<Sweeps>(`/runs/${runId}/sweeps`, { max_k: maxK }),
  failures: (runId: string, metric: string, threshold: number) =>
    get<FailureReport>(`/runs/${runId}/failures`, { metric, threshold }),
  tagFailure: (runId: string, itemId: string, tags: string[], note: string) =>
    put<{ tags: string[]; note: string }>(`/runs/${runId}/failures/${encodeURIComponent(itemId)}`, { tags, note }),

  /* Experiments */
  experiments:      () => get<Experiment[]>('/experiments'),
  experiment:       (id: string) => get<Experiment>(`/experiments/${id}`),
  createExperiment: (body: ExperimentInput) => post<Experiment>('/experiments', body),
  updateExperiment: (id: string, body: ExperimentInput) => put<Experiment>(`/experiments/${id}`, body),
  deleteExperiment: (id: string) => evalClient.delete(`/experiments/${id}`).then((r) => r.data),
  register:         (id: string) => post<Experiment>(`/experiments/${id}/register`),
  runExperiment:    (id: string, split: Split, reason: string) =>
    post<Job>(`/experiments/${id}/runs`, { split, reason }),
  report:           (id: string, split: Split) => get<ExperimentReport>(`/experiments/${id}/report`, { split }),
  conclude:         (id: string, note: string) => post<Experiment>(`/experiments/${id}/conclude`, { note }),

  /* Stats Lab */
  statsBootstrap: (body: { population: PopulationSpec; n?: number | null; resamples: number; confidence: number; seed: number }) =>
    post<BootstrapDemo>('/stats/bootstrap', body),
  statsCoverage: (body: { population: PopulationSpec; n: number; sims: number; resamples: number; confidence: number; seed: number }) =>
    post<CoverageResult>('/stats/coverage', body),
  statsClt: (body: { population: PopulationSpec; ns: number[]; sims: number; seed: number }) =>
    post<CltResult>('/stats/clt', body),
  statsPower: (body: { n: number; effect: number; discordance: number; sims: number; resamples: number; confidence: number; seed: number }) =>
    post<PowerResult>('/stats/power', body),
  statsPhacking: (body: { n: number; metrics: number; sims: number; confidence: number; discordance: number; correlation: number; batch: number; seed: number }) =>
    post<PhackingResult>('/stats/phacking', body),

  /* Learning Path */
  learning:      () => get<LearningPath>('/learning'),
  updateMission: (id: string, done: boolean, reflection: string) =>
    put<{ done: boolean; reflection: string }>(`/learning/${id}`, { done, reflection }),
};
