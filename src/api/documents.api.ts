import { apiClient } from './client';
import type {
  Document,
  DocumentListResponse,
  UploadDocumentInput,
  DocumentState,
} from '@/types/document';

export interface ListDocumentsParams {
  limit?:  number;
  page?:   number;
  offset?: number;
  state?:  DocumentState;
}

export interface DownloadResponse {
  url?:     string;
  payload?: Record<string, unknown>;
}

export const documentsApi = {
  list(params?: ListDocumentsParams): Promise<DocumentListResponse> {
    const { page, limit = 10, ...rest } = params ?? {};
    const offset = page != null ? (page - 1) * limit : (rest.offset ?? 0);
    return apiClient
      .get<DocumentListResponse>('/documents', { params: { limit, offset, ...rest } })
      .then((r) => r.data);
  },

  get(documentId: string): Promise<Document> {
    return apiClient.get<Document>(`/documents/${documentId}`).then((r) => r.data);
  },

  upload(input: UploadDocumentInput, idempotencyKey?: string): Promise<Document> {
    const fd = new FormData();
    fd.append('file',          input.file);
    fd.append('title',         input.title);
    fd.append('payloadEngine', input.payloadEngine ?? 'minio');
    fd.append('mimeType',      input.mimeType ?? input.file.type ?? 'application/octet-stream');
    fd.append('sizeBytes',     String(input.file.size));
    if (input.note && input.note.trim().length > 0) {
      fd.append('note', input.note.trim());
    }
    return apiClient
      .post<Document>('/documents', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      })
      .then((r) => r.data);
  },

  download(documentId: string): Promise<DownloadResponse> {
    return apiClient
      .get<DownloadResponse>(`/documents/${documentId}/download`)
      .then((r) => r.data);
  },

  archive(documentId: string): Promise<Document> {
    return apiClient.patch<Document>(`/documents/${documentId}/archive`).then((r) => r.data);
  },

  delete(documentId: string): Promise<void> {
    return apiClient.delete(`/documents/${documentId}`).then(() => undefined);
  },
};
