import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type ListDocumentsParams } from '@/api/documents.api';
import { useUIStore } from '@/store/ui.store';
import type { UploadDocumentInput } from '@/types/document';

export const documentKeys = {
  all:    ['documents'] as const,
  list:   (params?: ListDocumentsParams) => [...documentKeys.all, 'list', params] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

export function useDocuments(params?: ListDocumentsParams) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn:  () => documentsApi.list(params),
  });
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: documentKeys.detail(documentId),
    queryFn:  () => documentsApi.get(documentId),
    enabled:  !!documentId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: UploadDocumentInput) =>
      documentsApi.upload(input, crypto.randomUUID()),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      addToast({ type: 'success', message: 'Document uploaded successfully.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Upload failed. Please try again.' });
    },
  });
}

export function useArchiveDocument() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.archive(documentId),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      addToast({ type: 'success', message: 'Document archived.' });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      addToast({ type: 'success', message: 'Document deleted.' });
    },
  });
}
