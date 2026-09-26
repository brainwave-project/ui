import { useEffect, useState } from 'react';
import {
  ArrowLeftRight, CheckCircle2, Gavel, History, Loader2, Play, Plus, Save, Scale, Tags, Timer, Trash2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { genApi } from '@/api/evalGen.api';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import {
  genKeys, useGenConfig, useGenRuns, useJudgeRun, useJudgeRuns, useJudgeSet, useJudgeSets, useJudges, useTrackedJob,
} from '@/features/evaluation/hooks/useGen';
import {
  EmptyState, Field, JobBar, Pill, PrincipalNote, Segmented, SelectBox, Stat, TextArea, TextField, Toggle,
} from '@/features/evaluation/components/EvalPrimitives';
import { ConfusionGrid } from '@/features/evaluation/components/statCharts';
import { Bench, LabPage, Well, f2, pct, useUrlTab, type LabTab } from '@/features/evaluation/components/gen/GenUI';
import { fmtTime } from '@/features/evaluation/lib/evalStats';
import type { DriftReport, Judge, JudgeInput, JudgeRunSummary, ValidationReport } from '@/types/evalGen';

type Tab = 'rubrics' | 'label' | 'validate' | 'bias' | 'drift';

const TABS: LabTab<Tab>[] = [
  { id: 'rubrics',  title: 'Rubrics',      blurb: 'A judge is a rubric + model + decoding + output contract. Every edit is a new version with a new fingerprint.', icon: Gavel },
  { id: 'label',    title: 'Human labels', blurb: 'Label answers blind — you never see the designer’s tag, the other raters or the judge. Your labels are the reference.', icon: Tags },
  { id: 'validate', title: 'Validate',     blurb: 'Judge vs you: agreement beyond chance, how many real failures it catches, and how it biases the pass rate.', icon: Scale },
  { id: 'bias',     title: 'Bias probes',  blurb: 'Position bias (swap the order), verbosity bias (add empty words), self-consistency (ask again).', icon: ArrowLeftRight },
  { id: 'drift',    title: 'Drift',        blurb: 'Same samples, two judge configurations: how far did the verdicts move, and toward the humans or away?', icon: History },
];

export function JudgeLabPage() {
  const [tab, setTab] = useUrlTab(TABS);
  return (
    <LabPage title="Judge Lab" tab={tab} onTab={setTab} tabs={TABS}
      blurb={<>An LLM judge is a measuring instrument. <strong className="text-foreground">Calibrate it against humans</strong> and probe its known biases before you let it decide anything.</>}>
      {tab === 'rubrics' && <Rubrics />}
      {tab === 'label' && <Labeling />}
      {tab === 'validate' && <Validate />}
      {tab === 'bias' && <Bias />}
      {tab === 'drift' && <Drift />}
    </LabPage>
  );
}

const BLANK: JudgeInput = {
  name: '', model: null, temperature: 0, seed: 7, mode: 'pointwise', rubric: '', reference_guided: true,
  show_context: false, reasoning_first: true, scale_max: 5, pass_threshold: 4, notes: '',
};

function useRater(): [string, (r: string) => void] {
  const [rater, setRater] = useState(() => { try { return localStorage.getItem('bw_eval_rater') || 'me'; } catch { return 'me'; } });
  const set = (r: string) => { setRater(r); try { localStorage.setItem('bw_eval_rater', r); } catch { /* private mode */ } };
  return [rater, set];
}

function JudgeSetPickers({ judgeId, setJudgeId, setId, setSetId }: {
  judgeId: string; setJudgeId: (v: string) => void; setId: string; setSetId: (v: string) => void;
}) {
  const judges = useJudges();
  const sets = useJudgeSets();
  useEffect(() => { if (!judgeId && judges.data?.[0]) setJudgeId(judges.data[0].id); }, [judges.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!setId && sets.data?.[0]) setSetId(sets.data[0].id); }, [sets.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Field label="Judge"><SelectBox value={judgeId} onChange={setJudgeId} placeholder="create one in Rubrics"
        options={(judges.data ?? []).map((j) => ({ value: j.id, label: `${j.name} · v${j.version} · ${j.resolved_model.split(':')[0]} · T=${j.temperature}` }))} /></Field>
      <Field label="Sample set"><SelectBox value={setId} onChange={setSetId} placeholder="import one in Human labels"
        options={(sets.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.samples} samples` }))} /></Field>
    </>
  );
}

/* ── Rubrics ─────────────────────────────────────────────────────────────── */

function Rubrics() {
  const judges = useJudges();
  const config = useGenConfig();
  const [selected, setSelected] = useState<string>('new');
  const [form, setForm] = useState<JudgeInput>(BLANK);
  const current = judges.data?.find((j) => j.id === selected);
  useEffect(() => { if (current) setForm({ ...BLANK, ...current }); else setForm(BLANK); }, [selected, judges.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof JudgeInput>(k: K, v: JudgeInput[K]) => setForm({ ...form, [k]: v });
  const save = useEvalMutation(
    () => (current ? genApi.updateJudge(current.id, form) : genApi.createJudge(form)),
    { invalidate: [[...genKeys.judges]], onSuccess: (j: Judge) => setSelected(j.id), success: current ? 'Saved (a changed contract is a new version)' : 'Judge created' },
  );
  const remove = useEvalMutation(() => genApi.deleteJudge(selected), { invalidate: [[...genKeys.judges]], onSuccess: () => setSelected('new') });

  const [trial, setTrial] = useState({ question: 'What is the daily meal limit when I\'m travelling for work?', answer: 'Meals are reimbursed up to 45 euros per day.', reference: '60 euros per day (current policy).', contexts: [] as string[] });
  const [trialOut, setTrialOut] = useState<Awaited<ReturnType<typeof genApi.tryJudge>> | null>(null);
  const tryIt = useEvalMutation(() => genApi.tryJudge(selected, trial), { onSuccess: setTrialOut });

  return (
    <Bench side="minmax(300px,380px)"
      controls={
        <>
          <Field label="Judge">
            <SelectBox value={selected} onChange={setSelected}
              options={[{ value: 'new', label: '+ new judge' }, ...(judges.data ?? []).map((j) => ({ value: j.id, label: `${j.name} · v${j.version}` }))]} />
          </Field>
          {current && (
            <div className="flex flex-wrap gap-1"><Pill tone="neon">v{current.version}</Pill><Pill>fingerprint {current.fingerprint}</Pill></div>
          )}
          <Field label="Name"><TextField value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Correctness v1 (vague)" /></Field>
          <Field label="Model"><SelectBox value={form.model ?? ''} onChange={(v) => set('model', v || null)}
            options={[{ value: '', label: `default (${config.data?.default_model ?? '…'})` }, ...(config.data?.models ?? []).filter((m) => !m.includes('embed')).map((m) => ({ value: m, label: m }))]} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mode"><SelectBox value={form.mode} onChange={(v) => set('mode', v)} options={[{ value: 'pointwise', label: 'score 1…N' }, { value: 'binary', label: 'pass / fail' }]} /></Field>
            <Field label={`Temperature ${form.temperature.toFixed(1)}`}>
              <input type="range" min={0} max={1.5} step={0.1} value={form.temperature} onChange={(e) => set('temperature', Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
            </Field>
          </div>
          {form.mode === 'pointwise' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Scale max"><TextField type="number" min={2} max={10} value={form.scale_max} onChange={(e) => set('scale_max', Number(e.target.value))} /></Field>
              <Field label="Pass if score ≥"><TextField type="number" min={1} max={form.scale_max} value={form.pass_threshold} onChange={(e) => set('pass_threshold', Number(e.target.value))} /></Field>
            </div>
          )}
          <div className="space-y-1.5">
            <Toggle checked={form.reference_guided} onChange={(v) => set('reference_guided', v)} label="Show the reference answer" />
            <Toggle checked={form.show_context} onChange={(v) => set('show_context', v)} label="Show the retrieved context" />
            <Toggle checked={form.reasoning_first} onChange={(v) => set('reasoning_first', v)} label="Reasoning before the score" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-1.5" disabled={save.isPending || !form.name.trim() || form.rubric.trim().length < 10} onClick={() => save.mutate(undefined)}><Save className="h-4 w-4" /> {current ? 'Save' : 'Create'}</Button>
            {current && <Button variant="outline" size="icon" onClick={() => remove.mutate(undefined)} aria-label="Delete judge"><Trash2 className="h-4 w-4" /></Button>}
          </div>
          <PrincipalNote title="What makes a rubric good">
            <strong>Anchors</strong>: describe every score level with a concrete example, not "5 = excellent".
            <strong> One criterion</strong>: a rubric that mixes correctness, tone and length gives a number nobody can act on.
            <strong> Explicit traps</strong>: say what to do with abstentions, extra detail, length and outdated facts.
            <strong> Reference-guided</strong> grading turns "does this sound right?" into "does this match?". Then validate it — a rubric you have not measured is a guess.
          </PrincipalNote>
        </>
      }
    >
      <Field label="Rubric (the judge's instructions)">
        <TextArea value={form.rubric} onChange={(e) => set('rubric', e.target.value)} className="min-h-[260px] font-sans text-xs" placeholder="Paste a rubric from docs/experiment-2/data/rubrics/…" />
      </Field>
      {current && current.history.length > 0 && (
        <Well title="Version history" hint="Old versions are kept; runs record the fingerprint they were scored with.">
          <table className="w-full text-xs"><tbody>{current.history.map((h) => (
            <tr key={h.version} className="border-t border-white/5"><td className="py-1 font-mono">v{h.version}</td><td className="font-mono text-muted-foreground">{h.fingerprint}</td>
              <td className="text-muted-foreground">{String(h.model ?? 'default')} · T={String(h.temperature)} · {String(h.mode)}</td><td className="text-muted-foreground">retired {fmtTime(h.retired_at)}</td></tr>
          ))}</tbody></table>
        </Well>
      )}
      {current && (
        <Well title="Try it on one answer" hint="See the exact prompt the judge receives, and its reply.">
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Question"><TextField value={trial.question} onChange={(e) => setTrial({ ...trial, question: e.target.value })} /></Field>
            <Field label="Answer"><TextField value={trial.answer} onChange={(e) => setTrial({ ...trial, answer: e.target.value })} /></Field>
            <Field label="Reference"><TextField value={trial.reference} onChange={(e) => setTrial({ ...trial, reference: e.target.value })} /></Field>
          </div>
          <Button size="sm" className="mt-2 gap-1.5" disabled={tryIt.isPending} onClick={() => tryIt.mutate(undefined)}>
            {tryIt.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Judge it
          </Button>
          {trialOut && (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 text-[10px] text-muted-foreground">{trialOut.system}{'\n\n———\n\n'}{trialOut.user}</pre>
              <div className="rounded-md border border-white/8 p-2 text-xs">
                <p><Pill tone={trialOut.result.verdict === 'pass' ? 'good' : 'bad'}>{trialOut.result.verdict}</Pill> {trialOut.result.score != null && <span className="font-mono">score {trialOut.result.score}</span>}</p>
                <p className="mt-2 text-muted-foreground">{trialOut.result.reasoning}</p>
              </div>
            </div>
          )}
        </Well>
      )}
    </Bench>
  );
}

/* ── Human labels ────────────────────────────────────────────────────────── */

function Labeling() {
  const sets = useJudgeSets();
  const runs = useGenRuns();
  const [setId, setSetId] = useState('');
  const [rater, setRater] = useRater();
  const [name, setName] = useState('Kestrel judge calibration');
  const [jsonl, setJsonl] = useState('');
  const [runId, setRunId] = useState('');
  const [task, setTask] = useState<Awaited<ReturnType<typeof genApi.task>> | null>(null);
  const [verdict, setVerdict] = useState<'pass' | 'fail' | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  useEffect(() => { if (!setId && sets.data?.[0]) setSetId(sets.data[0].id); }, [sets.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useEvalMutation(() => genApi.task(setId, rater), { onSuccess: setTask });
  useEffect(() => { if (setId && rater) load.mutate(undefined); }, [setId, rater]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useEvalMutation(() => genApi.createSet({ name, jsonl }), { invalidate: [[...genKeys.sets]], success: 'Sample set created', onSuccess: (s) => { setSetId(s.id); setJsonl(''); } });
  const fromRun = useEvalMutation(() => genApi.setFromRun({ run_id: runId, name, limit: 20 }), { invalidate: [[...genKeys.sets]], success: 'Sample set created from the run', onSuccess: (s) => setSetId(s.id) });
  const submit = useEvalMutation(
    () => genApi.label(setId, rater, task!.next[0].id, { verdict: verdict!, score, note }),
    { invalidate: [[...genKeys.sets]], onSuccess: (t) => { setTask(t); setVerdict(null); setScore(null); setNote(''); } },
  );
  const clear = useEvalMutation(() => genApi.clearLabels(setId, rater), { invalidate: [[...genKeys.sets]], onSuccess: () => load.mutate(undefined) });
  const sample = task?.next[0];
  const summary = sets.data?.find((s) => s.id === setId);

  return (
    <Bench
      controls={
        <>
          <Field label="Sample set"><SelectBox value={setId} onChange={setSetId} placeholder="none yet"
            options={(sets.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.samples}` }))} /></Field>
          <Field label="You are (rater name)" hint="Labels are stored per rater. Use a second name to act as a second annotator."><TextField value={rater} onChange={(e) => setRater(e.target.value.trim())} /></Field>
          {summary && (
            <div className="text-[11px] text-muted-foreground">Labels so far: {Object.entries(summary.raters).map(([r, n]) => `${r} ${n}`).join(' · ') || 'none'}</div>
          )}
          {summary && <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => clear.mutate(undefined)}>Clear my labels on this set</Button>}
          <div className="border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-medium">New sample set</p>
            <Field label="Name"><TextField value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="JSONL (one sample per line)" hint="Paste data/judge-calibration.jsonl.">
              <TextArea value={jsonl} onChange={(e) => setJsonl(e.target.value)} className="min-h-[90px] text-[10px]" />
            </Field>
            <Button size="sm" className="mt-2 w-full gap-1.5" disabled={!jsonl.trim() || create.isPending} onClick={() => create.mutate(undefined)}><Plus className="h-3.5 w-3.5" /> Create from JSONL</Button>
            <Field label="…or sample 20 answers from a generation run" className="mt-3">
              <SelectBox value={runId} onChange={setRunId} options={(runs.data ?? []).map((r) => ({ value: r.id, label: `${r.spec.name} · ${fmtTime(r.created_at)}` }))} />
            </Field>
            <Button size="sm" variant="outline" className="mt-2 w-full text-xs" disabled={!runId || fromRun.isPending} onClick={() => fromRun.mutate(undefined)}>Create from run</Button>
          </div>
        </>
      }
    >
      {!task ? <EmptyState icon={Tags} title="Create or pick a sample set">Import the calibration set from the experiment folder.</EmptyState> : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-neon" style={{ width: `${(task.done / Math.max(1, task.total)) * 100}%` }} /></div>
            <span className="font-mono text-xs">{task.done}/{task.total}</span>
          </div>
          {!sample ? (
            <EmptyState icon={CheckCircle2} title="All samples labelled">Go to Validate and compare a judge with your labels.</EmptyState>
          ) : (
            <Well title={`Sample ${sample.id}`} hint="Judge the ANSWER. Pass = a careful employee could act on it safely; fail = wrong, missing the point, unsupported or evasive.">
              <div className="space-y-3 text-sm">
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Question</p><p>{sample.question}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference answer</p><p className="text-muted-foreground">{sample.reference || '—'}</p></div>
                {sample.contexts.length > 0 && (
                  <div>
                    <button type="button" className="text-[11px] text-neon" onClick={() => setShowCtx(!showCtx)}>{showCtx ? 'Hide' : 'Show'} the {sample.contexts.length} context chunk(s)</button>
                    {showCtx && sample.contexts.map((c, i) => <p key={i} className="mt-1 rounded bg-black/30 p-2 text-[11px] text-muted-foreground">[{i + 1}] {c}</p>)}
                  </div>
                )}
                <div className="rounded-lg border border-neon/25 bg-neon/[0.04] p-3"><p className="text-[10px] uppercase tracking-wide text-neon">Answer to judge</p><p className="mt-1 whitespace-pre-wrap">{sample.answer}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant={verdict === 'pass' ? 'default' : 'outline'} className="gap-1.5" onClick={() => setVerdict('pass')}><CheckCircle2 className="h-4 w-4" /> Pass</Button>
                  <Button variant={verdict === 'fail' ? 'destructive' : 'outline'} className="gap-1.5" onClick={() => setVerdict('fail')}><XCircle className="h-4 w-4" /> Fail</Button>
                  <span className="ml-2 text-xs text-muted-foreground">score</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setScore(n)} className={cn('h-8 w-8 rounded-md border font-mono text-xs', score === n ? 'border-neon bg-neon/20 text-neon' : 'border-white/10 text-muted-foreground')}>{n}</button>
                  ))}
                </div>
                <TextField placeholder="Note (why?) — optional, but you will want it when you look at disagreements" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button disabled={!verdict || submit.isPending} onClick={() => submit.mutate(undefined)} className="gap-1.5"><Save className="h-4 w-4" /> Submit &amp; next</Button>
              </div>
            </Well>
          )}
        </>
      )}
    </Bench>
  );
}

/* ── Validate ────────────────────────────────────────────────────────────── */

function Validate() {
  const [judgeId, setJudgeId] = useState('');
  const [setId, setSetId] = useState('');
  const [rater, setRater] = useRater();
  const [runId, setRunId] = useState('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const set = useJudgeSet(setId || null);
  const judgeRuns = useJudgeRuns(setId || null);
  const tracked = useTrackedJob();
  const raters = Array.from(new Set((set.data?.samples ?? []).flatMap((s) => Object.keys(s.labels))));
  const standard = (judgeRuns.data ?? []).filter((r) => r.probe === 'standard' || r.probe === 'consistency');

  const start = useEvalMutation(() => genApi.startJudgeRun({ judge_id: judgeId, set_id: setId, repeats: 1, probe: 'standard' }),
    { success: 'Judge run started', onSuccess: (j) => tracked.start(j.id) });
  const validate = useEvalMutation((id: string) => genApi.validation(setId, id, rater), { onSuccess: setReport });
  useEffect(() => {
    const id = tracked.job?.status === 'done' ? String(tracked.job.result.judge_run_id ?? '') : '';
    if (id) { setRunId(id); validate.mutate(id); }
  }, [tracked.job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Bench
      controls={
        <>
          <JudgeSetPickers judgeId={judgeId} setJudgeId={setJudgeId} setId={setId} setSetId={setSetId} />
          <Button className="w-full gap-1.5" disabled={!judgeId || !setId || start.isPending || tracked.running} onClick={() => start.mutate(undefined)}><Play className="h-4 w-4" /> Run judge on the set</Button>
          <JobBar jobId={tracked.jobId} />
          <Field label="Judge run"><SelectBox value={runId} onChange={setRunId} placeholder="run the judge first"
            options={standard.map((r) => ({ value: r.id, label: runName(r) }))} /></Field>
          <Field label="Compare with rater"><SelectBox value={rater} onChange={setRater} options={(raters.length ? raters : [rater]).map((r) => ({ value: r, label: r }))} /></Field>
          <Button variant="outline" className="w-full" disabled={!runId || validate.isPending} onClick={() => validate.mutate(runId)}>Validate against {rater}</Button>
          <PrincipalNote title="Which number to trust">
            Accuracy is inflated when most answers pass. <strong>κ</strong> removes chance agreement. For a gate, the key number is
            <strong> fail recall</strong>: of the answers you failed, how many the judge failed. A judge with 90% accuracy and 40% fail recall
            waves most bad answers through.
          </PrincipalNote>
        </>
      }
    >
      {!report ? <EmptyState icon={Scale} title="No validation yet">Label the set, run a judge, then validate.</EmptyState>
        : report.n === 0 ? <EmptyState icon={Scale} title="Nothing to compare">{report.note}</EmptyState> : <ValidationView r={report} />}
    </Bench>
  );
}

function runName(r: JudgeRunSummary) {
  const t = r.spec.temperature as number | undefined;
  return `${r.judge_id} v${r.judge_version} · ${r.probe}${r.repeats > 1 ? ` ×${r.repeats}` : ''}${t != null ? ` · T=${t}` : ''} · ${fmtTime(r.created_at)}`;
}

function ValidationView({ r }: { r: ValidationReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Samples" value={r.n} sub={`judge ${r.judge.id} v${r.judge.version}`} />
        <Stat label="Accuracy" value={pct(r.accuracy)} />
        <Stat label="Cohen's κ" value={f2(r.kappa)} sub={`[${f2(r.kappa_ci[0])}, ${f2(r.kappa_ci[1])}] · ${r.kappa_reading}`} />
        <Stat label="Fail recall" value={pct(r.fail_recall)} sub="human fails the judge caught" />
        <Stat label="Pass rate" value={`${pct(r.judge_pass_rate)}`} sub={`human ${pct(r.human_pass_rate)} · gap ${r.pass_rate_gap >= 0 ? '+' : ''}${pct(r.pass_rate_gap)}`} />
        <Stat label="Corrected pass rate" value={pct(r.corrected_pass_rate)} sub="Rogan–Gladen, from TPR/TNR" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Well title="Verdicts" hint="Rows: you. Columns: the judge. Off-diagonal = disagreement; bottom-left = failures the judge let through.">
          <ConfusionGrid matrix={r.confusion.matrix} labels={r.confusion.labels} rowTitle="human" colTitle="judge" />
        </Well>
        {r.scores && (
          <Well title="Scores (1–5)" hint={`Spearman ${f2(r.scores.spearman)} · mean bias ${r.scores.mean_bias >= 0 ? '+' : ''}${f2(r.scores.mean_bias)} · MAE ${f2(r.scores.mae)}`}>
            <ConfusionGrid matrix={r.scores.confusion} labels={r.scores.labels} rowTitle="human" colTitle="judge" />
          </Well>
        )}
      </div>
      <Well title="By kind of answer" hint="The designer's tag, hidden while labelling. A judge is rarely wrong everywhere — it is wrong on a kind.">
        <table className="w-full text-xs">
          <thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">kind</th><th>n</th><th>human pass</th><th>judge pass</th><th>agreement</th></tr></thead>
          <tbody>{r.per_kind.map((k) => (
            <tr key={k.kind} className={cn('border-t border-white/5', k.agreement < 0.7 && 'text-amber-200')}>
              <td className="py-1">{k.kind}</td><td className="font-mono">{k.n}</td><td className="font-mono">{pct(k.human_pass_rate)}</td><td className="font-mono">{pct(k.judge_pass_rate)}</td><td className="font-mono">{pct(k.agreement)}</td>
            </tr>
          ))}</tbody>
        </table>
      </Well>
      {r.human_human.length > 0 && (
        <Well title="Human vs human — the ceiling" hint="A judge cannot be validated more precisely than two people agree.">
          {r.human_human.map((h) => <p key={h.rater} className="text-xs">{r.rater} vs {h.rater}: κ {f2(h.kappa)} · agreement {pct(h.agreement)} · n={h.n}</p>)}
        </Well>
      )}
      <Well title={`Disagreements · ${r.disagreements.length}`}>
        <div className="space-y-2">
          {r.disagreements.map((d) => (
            <div key={d.sample_id} className="rounded-lg border border-white/8 p-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono">{d.sample_id}</span><Pill>{d.kind}</Pill>
                <span className="text-muted-foreground">you</span><Pill tone={d.human === 'pass' ? 'good' : 'bad'}>{d.human}{d.human_score != null ? ` ${d.human_score}` : ''}</Pill>
                <span className="text-muted-foreground">judge</span><Pill tone={d.judge === 'pass' ? 'good' : 'bad'}>{d.judge}{d.judge_score != null ? ` ${f2(d.judge_score)}` : ''}</Pill>
              </div>
              <p className="mt-1">{d.question}</p>
              <p className="mt-1 text-muted-foreground">Answer: {d.answer}</p>
              <p className="mt-1 text-muted-foreground">Judge: {d.reasoning}</p>
              {d.human_note && <p className="mt-1 text-muted-foreground">Your note: {d.human_note}</p>}
            </div>
          ))}
        </div>
      </Well>
    </div>
  );
}

/* ── Bias probes ─────────────────────────────────────────────────────────── */

function Bias() {
  const [judgeId, setJudgeId] = useState('');
  const [setId, setSetId] = useState('');
  const [rater] = useRater();
  const [probe, setProbe] = useState<'position' | 'verbosity' | 'consistency'>('position');
  const [identical, setIdentical] = useState(6);
  const [padding, setPadding] = useState('filler');
  const [withFaith, setWithFaith] = useState(false);
  const [repeats, setRepeats] = useState(5);
  const [temperature, setTemperature] = useState(0.7);
  const [runId, setRunId] = useState<string | null>(null);
  const config = useGenConfig();
  const tracked = useTrackedJob();
  const run = useJudgeRun(runId);

  const start = useEvalMutation(() => {
    if (probe === 'position') return genApi.position({ judge_id: judgeId, set_id: setId, rater, identical });
    if (probe === 'verbosity') return genApi.verbosity({ judge_id: judgeId, set_id: setId, padding, rater, with_faithfulness: withFaith });
    return genApi.startJudgeRun({ judge_id: judgeId, set_id: setId, repeats, temperature, probe: 'consistency' });
  }, { success: 'Probe started', onSuccess: (j) => tracked.start(j.id) });
  useEffect(() => {
    const id = tracked.job?.status === 'done' ? String(tracked.job.result.judge_run_id ?? '') : '';
    if (id) setRunId(id);
  }, [tracked.job?.status]);

  const s = (run.data?.summary ?? {}) as Record<string, number | string[] | string | null>;
  const num = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null);
  const list = (k: string) => (Array.isArray(s[k]) ? (s[k] as string[]) : []);

  return (
    <Bench
      controls={
        <>
          <JudgeSetPickers judgeId={judgeId} setJudgeId={setJudgeId} setId={setId} setSetId={setSetId} />
          <Field label="Probe"><Segmented value={probe} onChange={setProbe} size="xs" options={[{ value: 'position', label: 'position' }, { value: 'verbosity', label: 'verbosity' }, { value: 'consistency', label: 'consistency' }]} /></Field>
          {probe === 'position' && (
            <Field label="Identical pairs" hint="The same answer as A and B. Any preference here is pure position bias."><TextField type="number" min={0} max={40} value={identical} onChange={(e) => setIdentical(Number(e.target.value))} /></Field>
          )}
          {probe === 'verbosity' && (
            <>
              <Field label="Padding (adds no facts)" hint={config.data?.paddings[padding]}>
                <SelectBox value={padding} onChange={setPadding} options={[{ value: 'filler', label: 'filler — polite advice' }, { value: 'restate', label: 'restate — generic background' }, { value: 'authority', label: 'authority — "this is fully accurate"' }]} />
              </Field>
              <Toggle checked={withFaith} onChange={setWithFaith} label="Also score claim-level faithfulness (slower)" />
            </>
          )}
          {probe === 'consistency' && (
            <>
              <Field label="Repeats per sample"><TextField type="number" min={2} max={10} value={repeats} onChange={(e) => setRepeats(Number(e.target.value))} /></Field>
              <Field label={`Temperature ${temperature.toFixed(1)}`} hint="Overrides the judge's own temperature for this probe."><input type="range" min={0} max={1.5} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" /></Field>
            </>
          )}
          <Button className="w-full gap-1.5" disabled={!judgeId || !setId || start.isPending || tracked.running} onClick={() => start.mutate(undefined)}><Play className="h-4 w-4" /> Run probe</Button>
          <JobBar jobId={tracked.jobId} />
        </>
      }
    >
      {!run.data ? <EmptyState icon={Timer} title="Run a probe">Each probe changes one thing the judge should ignore, and measures whether it did.</EmptyState> : (
        <>
          <div className="flex flex-wrap gap-1.5"><Pill tone="neon">{run.data.probe}</Pill><Pill>{runName(run.data)}</Pill><Pill>fingerprint {run.data.fingerprint}</Pill></div>
          {run.data.probe === 'position' && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Consistency" value={pct(num('consistency'))} sub={`same pick after swapping · ${num('pairs')} pairs`} />
                <Stat label="Picks position A" value={pct(num('first_position_rate'))} sub="fair ≈ 50%" />
                <Stat label="Identical pairs not tied" value={pct(num('identical_non_tie_rate'))} sub="fair = 0%" />
                <Stat label="Agrees with you" value={pct(num('accuracy_vs_human'))} sub="over both orders" />
              </div>
              <Well title="Pairs">
                <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">x</th><th>y</th><th>you prefer</th><th>x shown first →</th><th>y shown first →</th></tr></thead>
                  <tbody>{run.data.results.map((row, i) => {
                    const r = row as { x: string; y: string; preferred: string | null; identical: boolean; chosen?: string[] };
                    const name = (c?: string) => (c === 'x' ? r.x : c === 'y' ? r.y : c ?? '—');
                    return (
                      <tr key={i} className={cn('border-t border-white/5', r.chosen && r.chosen[0] !== r.chosen[1] && 'text-amber-200')}>
                        <td className="py-1 font-mono">{r.x}</td><td className="font-mono">{r.identical ? '(same)' : r.y}</td><td className="font-mono">{r.preferred ?? '—'}</td>
                        <td className="font-mono">{name(r.chosen?.[0])}</td><td className="font-mono">{name(r.chosen?.[1])}</td>
                      </tr>
                    );
                  })}</tbody></table>
              </Well>
            </>
          )}
          {run.data.probe === 'verbosity' && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Mean score change" value={num('mean_delta') == null ? '—' : `${(num('mean_delta') ?? 0) >= 0 ? '+' : ''}${f2(num('mean_delta'))}`} sub={`CI [${f2(num('delta_low'))}, ${f2(num('delta_high'))}]`} />
                <Stat label="Up / same / down" value={`${num('up') ?? 0} / ${num('same') ?? 0} / ${num('down') ?? 0}`} />
                <Stat label="Fail → pass" value={list('fail_to_pass').length} sub={list('fail_to_pass').join(', ') || 'none'} />
                <Stat label="Faithfulness change" value={num('faithfulness_delta') == null ? '—' : f2(num('faithfulness_delta'))} sub="claim-level, same padding" />
              </div>
              <Well title="Per sample" hint={String(s.padding_text ?? '')}>
                <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">sample</th><th>kind</th><th>you</th><th>original</th><th>padded</th></tr></thead>
                  <tbody>{run.data.results.map((row, i) => {
                    const r = row as { sample_id: string; kind: string; human: string | null; original_score: number | null; padded_score: number | null; original_verdict: string; padded_verdict: string };
                    return (
                      <tr key={i} className={cn('border-t border-white/5', r.original_verdict !== r.padded_verdict && 'text-amber-200')}>
                        <td className="py-1 font-mono">{r.sample_id}</td><td>{r.kind}</td><td>{r.human ?? '—'}</td>
                        <td className="font-mono">{r.original_score ?? r.original_verdict}</td><td className="font-mono">{r.padded_score ?? r.padded_verdict}</td>
                      </tr>
                    );
                  })}</tbody></table>
              </Well>
            </>
          )}
          {run.data.probe === 'consistency' && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Stat label="Verdict flip rate" value={pct(num('flip_rate'))} sub="samples whose verdict changed between repeats" />
                <Stat label="Mean score SD" value={f2(num('mean_score_sd'))} />
                <Stat label="Pass rate" value={pct(num('pass_rate'))} />
              </div>
              <Well title="Per sample">
                <table className="w-full text-xs"><tbody>{run.data.results.map((row, i) => {
                  const r = row as { sample_id: string; kind: string; scores: (number | null)[]; verdicts: string[] };
                  return (
                    <tr key={i} className={cn('border-t border-white/5', new Set(r.verdicts).size > 1 && 'text-amber-200')}>
                      <td className="py-1 font-mono">{r.sample_id}</td><td>{r.kind}</td><td className="font-mono">{r.scores.join(' ')}</td><td className="font-mono">{r.verdicts.join(' ')}</td>
                    </tr>
                  );
                })}</tbody></table>
              </Well>
            </>
          )}
        </>
      )}
    </Bench>
  );
}

/* ── Drift ───────────────────────────────────────────────────────────────── */

function Drift() {
  const sets = useJudgeSets();
  const [setId, setSetId] = useState('');
  const [rater] = useRater();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [report, setReport] = useState<DriftReport | null>(null);
  const runs = useJudgeRuns(setId || null);
  useEffect(() => { if (!setId && sets.data?.[0]) setSetId(sets.data[0].id); }, [sets.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmp = useEvalMutation(() => genApi.drift(a, b, rater), { onSuccess: setReport });
  const options = (runs.data ?? []).filter((r) => r.probe === 'standard').map((r) => ({ value: r.id, label: runName(r) }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <Field label="Sample set"><SelectBox value={setId} onChange={setSetId} options={(sets.data ?? []).map((s) => ({ value: s.id, label: s.name }))} /></Field>
        <Field label="Run A (before)"><SelectBox value={a} onChange={setA} options={options} /></Field>
        <Field label="Run B (after)"><SelectBox value={b} onChange={setB} options={options} /></Field>
        <Button disabled={!a || !b || a === b || cmp.isPending} onClick={() => cmp.mutate(undefined)}>Compare</Button>
      </div>
      {report && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={report.same_fingerprint ? 'good' : 'warn'}>{report.same_fingerprint ? 'same judge fingerprint' : 'different judge'}</Pill>
            {report.changed_fields.map((f) => <Pill key={f}>changed: {f}</Pill>)}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label="Verdict agreement" value={pct(report.verdict_agreement)} sub={`n=${report.n}`} />
            <Stat label="κ between runs" value={f2(report.kappa_between_runs)} />
            <Stat label="Pass rate A → B" value={`${pct(report.pass_rate_a)} → ${pct(report.pass_rate_b)}`} />
            <Stat label="Mean score shift" value={report.score_shift ? `${report.score_shift.mean >= 0 ? '+' : ''}${f2(report.score_shift.mean)}` : '—'} sub={report.score_shift ? `[${f2(report.score_shift.low)}, ${f2(report.score_shift.high)}]` : ''} />
            <Stat label="Flips" value={report.flips.length} />
          </div>
          {report.validation && (
            <Well title={`Against ${rater}: did the change move the judge toward you?`}>
              <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase text-muted-foreground"><tr><th className="py-1">run</th><th>accuracy</th><th>κ</th><th>fail recall</th><th>pass-rate gap</th></tr></thead>
                <tbody>{(['a', 'b'] as const).map((k) => {
                  const v = report.validation![k];
                  return <tr key={k} className="border-t border-white/5"><td className="py-1 uppercase">{k}</td><td className="font-mono">{pct(v.accuracy)}</td><td className="font-mono">{f2(v.kappa)}</td><td className="font-mono">{pct(v.fail_recall)}</td><td className="font-mono">{pct(v.pass_rate_gap)}</td></tr>;
                })}</tbody></table>
            </Well>
          )}
          <Well title="Flipped samples">
            <table className="w-full text-xs"><tbody>{report.flips.map((f) => (
              <tr key={f.sample_id} className="border-t border-white/5"><td className="py-1 font-mono">{f.sample_id}</td><td>{f.kind}</td><td>{f.from} → {f.to}</td><td className="font-mono">{f.score_a ?? ''} → {f.score_b ?? ''}</td></tr>
            ))}</tbody></table>
          </Well>
        </>
      )}
    </div>
  );
}
