import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { genApi } from '@/api/evalGen.api';
import { useJob } from '@/features/evaluation/hooks/useEval';
import { useEvalStore } from '@/store/eval.store';

/** Query keys for the generation half. Every key starts with 'eval' so job completion refreshes it. */
export const genKeys = {
  config:     ['eval', 'gen', 'config'] as const,
  scenarios:  ['eval', 'gen', 'scenarios'] as const,
  runs:       (d?: string | null) => ['eval', 'gen', 'runs', d ?? ''] as const,
  run:        (id: string) => ['eval', 'gen', 'run', id] as const,
  judges:     ['eval', 'judge', 'judges'] as const,
  sets:       ['eval', 'judge', 'sets'] as const,
  set:        (id: string) => ['eval', 'judge', 'set', id] as const,
  task:       (id: string, rater: string) => ['eval', 'judge', 'task', id, rater] as const,
  judgeRuns:  (setId?: string | null) => ['eval', 'judge', 'runs', setId ?? ''] as const,
  judgeRun:   (id: string) => ['eval', 'judge', 'run', id] as const,
  policies:   ['eval', 'gate', 'policies'] as const,
  gateRuns:   (d?: string | null) => ['eval', 'gate', 'runs', d ?? ''] as const,
  baselines:  ['eval', 'gate', 'baselines'] as const,
  decisions:  ['eval', 'gate', 'decisions'] as const,
  snapshot:   ['eval', 'gate', 'snapshot'] as const,
};

export const useGenConfig = () => useQuery({ queryKey: genKeys.config, queryFn: genApi.config, staleTime: 60_000, retry: false });
export const useScenarios = () => useQuery({ queryKey: genKeys.scenarios, queryFn: genApi.scenarios, staleTime: Infinity, retry: false });

export function useGenRuns() {
  const datasetId = useEvalStore((s) => s.datasetId);
  return useQuery({ queryKey: genKeys.runs(datasetId), queryFn: () => genApi.runs(datasetId), retry: false,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'running') ? 3_000 : false) });
}

export function useGenRun(id: string | null) {
  return useQuery({ queryKey: genKeys.run(id ?? ''), queryFn: () => genApi.run(id!), enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 3_000 : false) });
}

export const useJudges = () => useQuery({ queryKey: genKeys.judges, queryFn: genApi.judges, retry: false });
export const useJudgeSets = () => useQuery({ queryKey: genKeys.sets, queryFn: genApi.sets, retry: false });
export const useJudgeSet = (id: string | null) =>
  useQuery({ queryKey: genKeys.set(id ?? ''), queryFn: () => genApi.set(id!), enabled: !!id });
export const useJudgeRuns = (setId: string | null) =>
  useQuery({ queryKey: genKeys.judgeRuns(setId), queryFn: () => genApi.judgeRuns(setId), retry: false });
export const useJudgeRun = (id: string | null) =>
  useQuery({ queryKey: genKeys.judgeRun(id ?? ''), queryFn: () => genApi.judgeRun(id!), enabled: !!id });

export const usePolicies = () => useQuery({ queryKey: genKeys.policies, queryFn: genApi.policies, retry: false });
export function useGateRuns() {
  const datasetId = useEvalStore((s) => s.datasetId);
  return useQuery({ queryKey: genKeys.gateRuns(datasetId), queryFn: () => genApi.gateRuns(datasetId), retry: false });
}
export const useBaselines = () => useQuery({ queryKey: genKeys.baselines, queryFn: genApi.baselines, retry: false });
export const useDecisions = () => useQuery({ queryKey: genKeys.decisions, queryFn: genApi.decisions, retry: false });
export const useSnapshot = () => useQuery({ queryKey: genKeys.snapshot, queryFn: genApi.snapshot, retry: false });

/** Track one background job from this component; returns its id, state and a setter for new jobs. */
export function useTrackedJob() {
  const [jobId, setJobId] = useState<string | null>(null);
  const trackJob = useEvalStore((s) => s.trackJob);
  const job = useJob(jobId);
  const start = (id: string) => { setJobId(id); trackJob(id); };
  return { jobId, job: job.data, start, running: job.data?.status === 'running' };
}
