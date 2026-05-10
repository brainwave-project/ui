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
    return new Promise<Document>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;

          let payload: Record<string, unknown> | undefined;
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              payload = parsed as Record<string, unknown>;
            } else {
              payload = { content: parsed };
            }
          } catch {
            // not JSON — store as raw text
            payload = { content: text };
          }

          const body = {
            title:         input.title,
            payloadEngine: input.payloadEngine ?? 'mongo',
            mimeType:      input.mimeType ?? (input.file.type || 'application/octet-stream'),
            sizeBytes:     input.file.size,
            payload,
          };

          const res = await apiClient.post<Document>('/documents', body, {
            headers: {
              ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            },
          });
          resolve(res.data);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(input.file);
    });
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
