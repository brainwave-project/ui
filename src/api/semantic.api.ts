import { apiClient } from './client';
import type {
  SearchParams,
  SearchResponse,
  EmbeddingStatusResponse,
} from '@/types/semantic';

export const semanticApi = {
  search(params: SearchParams): Promise<SearchResponse> {
    const { q, hybrid = true, minScore, limit = 10, offset = 0 } = params;
    return apiClient
      .get<SearchResponse>('/semantic/search', {
        params: { q, hybrid, minScore, limit, offset },
      })
      .then((r) => r.data);
  },

  similar(documentId: string, limit = 6): Promise<SearchResponse> {
    return apiClient
      .get<SearchResponse>(`/semantic/similar/${documentId}`, { params: { limit } })
      .then((r) => r.data);
  },

  status(documentId: string): Promise<EmbeddingStatusResponse> {
    return apiClient
      .get<EmbeddingStatusResponse>(`/semantic/status/${documentId}`)
      .then((r) => r.data);
  },

  reindex(documentId: string): Promise<EmbeddingStatusResponse> {
    return apiClient
      .post<EmbeddingStatusResponse>(`/semantic/reindex/${documentId}`)
      .then((r) => r.data);
  },
};
