import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/api/notes.api';
import { useUIStore } from '@/store/ui.store';

export const noteKeys = {
  all:           ['notes'] as const,
  forDocument:   (documentId: string) => [...noteKeys.all, 'forDocument', documentId] as const,
};

export function useNotes(documentId: string) {
  return useQuery({
    queryKey: noteKeys.forDocument(documentId),
    queryFn:  () => notesApi.listForDocument(documentId),
    enabled:  !!documentId,
  });
}

export function useAddNote(documentId: string) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: (body: string) => notesApi.add(documentId, body),
    onSuccess() {
      qc.invalidateQueries({ queryKey: noteKeys.forDocument(documentId) });
      addToast({ type: 'success', message: 'Note added.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Failed to add note.' });
    },
  });
}

export function useUpdateNote(documentId: string) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      notesApi.update(noteId, body),
    onSuccess() {
      qc.invalidateQueries({ queryKey: noteKeys.forDocument(documentId) });
      addToast({ type: 'success', message: 'Note updated.' });
    },
  });
}

export function useDeleteNote(documentId: string) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: (noteId: string) => notesApi.delete(noteId),
    onSuccess() {
      qc.invalidateQueries({ queryKey: noteKeys.forDocument(documentId) });
      addToast({ type: 'success', message: 'Note deleted.' });
    },
  });
}
