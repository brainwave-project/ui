import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { evalApi, evalErrorMessage } from '@/api/eval.api';
import { useEvalStore } from '@/store/eval.store';
import { useUIStore } from '@/store/ui.store';
import type { DatasetBundle, Split } from '@/types/eval';

export const evalKeys = {
  status:      ['eval', 'status'] as const,
  datasets:    ['eval', 'datasets'] as const,
  version:     (id: string, v: number) => ['eval', 'dataset', id, v] as const,
  readiness:   (id: string, v: number, k: number, sd?: number) => ['eval', 'readiness', id, v, k, sd] as const,
  chunks:      (id: string, v: number, doc: string, t: number, o: number) => ['eval', 'chunks', id, v, doc, t, o] as const,
  job:         (id: string) => ['eval', 'job', id] as const,
  runs:        (datasetId?: string) => ['eval', 'runs', datasetId] as const,
  run:         (id: string) => ['eval', 'run', id] as const,
  experiments: ['eval', 'experiments'] as const,
  experiment:  (id: string) => ['eval', 'experiment', id] as const,
  report:      (id: string, split: Split) => ['eval', 'report', id, split] as const,
};

export function useEvalStatus() {
  return useQuery({
    queryKey: evalKeys.status,
    queryFn: evalApi.status,
    refetchInterval: 15_000,
    retry: false,
  });
}

export function useDatasets() {
  return useQuery({ queryKey: evalKeys.datasets, queryFn: evalApi.datasets, retry: false });
}

/** The dataset version every Evaluation tab is working on. */
export function useSelectedDataset() {
  const { datasetId, version } = useEvalStore();
  const query = useQuery({
    queryKey: evalKeys.version(datasetId ?? '', version ?? 0),
    queryFn: () => evalApi.version(datasetId!, version!),
    enabled: !!datasetId && !!version,
    retry: false,
  });
  return { datasetId, version, ...query };
}

export function useReadiness(k: number, scoreSd?: number) {
  const { datasetId, version } = useEvalStore();
  return useQuery({
    queryKey: evalKeys.readiness(datasetId ?? '', version ?? 0, k, scoreSd),
    queryFn: () => evalApi.readiness(datasetId!, version!, k, scoreSd),
    enabled: !!datasetId && !!version,
  });
}

export function useChunks(docId: string | null, maxTokens: number, overlap: number) {
  const { datasetId, version } = useEvalStore();
  return useQuery({
    queryKey: evalKeys.chunks(datasetId ?? '', version ?? 0, docId ?? '', maxTokens, overlap),
    queryFn: () => evalApi.chunks(datasetId!, version!, docId!, maxTokens, overlap),
    enabled: !!datasetId && !!version && !!docId,
  });
}

/**
 * Wraps a dataset mutation that returns the updated bundle: writes the bundle
 * straight into the cache and invalidates everything derived from it.
 */
export function useDatasetMutation<TVars>(
  fn: (vars: TVars) => Promise<DatasetBundle>,
  success?: string,
) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const select = useEvalStore((s) => s.select);
  return useMutation({
    mutationFn: fn,
    onSuccess(bundle) {
      qc.setQueryData(evalKeys.version(bundle.meta.id, bundle.manifest.version), bundle);
      qc.invalidateQueries({ queryKey: evalKeys.datasets });
      qc.invalidateQueries({ queryKey: ['eval', 'readiness', bundle.meta.id] });
      qc.invalidateQueries({ queryKey: ['eval', 'chunks', bundle.meta.id] });
      select(bundle.meta.id, bundle.manifest.version);
      if (success) addToast({ type: 'success', message: success });
    },
    onError(err) {
      addToast({ type: 'error', message: evalErrorMessage(err) });
    },
  });
}

/** Generic mutation with toast-on-error and caller-chosen invalidation. */
export function useEvalMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { success?: string; invalidate?: readonly unknown[][]; onSuccess?: (data: TData) => void } = {},
) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: fn,
    onSuccess(data) {
      opts.invalidate?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      if (opts.success) addToast({ type: 'success', message: opts.success });
      opts.onSuccess?.(data);
    },
    onError(err) {
      addToast({ type: 'error', message: evalErrorMessage(err) });
    },
  });
}

/** Poll a background job; when it settles, refresh whatever it produced. */
export function useJob(jobId: string | null) {
  const qc = useQueryClient();
  const untrack = useEvalStore((s) => s.untrackJob);
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({
    queryKey: evalKeys.job(jobId ?? ''),
    queryFn: () => evalApi.job(jobId!),
    enabled: !!jobId,
    retry: false,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 1_000 : false),
  });
  const status = query.data?.status;
  useEffect(() => {
    if (!jobId || !status || status === 'running') return;
    qc.invalidateQueries({ queryKey: ['eval', 'dataset'] });
    qc.invalidateQueries({ queryKey: ['eval', 'readiness'] });
    qc.invalidateQueries({ queryKey: ['eval', 'runs'] });
    qc.invalidateQueries({ queryKey: ['eval', 'experiment'] });
    qc.invalidateQueries({ queryKey: evalKeys.experiments });
    qc.invalidateQueries({ queryKey: ['eval', 'report'] });
    qc.invalidateQueries({ queryKey: ['eval', 'pool'] });
    qc.invalidateQueries({ queryKey: ['eval', 'candidates'] });
    qc.invalidateQueries({ queryKey: ['eval', 'gen'] });
    qc.invalidateQueries({ queryKey: ['eval', 'judge'] });
    qc.invalidateQueries({ queryKey: ['eval', 'gate'] });
    if (status === 'failed') addToast({ type: 'error', message: query.data?.error ?? 'Job failed' });
    untrack(jobId);
  }, [jobId, status]); // eslint-disable-line react-hooks/exhaustive-deps
  return query;
}

export function useRuns(datasetId?: string | null) {
  return useQuery({
    queryKey: evalKeys.runs(datasetId ?? undefined),
    queryFn: () => evalApi.runs(datasetId ?? undefined),
    enabled: !!datasetId,
  });
}

export function useRun(runId: string | null) {
  return useQuery({
    queryKey: evalKeys.run(runId ?? ''),
    queryFn: () => evalApi.run(runId!),
    enabled: !!runId,
  });
}

export function useExperiments() {
  return useQuery({ queryKey: evalKeys.experiments, queryFn: evalApi.experiments, retry: false });
}

export function useExperimentReport(id: string | null, split: Split, enabled: boolean) {
  return useQuery({
    queryKey: evalKeys.report(id ?? '', split),
    queryFn: () => evalApi.report(id!, split),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}
