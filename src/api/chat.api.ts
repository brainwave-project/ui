import { apiClient } from './client';
import { useAuthStore } from '@/store/auth.store';
import type {
  ChatSession,
  SessionsResponse,
  MessagesResponse,
  ChatMessage,
  Citation,
  ChatStreamCallbacks,
} from '@/types/chat';

export const chatApi = {
  listSessions(): Promise<ChatSession[]> {
    return apiClient.get<SessionsResponse>('/chat/sessions').then((r) => r.data.sessions);
  },

  createSession(title?: string): Promise<ChatSession> {
    return apiClient.post<ChatSession>('/chat/sessions', title ? { title } : {}).then((r) => r.data);
  },

  renameSession(id: string, title: string): Promise<ChatSession> {
    return apiClient.patch<ChatSession>(`/chat/sessions/${id}`, { title }).then((r) => r.data);
  },

  deleteSession(id: string): Promise<void> {
    return apiClient.delete(`/chat/sessions/${id}`).then(() => undefined);
  },

  getMessages(id: string): Promise<ChatMessage[]> {
    return apiClient.get<MessagesResponse>(`/chat/sessions/${id}/messages`).then((r) => r.data.messages);
  },

  /**
   * Send a question and stream the grounded answer over SSE.
   *
   * Uses the streaming fetch reader (not bare EventSource, which can't send a
   * POST body or Authorization header — TDD §9.4). Returns an `abort` function:
   * calling it cancels the request, and the know-hub handler detects the closed
   * connection and aborts the Ollama stream, freeing the GPU immediately.
   */
  streamMessage(sessionId: string, content: string, cb: ChatStreamCallbacks): () => void {
    const controller = new AbortController();

    (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          cb.onError(res.status === 401 ? 'unauthorized' : `http_${res.status}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            dispatchFrame(frame, cb);
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') cb.onError('stream_failed');
      }
    })();

    return () => controller.abort();
  },
};

/** Parse one `event:`/`data:` SSE frame and route it to the right callback. */
function dispatchFrame(frame: string, cb: ChatStreamCallbacks): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }

  switch (event) {
    case 'token':
      cb.onToken((data as { value: string }).value);
      break;
    case 'citations':
      cb.onCitations((data as { sources: Citation[] }).sources);
      break;
    case 'done':
      cb.onDone((data as { messageId: string }).messageId);
      break;
    case 'error':
      cb.onError((data as { message: string }).message);
      break;
  }
}
