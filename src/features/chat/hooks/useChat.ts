import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/api/chat.api';
import { useUIStore } from '@/store/ui.store';
import type { ChatSession } from '@/types/chat';

export const chatKeys = {
  all:      ['chat'] as const,
  sessions: () => [...chatKeys.all, 'sessions'] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: chatKeys.sessions(),
    queryFn:  () => chatApi.listSessions(),
    staleTime: 30_000,
  });
}

export function useMessages(sessionId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(sessionId ?? '∅'),
    queryFn:  () => chatApi.getMessages(sessionId!),
    enabled:  !!sessionId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => chatApi.createSession(title),
    onSuccess(session: ChatSession) {
      qc.setQueryData<ChatSession[]>(chatKeys.sessions(), (prev) =>
        prev ? [session, ...prev] : [session],
      );
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  return useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess(_data, id) {
      qc.setQueryData<ChatSession[]>(chatKeys.sessions(), (prev) =>
        prev ? prev.filter((s) => s.id !== id) : prev,
      );
      qc.removeQueries({ queryKey: chatKeys.messages(id) });
      addToast({ type: 'info', message: 'Conversation deleted.' });
    },
    onError() {
      addToast({ type: 'error', message: 'Could not delete conversation.' });
    },
  });
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.renameSession(id, title),
    onSuccess(session: ChatSession) {
      qc.setQueryData<ChatSession[]>(chatKeys.sessions(), (prev) =>
        prev ? prev.map((s) => (s.id === session.id ? session : s)) : prev,
      );
    },
  });
}
