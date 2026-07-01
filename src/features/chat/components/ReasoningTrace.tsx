import { useState } from 'react';
import type { AgentRunStatus, ReasoningStep } from '@/types/agent';

/**
 * Reasoning Trace (TDD §11.3) — a collapsible vertical stepper that lights up
 * each CRAG node as `node_enter` arrives, shows the grade verdict on `decision`,
 * and renders a "self-corrected ×N" badge when the agent looped (loops > 0).
 * Turns the agent's self-correction into a trust-building UX: the user SEES it
 * reason rather than staring at a spinner.
 */

const NODE_LABEL: Record<string, string> = {
  retrieve: 'Retrieving',
  grade: 'Grading relevance',
  transform_query: 'Rewriting query',
  generate: 'Generating answer',
  check_grounded: 'Checking grounding',
  abstain: 'Abstaining',
};

interface Props {
  steps: ReasoningStep[];
  loops: number;
  status: AgentRunStatus | null;
  isStreaming: boolean;
}

export function ReasoningTrace({ steps, loops, status, isStreaming }: Props) {
  const [open, setOpen] = useState(true);
  if (steps.length === 0 && !isStreaming) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">
          Reasoning trace
          {loops > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              self-corrected ×{loops}
            </span>
          )}
          {status === 'ABSTAINED' && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
              abstained
            </span>
          )}
        </span>
        <span className="text-slate-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <ol className="space-y-1 px-3 pb-3">
          {steps.map((s) => (
            <li key={s.seq} className="flex items-start gap-2">
              <span
                className={
                  'mt-1 h-2 w-2 shrink-0 rounded-full ' +
                  (s.active
                    ? 'animate-pulse bg-blue-500'
                    : s.done
                      ? 'bg-emerald-500'
                      : 'bg-slate-300')
                }
                aria-hidden
              />
              <span className="flex-1">
                <span className={s.active ? 'font-medium text-slate-800' : 'text-slate-600'}>
                  {NODE_LABEL[s.node] ?? s.node}
                </span>
                {s.decision && (
                  <span className="ml-2 text-xs text-slate-500">→ {s.decision}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
