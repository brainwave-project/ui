/** Conversational RAG (Phase 2) — UI types. Mirrors know-hub chat domain. */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatSession {
  id:        string;
  ownerId:   string;
  title:     string;
  createdAt: string;
  updatedAt: string;
}

/** A source an answer was grounded in — rendered as a [n] chip + Sources list. */
export interface Citation {
  n:          number;   // 1-based rank, matches the [n] marker in the answer
  documentId: string;   // public document id — links to /documents/:id
  chunkId:    string;
  title:      string;
  score:      number;   // cosine similarity (0–1)
}

export interface ChatMessage {
  id:               string;
  sessionId:        string;
  role:             ChatRole;
  content:          string;
  model?:           string | null;
  promptTokens?:    number | null;
  completionTokens?: number | null;
  langfuseTraceId?: string | null;
  createdAt:        string;
  citations?:       Citation[];
}

export interface SessionsResponse {
  sessions: ChatSession[];
}

export interface MessagesResponse {
  messages: ChatMessage[];
}

/** Callbacks the SSE stream invokes as a turn unfolds. */
export interface ChatStreamCallbacks {
  onToken:     (token: string) => void;
  onCitations: (sources: Citation[]) => void;
  onDone:      (messageId: string) => void;
  onError:     (message: string) => void;
}
