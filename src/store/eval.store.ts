import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Evaluation workspace selection — which dataset version every Evaluation tab is
 * looking at, plus the background jobs (indexing, runs) the tray is tracking.
 * Persisted so a reload keeps you on the same dataset.
 */
interface EvalState {
  datasetId:  string | null;
  version:    number | null;
  experimentId: string | null;
  jobs:       string[];

  select(datasetId: string | null, version: number | null): void;
  selectExperiment(id: string | null): void;
  trackJob(id: string): void;
  untrackJob(id: string): void;
}

export const useEvalStore = create<EvalState>()(
  persist(
    (set) => ({
      datasetId:    null,
      version:      null,
      experimentId: null,
      jobs:         [],

      select: (datasetId, version) => set({ datasetId, version }),
      selectExperiment: (experimentId) => set({ experimentId }),
      trackJob:   (id) => set((s) => ({ jobs: s.jobs.includes(id) ? s.jobs : [...s.jobs, id] })),
      untrackJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j !== id) })),
    }),
    { name: 'bw_eval', partialize: (s) => ({ datasetId: s.datasetId, version: s.version, experimentId: s.experimentId }) },
  ),
);
