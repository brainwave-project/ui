import { apiClient } from './client';

export interface DocumentNote {
  id:         string;
  documentId: string;
  ownerId:    string;
  body:       string;
  createdAt:  string;
  updatedAt:  string;
}

interface NoteListResponse {
  items: DocumentNote[];
}

export const notesApi = {
  listForDocument(documentId: string): Promise<DocumentNote[]> {
    return apiClient
      .get<NoteListResponse>(`/documents/${documentId}/notes`)
      .then((r) => r.data.items);
  },

  add(documentId: string, body: string): Promise<DocumentNote> {
    return apiClient
      .post<DocumentNote>(`/documents/${documentId}/notes`, { body })
      .then((r) => r.data);
  },

  update(noteId: string, body: string): Promise<DocumentNote> {
    return apiClient
      .patch<DocumentNote>(`/notes/${noteId}`, { body })
      .then((r) => r.data);
  },

  delete(noteId: string): Promise<void> {
    return apiClient
      .delete(`/notes/${noteId}`)
      .then(() => undefined);
  },
};
