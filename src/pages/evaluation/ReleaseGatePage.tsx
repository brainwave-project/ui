import { useEffect, useState } from 'react';
import {
  AlertOctagon, CheckCircle2, ClipboardList, FileCode2, Plus, RotateCcw, Save, ShieldCheck, Trash2, TriangleAlert, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { genApi } from '@/api/evalGen.api';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import { genKeys, useBaselines, useDecisions, useGateRuns, usePolicies, useSnapshot } from '@/features/evaluation/hooks/useGen';
import {
  EmptyState, Field, Pill, PrincipalNote, SelectBox, TextArea, TextField, Toggle,
} from '@/features/evaluation/components/EvalPrimitives';
import { Bench, LabPage, Well, f2, useUrlTab, type LabTab } from '@/features/evaluation/components/gen/GenUI';
import { fmtTime } from '@/features/evaluation/lib/evalStats';
import type { GatePolicy, GateResult, GateRule, GateRunRow } from '@/types/evalGen';

type Tab = 'policy' | 'evaluate' | 'decisions' | 'ci';

const TABS: LabTab<Tab>[] = [
  { id: 'policy',    title: 'Policy',    blurb: 'What blocks a release, written down: preconditions, rules, severities — reviewed like code.', icon: ShieldCheck },
  { id: 'evaluate',  title: 'Evaluate',  blurb: 'Baseline vs candidate under the policy: can they be compared, does every rule hold, can this n even tell?', icon: ClipboardList },
  { id: 'decisions', title: 'Decisions', blurb: 'Every recorded decision, including overrides and their written reasons.', icon: CheckCircle2 },
  { id: 'ci',        title: 'CI',        blurb: 'The same decision, as an exit code on every pull request.', icon: FileCode2 },
];

export function ReleaseGatePage() {
  const [tab, setTab] = useUrlTab(TABS);
  return (
    <LabPage title="Release Gate" tab={tab} onTab={setTab} tabs={TABS}
      blurb={<>A regression gate is a <strong className="text-foreground">policy</strong>, not a threshold. It must refuse comparisons it cannot make, and know when a change is too small for its data to see.</>}>
      {tab === 'policy' && <PolicyTab />}
      {tab === 'evaluate' && <EvaluateTab />}
      {tab === 'decisions' && <DecisionsTab />}
      {tab === 'ci' && <CiTab />}
    </LabPage>
  );
}

const METRICS = ['answer_ok', 'faithfulness', 'answer_relevance', 'answer_correctness', 'false_abstention', 'answered_unanswerable',
  'context_recall_labels', 'context_precision_labels', 'context_recall', 'context_precision', 'retrieval_recall_labels',
  'recall@k', 'mrr', 'ndcg@k', 'graded_ndcg@k', 'precision@k', 'hit_rate', 'map'];

function usePolicy(): [GatePolicy | null, (p: GatePolicy) => void, GatePolicy[]] {
  const policies = usePolicies();
  const [draft, setDraft] = useState<GatePolicy | null>(null);
  useEffect(() => { if (policies.data?.[0] && (!draft || !policies.data.some((p) => p.id === draft.id && p.version === draft.version))) setDraft(structuredClone(policies.data[0])); }, [policies.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return [draft, setDraft, policies.data ?? []];
}

/* ── Policy ─────────────────────────────────────────────────────────────── */

function PolicyTab() {
  const [p, setP] = usePolicy();
  const save = useEvalMutation((pol: GatePolicy) => genApi.savePolicy(pol), { invalidate: [[...genKeys.policies]], success: 'Policy saved (changed rules bump the version)' });
  const reset = useEvalMutation((id: string) => genApi.resetPolicy(id), { invalidate: [[...genKeys.policies]], success: 'Reset to the default policy' });
  if (!p) return <EmptyState icon={ShieldCheck} title="Loading policy…" />;
  const set = <K extends keyof GatePolicy>(k: K, v: GatePolicy[K]) => setP({ ...p, [k]: v });
  const setRule = (i: number, patch: Partial<GateRule>) => set('rules', p.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Bench
      controls={
        <>
          <div className="flex flex-wrap gap-1"><Pill tone="neon">{p.id}</Pill><Pill>v{p.version}</Pill><Pill>{fmtTime(p.updated_at)}</Pill></div>
          <Field label="Name"><TextField value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Description"><TextArea value={p.description} onChange={(e) => set('description', e.target.value)} className="min-h-[60px] font-sans text-xs" /></Field>
          <p className="pt-1 text-xs font-medium">Preconditions (fail = BLOCK)</p>
          <div className="space-y-1.5">
            <Toggle checked={p.require_same_dataset} onChange={(v) => set('require_same_dataset', v)} label="Same dataset content hash" />
            <Toggle checked={p.require_frozen_dataset} onChange={(v) => set('require_frozen_dataset', v)} label="Frozen dataset" />
            <Toggle checked={p.require_same_judge} onChange={(v) => set('require_same_judge', v)} label="Same judge fingerprint" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Min items"><TextField type="number" min={1} value={p.min_items} onChange={(e) => set('min_items', Number(e.target.value))} /></Field>
            <Field label="Max errors"><TextField type="number" step={0.01} min={0} max={1} value={p.max_error_rate} onChange={(e) => set('max_error_rate', Number(e.target.value))} /></Field>
            <Field label="Confidence"><TextField type="number" step={0.01} min={0.5} max={0.999} value={p.confidence} onChange={(e) => set('confidence', Number(e.target.value))} /></Field>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-1.5" disabled={save.isPending} onClick={() => save.mutate(p)}><Save className="h-4 w-4" /> Save policy</Button>
            <Button variant="outline" className="gap-1.5" onClick={() => reset.mutate(p.id)}><RotateCcw className="h-4 w-4" /> Default</Button>
          </div>
          <PrincipalNote title="Designing what blocks">
            <strong>Block</strong> on what you would roll back for: fabrication (a faithfulness floor, answering the unanswerable) and a
            <strong> measured</strong> loss in the primary outcome (non-inferiority, noise-aware). <strong>Warn</strong> on the rest. A gate that
            blocks on every point-estimate wobble gets bypassed within a month — and a bypassed gate protects nothing.
          </PrincipalNote>
        </>
      }
    >
      <Well title="Rules" hint="floor / ceiling: absolute bars on the candidate · max_drop: point-estimate delta vs baseline · non_inferior: lower CI bound of the paired delta must stay above −margin."
        actions={<Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => set('rules', [...p.rules, { id: `rule-${p.rules.length + 1}`, metric: 'answer_ok', kind: 'non_inferior', threshold: 0.1, severity: 'warn', applies_to: 'generation', rationale: '' }])}><Plus className="h-3.5 w-3.5" /> Rule</Button>}>
        <div className="space-y-2">
          {p.rules.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-white/8 p-2 md:grid-cols-[1.1fr_1.2fr_1fr_0.6fr_0.8fr_0.9fr_auto]">
              <TextField value={r.id} onChange={(e) => setRule(i, { id: e.target.value })} className="font-mono text-xs" />
              <SelectBox value={r.metric} onChange={(v) => setRule(i, { metric: v })} options={METRICS.map((m) => ({ value: m, label: m }))} className="text-xs" />
              <SelectBox value={r.kind} onChange={(v) => setRule(i, { kind: v })} className="text-xs"
                options={[{ value: 'floor', label: 'floor ≥' }, { value: 'ceiling', label: 'ceiling ≤' }, { value: 'max_drop', label: 'max drop' }, { value: 'non_inferior', label: 'non-inferior' }]} />
              <TextField type="number" step={0.01} min={0} max={1} value={r.threshold} onChange={(e) => setRule(i, { threshold: Number(e.target.value) })} className="text-xs" />
              <SelectBox value={r.severity} onChange={(v) => setRule(i, { severity: v })} className="text-xs" options={[{ value: 'block', label: 'block' }, { value: 'warn', label: 'warn' }]} />
              <SelectBox value={r.applies_to} onChange={(v) => setRule(i, { applies_to: v })} className="text-xs" options={[{ value: 'generation', label: 'generation' }, { value: 'retrieval', label: 'retrieval' }]} />
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => set('rules', p.rules.filter((_, j) => j !== i))} aria-label="Remove rule"><Trash2 className="h-4 w-4" /></Button>
              <TextField value={r.rationale} onChange={(e) => setRule(i, { rationale: e.target.value })} placeholder="Why this rule exists" className="text-xs md:col-span-7" />
            </div>
          ))}
        </div>
      </Well>
    </Bench>
  );
}

/* ── Evaluate ───────────────────────────────────────────────────────────── */

const DECISION = {
  pass:  { label: 'PASS', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2 },
  warn:  { label: 'PASS WITH WARNINGS', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200', icon: TriangleAlert },
  block: { label: 'BLOCK', cls: 'border-red-500/40 bg-red-500/10 text-red-300', icon: AlertOctagon },
} as const;

function runOption(r: GateRunRow) {
  return { value: r.id, label: `${r.kind === 'generation' ? 'gen' : 'ret'} · ${r.name}${r.fault && r.fault !== 'none' ? ` (fault ${r.fault})` : ''} · ${r.split} · ${fmtTime(r.created_at)}` };
}

function EvaluateTab() {
  const [policy, , all] = usePolicy();
  const [policyId, setPolicyId] = useState('');
  const runs = useGateRuns();
  const baselines = useBaselines();
  const [candidate, setCandidate] = useState('');
  const [baseline, setBaseline] = useState('');
  const [result, setResult] = useState<GateResult | null>(null);
  const [override, setOverride] = useState('');
  const [author, setAuthor] = useState('');
  useEffect(() => { if (!policyId && policy) setPolicyId(policy.id); }, [policy]); // eslint-disable-line react-hooks/exhaustive-deps

  const kind = runs.data?.find((r) => r.id === candidate)?.kind;
  const promoted = kind ? baselines.data?.[policyId]?.[kind]?.run_id : undefined;
  const body = { policy_id: policyId, candidate_run: candidate, baseline_run: baseline || null };
  const evaluate = useEvalMutation(() => genApi.evaluate(body), { onSuccess: setResult });
  const promote = useEvalMutation(() => genApi.promote(policyId, candidate), { invalidate: [[...genKeys.baselines]], success: 'Candidate promoted to baseline' });
  const record = useEvalMutation(() => genApi.recordDecision({ ...body, override_reason: override, author }), { invalidate: [[...genKeys.decisions]], success: 'Decision recorded' });
  const exportCi = useEvalMutation(() => genApi.exportGate(body), { invalidate: [[...genKeys.snapshot]], success: 'Exported to eval/release/ — commit it with your change' });
  const options = (runs.data ?? []).filter((r) => r.status === 'done').map(runOption);

  return (
    <Bench side="minmax(300px,380px)"
      controls={
        <>
          <Field label="Policy"><SelectBox value={policyId} onChange={setPolicyId} options={all.map((p) => ({ value: p.id, label: `${p.name} · v${p.version}` }))} /></Field>
          <Field label="Candidate run"><SelectBox value={candidate} onChange={setCandidate} options={options} /></Field>
          <Field label="Baseline run" hint={promoted ? `Empty = promoted baseline ${promoted}` : 'No promoted baseline for this kind yet — pick one, or promote a run.'}>
            <SelectBox value={baseline} onChange={setBaseline} options={[{ value: '', label: promoted ? 'promoted baseline' : '— pick —' }, ...options]} />
          </Field>
          <Button className="w-full gap-1.5" disabled={!candidate || (!baseline && !promoted) || evaluate.isPending} onClick={() => evaluate.mutate(undefined)}><ShieldCheck className="h-4 w-4" /> Evaluate</Button>
          <div className="border-t border-white/10 pt-3 space-y-2">
            <Button variant="outline" className="w-full text-xs" disabled={!candidate || promote.isPending} onClick={() => promote.mutate(undefined)}>Promote candidate as the new baseline</Button>
            <Button variant="outline" className="w-full gap-1.5 text-xs" disabled={!result || exportCi.isPending} onClick={() => exportCi.mutate(undefined)}><Upload className="h-3.5 w-3.5" /> Export for CI</Button>
          </div>
        </>
      }
    >
      {!result ? <EmptyState icon={ClipboardList} title="Pick a candidate and evaluate">A generation run is gated by the generation rules, a retrieval run by the retrieval rules.</EmptyState> : (
        <>
          {(() => { const d = DECISION[result.decision]; return (
            <div className={cn('flex items-start gap-3 rounded-2xl border p-4', d.cls)}>
              <d.icon className="h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">{d.label} <span className="font-mono text-xs opacity-70">exit {result.exit_code}</span></p>
                <p className="text-xs opacity-80">{result.baseline.name} ({result.baseline.id}) → {result.candidate.name} ({result.candidate.id}) · policy v{result.policy.version}</p>
                {result.reasons.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              </div>
            </div>
          ); })()}
          <Well title="Preconditions — can these two runs be compared at all?">
            <div className="space-y-1">{result.preconditions.map((c) => (
              <p key={c.title} className="flex items-start gap-2 text-xs">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />}
                <span><strong>{c.title}</strong> <span className="text-muted-foreground">— {c.detail}</span></span>
              </p>
            ))}</div>
          </Well>
          <Well title="Rules" hint="Δ and its interval are oriented so that positive = better, also for rates where lower is better. 'detects ±' = the smallest change these paired items can resolve.">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1">rule</th><th>kind</th><th>threshold</th><th>baseline</th><th>candidate [CI]</th><th>Δ [CI]</th><th>detects ±</th><th>result</th></tr>
                </thead>
                <tbody>{result.rules.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 align-top">
                    <td className="py-1.5"><p className="font-mono">{r.id}</p><p className="text-[10px] text-muted-foreground">{r.metric}</p></td>
                    <td>{r.kind}</td><td className="font-mono">{r.threshold}</td>
                    <td className="font-mono">{f2(r.baseline?.mean)}</td>
                    <td className="font-mono">{f2(r.candidate?.mean)} <span className="text-muted-foreground">[{f2(r.candidate?.low)}, {f2(r.candidate?.high)}]</span></td>
                    <td className="font-mono">{r.delta ? <>{r.delta.mean >= 0 ? '+' : ''}{f2(r.delta.mean)} <span className="text-muted-foreground">[{f2(r.delta.low)}, {f2(r.delta.high)}]</span></> : '—'}</td>
                    <td className="font-mono">{r.delta ? f2(r.delta.detectable) : '—'}</td>
                    <td>
                      <Pill tone={r.status === 'pass' ? 'good' : r.severity === 'block' ? 'bad' : 'warn'}>{r.status === 'pass' ? 'pass' : r.severity}</Pill>
                      <p className="mt-1 max-w-xs text-[10px] text-muted-foreground">{r.detail}</p>
                      {r.advisory && <p className="mt-1 max-w-xs text-[10px] text-amber-200">{r.advisory}</p>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Well>
          <Well title="Record this decision" hint="An override does not change the verdict; it records who shipped anyway, and why.">
            {result.decision === 'block' && (
              <div className="mb-2 grid gap-2 md:grid-cols-[1fr_200px]">
                <TextArea placeholder="Override reason (≥ 30 characters) — leave empty to record the BLOCK as it is" value={override} onChange={(e) => setOverride(e.target.value)} className="min-h-[60px] font-sans text-xs" />
                <TextField placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
            )}
            <Button size="sm" disabled={record.isPending} onClick={() => record.mutate(undefined)}>{override.trim() ? 'Record override' : 'Record decision'}</Button>
          </Well>
        </>
      )}
    </Bench>
  );
}

/* ── Decisions ──────────────────────────────────────────────────────────── */

function DecisionsTab() {
  const decisions = useDecisions();
  if (!decisions.data?.length) return <EmptyState icon={CheckCircle2} title="No decisions recorded yet">Evaluate a candidate and record the decision.</EmptyState>;
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">when</th><th>policy</th><th>baseline → candidate</th><th>verdict</th><th>final</th><th>reasons / override</th></tr></thead>
      <tbody>{decisions.data.map((d) => (
        <tr key={d.id} className="border-t border-white/5 align-top">
          <td className="py-1.5">{fmtTime(d.recorded_at)}</td><td className="font-mono">{d.policy_id} v{d.policy_version}</td>
          <td className="font-mono text-[10px]">{d.baseline_run}<br />→ {d.candidate_run}</td>
          <td><Pill tone={d.decision === 'pass' ? 'good' : d.decision === 'warn' ? 'warn' : 'bad'}>{d.decision}</Pill></td>
          <td><Pill tone={d.final === 'pass_overridden' ? 'warn' : d.final === 'pass' ? 'good' : d.final === 'warn' ? 'warn' : 'bad'}>{d.final.replace('_', ' ')}</Pill></td>
          <td className="max-w-md text-muted-foreground">
            {d.override ? <p className="text-amber-200">Override by {d.override.author}: {d.override.reason}</p> : null}
            {d.reasons.map((r) => <p key={r}>{r}</p>)}
          </td>
        </tr>
      ))}</tbody>
    </table>
  );
}

/* ── CI ─────────────────────────────────────────────────────────────────── */

const WORKFLOW = `# agent-hub/.github/workflows/eval-gate.yml (excerpt)
- name: Eval release gate
  working-directory: agent-hub
  run: |
    uv run python -m agent_hub.eval.lab.gate_cli \\
      --policy    src/agent_hub/eval/release/policy.json \\
      --baseline  src/agent_hub/eval/release/baseline.json \\
      --candidate src/agent_hub/eval/release/candidate.json \\
      --summary   "$GITHUB_STEP_SUMMARY"`;

function CiTab() {
  const snap = useSnapshot();
  const s = snap.data;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Well title="What CI will decide" hint={s ? `Snapshot in ${s.dir}` : ''}>
        {!s ? <p className="text-xs text-muted-foreground">Loading…</p> : !s.result ? (
          <p className="text-xs text-muted-foreground">No snapshot yet ({Object.entries(s.present).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ')}). Evaluate a candidate and click <strong>Export for CI</strong>.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Pill tone={s.result.decision === 'pass' ? 'good' : s.result.decision === 'warn' ? 'warn' : 'bad'}>{s.result.decision}</Pill>
              <Pill>exit {s.result.exit_code}</Pill>
              <Pill>{s.result.baseline.name} → {s.result.candidate.name}</Pill>
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-3 text-[10px] text-muted-foreground">{s.markdown}</pre>
          </>
        )}
      </Well>
      <div className="space-y-4">
        <Well title="How it is wired">
          <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li><strong className="text-foreground">Expensive half, where the GPU is.</strong> Run the candidate pipeline in the lab, evaluate it, and <em>Export for CI</em>. That writes <code className="font-mono">policy.json</code>, <code className="font-mono">baseline.json</code> and <code className="font-mono">candidate.json</code> into <code className="font-mono">agent-hub/src/agent_hub/eval/release/</code>.</li>
            <li><strong className="text-foreground">Commit the snapshot with the change</strong> it measures. The reviewer sees the numbers in the diff.</li>
            <li><strong className="text-foreground">Cheap half, on every pull request.</strong> CI runs the eval unit tests, then the gate CLI on the snapshot. No stack, no model, no network.</li>
            <li>Exit <code className="font-mono">0</code> pass (or warnings) · <code className="font-mono">1</code> block · <code className="font-mono">2</code> the gate could not run — also a failure: a gate that skips when its input is missing protects nothing.</li>
            <li>The snapshot is not trusted blindly: dataset hash, frozen status and judge fingerprint are preconditions, so a stale or hand-edited run is refused.</li>
          </ol>
        </Well>
        <Well title="Run it locally">
          <pre className="overflow-x-auto rounded-md bg-black/40 p-3 text-[10px] text-muted-foreground">{`cd infra && make evals-release-gate\n\n# or directly\ncd agent-hub && uv run python -m agent_hub.eval.lab.gate_cli \\\n  --policy src/agent_hub/eval/release/policy.json \\\n  --baseline src/agent_hub/eval/release/baseline.json \\\n  --candidate src/agent_hub/eval/release/candidate.json`}</pre>
        </Well>
        <Well title="The CI step"><pre className="overflow-x-auto rounded-md bg-black/40 p-3 text-[10px] text-muted-foreground">{WORKFLOW}</pre></Well>
      </div>
    </div>
  );
}
