import { evalClient } from './eval.api';
import type { Job } from '@/types/eval';
import type {
  NormalizationConfig, NormalizationDataset, NormalizationOptions, NormalizationQueryPage,
  NormalizationReport, NormalizationRunSummary, NormalizationPassage,
} from '@/types/evalNormalization';

const base = '/normalization';
const runPath = (id: string) => `${base}/runs/${encodeURIComponent(id)}`;

export const evalNormalizationApi = {
  options: () => evalClient.get<NormalizationOptions>(`${base}/options`).then((r) => r.data),
  datasets: () => evalClient.get<NormalizationDataset[]>(`${base}/datasets`).then((r) => r.data),
  importDataset: (body: unknown) =>
    evalClient.post<NormalizationDataset>(`${base}/datasets/import`, body).then((r) => r.data),
  runs: (datasetId: string) => evalClient.get<NormalizationRunSummary[]>(`${base}/runs`, {
    params: { dataset_id: datasetId },
  }).then((r) => r.data),
  start: (body: { dataset_id: string; config: NormalizationConfig }) =>
    evalClient.post<Job>(`${base}/runs`, body).then((r) => r.data),
  run: (id: string) => evalClient.get<NormalizationReport>(runPath(id)).then((r) => r.data),
  queries: (id: string, condition: number, offset: number, limit = 1, qid?: string) =>
    evalClient.get<NormalizationQueryPage>(`${runPath(id)}/queries`, {
      params: { condition, offset, limit, ranking_limit: 10, qid: qid || undefined },
    }).then((r) => r.data),
  passage: (id: string, condition: number, passageId: string) =>
    evalClient.get<NormalizationPassage>(`${runPath(id)}/passage`, {
      params: { condition, passage_id: passageId },
    }).then((r) => r.data),
  export: (id: string) => evalClient.get<Blob>(`${runPath(id)}/export`, {
    responseType: 'blob',
  }).then((r) => r.data),
};
