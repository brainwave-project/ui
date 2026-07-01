import { useAuthStore } from '@/store/auth.store';
import type { AgentCitation, AgentRunStatus, AgentStreamCallbacks } from '@/types/agent';

/**
 * AgentHub CRAG client. Same streaming-fetch-reader approach as chatApi
 * (EventSource can't send a POST body or Authorization header), pointed at the
 * /api/agent SSE route and extended with the agent's node-lifecycle events
 * (node_enter / decision / token / citation / done) — TDD §11.3.
 *
 * Returns an `abort` function: calling it cancels the request, and agent-hub
 * detects the closed connection and tears the run down.
 */
export const agentApi = {
  streamReasoning(sessionId: string, message: string, cb: AgentStreamCallbacks): () => void {
    const controller = new AbortController();

    (async () => {
      try {
        const token = useAuthStore.getState().accessToken;
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message, sessionId }),
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

/** Parse one SSE frame and route it to the matching callback. */
function dispatchFrame(frame: string, cb: AgentStreamCallbacks): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }

  switch (event) {
    case 'node_enter':
      cb.onNodeEnter(data.node as string, data.seq as number);
      break;
    case 'decision':
      cb.onDecision(data.node as string, data.choice as string);
      break;
    case 'token':
      cb.onToken(data.text as string);
      break;
    case 'citation':
      cb.onCitation(data as unknown as AgentCitation);
      break;
    case 'done':
      cb.onDone(data.runId as string, data.status as AgentRunStatus, data.loops as number);
      break;
    case 'error':
      cb.onError((data.message as string) ?? 'stream_failed');
      break;
  }
}
