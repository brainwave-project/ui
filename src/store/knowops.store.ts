import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Know Ops governance store — the single source of truth for RAG knobs the
 * operator controls from the UI. Persisted to localStorage so a tuned retrieval
 * profile survives reloads.
 *
 * Honesty note: `topK`, `minScore` and `hybrid` are sent verbatim to
 * /semantic/search and therefore *do* change live results. The chunking fields
 * are an operator-facing *policy intent* — the know-hub worker owns the actual
 * split (512-token window / 64 overlap by default), so these are surfaced as the
 * proposed policy applied on the next (re)index, not a live server mutation.
 */

export type ChunkStrategy = 'fixed' | 'sentence' | 'recursive';

export interface KnowOpsState {
  /* Retrieval governance — live, sent to /semantic/search */
  topK:     number;
  minScore: number;
  hybrid:   boolean;

  /* Ingestion policy — proposed; applied by the worker on (re)index */
  chunkStrategy: ChunkStrategy;
  chunkSize:     number;   // tokens per window
  chunkOverlap:  number;   // token overlap between windows

  setTopK(v: number): void;
  setMinScore(v: number): void;
  setHybrid(v: boolean): void;
  setChunkStrategy(v: ChunkStrategy): void;
  setChunkSize(v: number): void;
  setChunkOverlap(v: number): void;
  resetRetrieval(): void;
  resetIngestion(): void;
}

/** Server-side defaults mirrored from know-hub env (read-only baseline). */
export const SERVER_DEFAULTS = {
  topK:     8,
  minScore: 0.6,
  hybrid:   true,
  chunkStrategy: 'fixed' as ChunkStrategy,
  chunkSize:     512,
  chunkOverlap:  64,
  embedModel:    'nomic-embed-text',
  embedDims:     768,
  metric:        'cosine',
} as const;

export const useKnowOpsStore = create<KnowOpsState>()(
  persist(
    (set) => ({
      topK:     SERVER_DEFAULTS.topK,
      minScore: SERVER_DEFAULTS.minScore,
      hybrid:   SERVER_DEFAULTS.hybrid,

      chunkStrategy: SERVER_DEFAULTS.chunkStrategy,
      chunkSize:     SERVER_DEFAULTS.chunkSize,
      chunkOverlap:  SERVER_DEFAULTS.chunkOverlap,

      setTopK:         (v) => set({ topK: Math.max(1, Math.min(50, Math.round(v))) }),
      setMinScore:     (v) => set({ minScore: Math.max(0, Math.min(0.95, v)) }),
      setHybrid:       (v) => set({ hybrid: v }),
      setChunkStrategy:(v) => set({ chunkStrategy: v }),
      setChunkSize:    (v) => set({ chunkSize: Math.max(64, Math.min(2048, Math.round(v))) }),
      setChunkOverlap: (v) => set({ chunkOverlap: Math.max(0, Math.min(512, Math.round(v))) }),

      resetRetrieval: () =>
        set({
          topK:     SERVER_DEFAULTS.topK,
          minScore: SERVER_DEFAULTS.minScore,
          hybrid:   SERVER_DEFAULTS.hybrid,
        }),
      resetIngestion: () =>
        set({
          chunkStrategy: SERVER_DEFAULTS.chunkStrategy,
          chunkSize:     SERVER_DEFAULTS.chunkSize,
          chunkOverlap:  SERVER_DEFAULTS.chunkOverlap,
        }),
    }),
    { name: 'bw_knowops' },
  ),
);
