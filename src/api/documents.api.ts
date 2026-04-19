import { apiClient } from './client';
import type {
  Document,
  DocumentListResponse,
  UploadDocumentInput,
  DocumentState,
} from '@/types/document';

export interface ListDocumentsParams {
  limit?:  number;
  page?:   number;   // 1-based; API receives offset = (page-1)*limit
  offset?: number;
  state?:  DocumentState;
}

export const documentsApi = {
  list(params?: ListDocumentsParams): Promise<DocumentListResponse> {
    const { page, limit = 10, ...rest } = params ?? {};
    const offset = page != null ? (page - 1) * limit : (rest.offset ?? 0);

    return apiClient
      .get<DocumentListResponse>('/documents', {
        params: { limit, offset, ...rest },
      })
      .then((r) => r.data);
  },

  get(documentId: string): Promise<Document> {
    return apiClient
      .get<Document>(`/documents/${documentId}`)
      .then((r) => r.data);
  },

  upload(
    input: UploadDocumentInput,
    idempotencyKey?: string,
  ): Promise<Document> {
    const form = new FormData();
    form.append('file', input.file);
    form.append('title', input.title);
    if (input.mimeType) form.append('mimeType', input.mimeType);
    if (input.tags?.length) form.append('tags', JSON.stringify(input.tags));
    if (input.payloadEngine) form.append('payloadEngine', input.payloadEngine);

    return apiClient
      .post<Document>('/documents', form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      })
      .then((r) => r.data);
  },

  archive(documentId: string): Promise<Document> {
    return apiClient
      .patch<Document>(`/documents/${documentId}/archive`)
      .then((r) => r.data);
  },

  delete(documentId: string): Promise<void> {
    return apiClient
      .delete(`/documents/${documentId}`)
      .then(() => undefined);
  },
};
