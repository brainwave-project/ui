import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { semanticApi } from '@/api/semantic.api';
import { useUIStore } from '@/store/ui.store';
import type { SearchParams } from '@/types/semantic';

export const semanticKeys = {
  all:     ['semantic'] as const,
  search:  (params: SearchParams) => [...semanticKeys.all, 'search', params] as const,
  similar: (id: string) => [...semanticKeys.all, 'similar', id] as const,
  status:  (id: string) => [...semanticKeys.all, 'status', id] as const,
};

/** Run a search only when a non-empty query is provided. */
export function useSemanticSearch(params: SearchParams, enabled = true) {
  const hasQuery = params.q.trim().length > 0;
  return useQuery({
    queryKey: semanticKeys.search(params),
    queryFn:  () => semanticApi.search(params),
    enabled:  enabled && hasQuery,
    staleTime: 60_000,            // query vectors are cached server-side too
    placeholderData: (prev) => prev,
  });
}

export function useSimilarDocuments(documentId: string, limit = 6) {
  return useQuery({
    queryKey: semanticKeys.similar(documentId),
    queryFn:  () => semanticApi.similar(documentId, limit),
    enabled:  !!documentId,
  });
}

export function useEmbeddingStatus(documentId: string, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: semanticKeys.status(documentId),
    queryFn:  () => semanticApi.status(documentId),
    enabled:  !!documentId,
    // Poll while indexing is in flight so the badge resolves live.
    refetchInterval: (query) => {
      if (!options?.poll) return false;
      const status = query.state.data?.embeddingStatus;
      return status === 'PENDING' || status === 'INDEXING' ? 3_000 : false;
    },
  });
}

export function useReindexDocument() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (documentId: string) => semanticApi.reindex(documentId),
    onSuccess(data) {
      qc.invalidateQueries({ queryKey: semanticKeys.status(data.documentId) });
      qc.invalidateQueries({ queryKey: semanticKeys.all });
      addToast({
        type: data.embeddingStatus === 'FAILED' ? 'error' : 'success',
        message: `Reindex finished — status: ${data.embeddingStatus}.`,
      });
    },
    onError() {
      addToast({ type: 'error', message: 'Reindex failed. Please try again.' });
    },
  });
}
