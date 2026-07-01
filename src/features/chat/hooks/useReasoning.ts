import { useCallback, useRef, useState } from 'react';
import { agentApi } from '@/api/agent.api';
import type {
  AgentCitation,
  AgentRunStatus,
  ReasoningStep,
} from '@/types/agent';

/**
 * Drives the CRAG agent and accumulates its trajectory for the Reasoning Trace.
 *
 * Each `node_enter` marks the previous node done and the new one active; tokens
 * accumulate into the streamed answer; `done` carries the final status + loop
 * count (loops > 0 ⇒ the agent self-corrected). Mirrors useChat's shape so the
 * Chat tab can swap streams.
 */
export function useReasoning() {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<AgentCitation[]>([]);
  const [status, setStatus] = useState<AgentRunStatus | null>(null);
  const [loops, setLoops] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    setSteps([]);
    setAnswer('');
    setCitations([]);
    setStatus(null);
    setLoops(0);
    setError(null);
  }, []);

  const send = useCallback(
    (sessionId: string, message: string) => {
      reset();
      setIsStreaming(true);
      abortRef.current = agentApi.streamReasoning(sessionId, message, {
        onNodeEnter(node, seq) {
          setSteps((prev) => [
            ...prev.map((s) => ({ ...s, active: false, done: true })),
            { node, seq, active: true, done: false },
          ]);
        },
        onDecision(node, choice) {
          setSteps((prev) =>
            prev.map((s) => (s.node === node && !s.done ? { ...s, decision: choice } : s)),
          );
        },
        onToken(text) {
          setAnswer((prev) => prev + text);
        },
        onCitation(citation) {
          setCitations((prev) =>
            prev.some((c) => c.docId === citation.docId) ? prev : [...prev, citation],
          );
        },
        onDone(_runId, runStatus, runLoops) {
          setSteps((prev) => prev.map((s) => ({ ...s, active: false, done: true })));
          setStatus(runStatus);
          setLoops(runLoops);
          setIsStreaming(false);
        },
        onError(message) {
          setError(message);
          setIsStreaming(false);
        },
      });
    },
    [reset],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
  }, []);

  return { steps, answer, citations, status, loops, isStreaming, error, send, abort, reset };
}
