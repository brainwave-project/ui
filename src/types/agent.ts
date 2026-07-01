/**
 * AgentHub (Phase 3) streaming contract — the CRAG agent's reasoning trajectory.
 *
 * Richer than Phase-2 chat: instead of only tokens, the agent streams its
 * node-by-node trajectory (retrieve → grade → … ) so the UI can SHOW the agent
 * self-correct, not just wait (TDD §11.1). Mirrors the SSE protocol in §11.2.
 */

export type CragNode =
  | 'retrieve'
  | 'grade'
  | 'transform_query'
  | 'generate'
  | 'check_grounded'
  | 'abstain';

export interface ReasoningStep {
  node: CragNode | string;
  seq: number;
  decision?: string;        // conditional-edge outcome, when one fired at this node
  active: boolean;          // currently running (drives the live stepper)
  done: boolean;
}

export interface AgentCitation {
  docId: string;
  score: number;
}

export type AgentRunStatus = 'SUCCEEDED' | 'ABSTAINED' | 'FAILED';

export interface AgentStreamCallbacks {
  onNodeEnter(node: string, seq: number): void;
  onDecision(node: string, choice: string): void;
  onToken(text: string): void;
  onCitation(citation: AgentCitation): void;
  onDone(runId: string, status: AgentRunStatus, loops: number): void;
  onError(message: string): void;
}
