import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowLeft, Check, CheckCheck, ChevronDown, EyeOff, Pencil, Plus, Scale, Timer, UserRound, UserRoundCheck, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation, useEvalMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Pager, Panel, Pill, PrincipalNote, SelectBox, Stat, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ConfusionGrid } from '@/features/evaluation/components/statCharts';
import { fmt3 } from '@/features/evaluation/lib/evalStats';
import { GradeButtons } from './PoolingSection';
import type { AnnotationTask, DatasetBundle } from '@/types/eval';

const PAGE_SIZE = 10;

export function AgreementSection({ bundle }: { bundle: DatasetBundle }) {
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const draft = bundle.manifest.status === 'draft';
  const qc = useQueryClient();

  const [annotator, setAnnotator] = useState('annotator-2');
  const [sample, setSample] = useState(10);
  const [task, setTask] = useState<AnnotationTask | null>(null);
  const [index, setIndex] = useState(0);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState(Date.now());
  const [raterB, setRaterB] = useState('');
  const [inBatch, setInBatch] = useState(false);
  const [page, setPage] = useState(1);
  const [openBatch, setOpenBatch] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editName, setEditName] = useState('');

  const raters = useQuery({ queryKey: ['eval', 'annotations', id, version], queryFn: () => evalApi.annotations(id, version) });
  const otherRaters = (raters.data?.raters ?? []).filter((r) => r !== 'gold');
  useEffect(() => { if (!raterB && otherRaters.length) setRaterB(otherRaters[0]); }, [otherRaters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const agreement = useQuery({
    queryKey: ['eval', 'agreement', id, version, raterB],
    queryFn: () => evalApi.agreement(id, version, 'gold', raterB),
    enabled: !!raterB,
  });

  const fetchTask = useEvalMutation(() => evalApi.annotationTask(id, version, annotator.trim(), sample, 7), {
    onSuccess: (t: AnnotationTask) => {
      setTask(t);
      setIndex(0);
      setGrades({});
      setStartedAt(Date.now());
      setInBatch(true);
      setOpenBatch(false);
    },
  });
  const submit = useEvalMutation(
    (p: { itemId: string; grades: Record<string, number>; seconds: number }) =>
      evalApi.annotate(id, version, annotator.trim(), p.itemId, p.grades, p.seconds),
    {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['eval', 'annotations', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'agreement', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'readiness'] });
        setIndex((i) => i + 1);
        setGrades({});
        setStartedAt(Date.now());
        setRaterB(annotator.trim());
      },
    },
  );
  const adopt = useDatasetMutation((p: { item_id: string; doc_id: string; grade: number }) => evalApi.judge(id, version, p),
    'Gold label updated');
  const rename = useEvalMutation(
    (name: string) => evalApi.renameAnnotator(id, version, raterB, name),
    {
      success: 'Annotator updated',
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: ['eval', 'annotations', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'agreement', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'readiness'] });
        setRaterB(data.annotator);
        setPage(1);
        setOpenEdit(false);
      },
    },
  );
  const simulate = useEvalMutation(
    () => evalApi.simulateAudit(id, version, { annotator: annotator.trim(), sample, agreement: 0.8, seed: 7 }),
    {
      success: 'Simulated auditing — second rater filled from gold (~80% agreement)',
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: ['eval', 'annotations', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'agreement', id, version] });
        qc.invalidateQueries({ queryKey: ['eval', 'readiness'] });
        setRaterB(data.annotator);
        setPage(1);
        setInBatch(false);
      },
    },
  );

  const item = task?.items[index];
  const complete = item ? item.docs.every((d) => grades[d.doc_id] !== undefined) : false;
  const report = agreement.data;
  const showItem = inBatch && !!item;
  const disagreements = report?.disagreements ?? [];
  const totalPages = Math.max(1, Math.ceil(disagreements.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const disagreementSlice = disagreements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const canSimulate = !!annotator.trim() && annotator.trim() !== 'gold' && bundle.items.length > 0;

  function startBatch() {
    if (!canSimulate || fetchTask.isPending) return;
    fetchTask.mutate(undefined);
  }

  function fillLocalAuditGrades() {
    if (!item) return;
    const goldItem = bundle.items.find((i) => i.id === item.item_id);
    const next: Record<string, number> = {};
    for (const d of item.docs) {
      next[d.doc_id] = goldItem?.relevant[d.doc_id] ?? 0;
    }
    setGrades(next);
  }

  return (
    <div className="space-y-4">
      <Panel
        title={showItem ? item.item_id : 'Label audit'}
        icon={showItem ? EyeOff : Scale}
        subtitle={showItem
          ? 'You see the question and shuffled documents — never the existing labels.'
          : 'Blind re-annotation, then agreement with gold.'}
        actions={
          showItem ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setInBatch(false)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Overview
            </Button>
          ) : task && item ? (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setInBatch(true)}>
              Resume batch {index + 1}/{task.items.length}
            </Button>
          ) : undefined
        }
      >
        {showItem ? (
          <div key={item.item_id} className="animate-fade-in space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pill tone="neon">{index + 1} / {task!.items.length}</Pill>
              <span className="font-mono">{item.item_id}</span>
              <span className="ml-auto flex items-center gap-1"><Timer className="h-3 w-3" /> timed — slow items are informative</span>
            </div>
            <p dir="auto" className="text-base font-medium">{item.query}</p>
            <div className="space-y-2">
              {item.docs.map((d) => (
                <div key={d.doc_id} className="rounded-lg border border-white/8 bg-card/30 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono">{d.doc_id}</span>
                    <span className="ml-auto">
                      <GradeButtons value={grades[d.doc_id] ?? null}
                        onChange={(g) => setGrades((cur) => {
                          const next = { ...cur };
                          if (g === null) delete next[d.doc_id]; else next[d.doc_id] = g;
                          return next;
                        })} />
                    </span>
                  </div>
                  <p dir="auto" className="mt-1.5 line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{d.excerpt}</p>
                </div>
              ))}
            </div>
            <Button className="w-full" disabled={!complete || submit.isPending}
              onClick={() => submit.mutate({ itemId: item.item_id, grades, seconds: (Date.now() - startedAt) / 1000 })}>
              {complete ? 'Submit & next' : 'Grade every document (0 = not relevant)'}
            </Button>
            <Button variant="outline" className="w-full gap-1.5" disabled={submit.isPending} onClick={fillLocalAuditGrades}>
              <Wand2 className="h-4 w-4" /> Simulate Auditing
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Rubric: <strong>3</strong> answers the question · <strong>2</strong> substantially helps · <strong>1</strong> related
              but insufficient · <strong>0</strong> not relevant. Decide before you look at the document list, and apply it the same way every time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="gap-1.5" onClick={() => setOpenBatch(true)}>
                <Plus className="h-4 w-4" /> New audit batch
              </Button>
              <Button variant="outline" className="gap-1.5"
                disabled={!canSimulate || simulate.isPending}
                onClick={() => simulate.mutate(undefined)}>
                <Wand2 className="h-4 w-4" /> Simulate Auditing
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Simulate Auditing fabricates a second rater from gold (~80% agreement) and stamps it
              <strong> simulated</strong> — agreement numbers appear, but the Learning Path will not count it as real judging.
            </p>

            {task && !item && (
              <EmptyState icon={CheckCheck} title="Batch complete">
                {task.remaining > 0 ? `${task.remaining} item(s) left for ${task.annotator}. Start another batch.` : 'Every item is annotated by this annotator.'}
              </EmptyState>
            )}

            {!report ? (
              <EmptyState icon={Scale} title="No annotations yet">Annotate a batch to compare with the dataset's labels.</EmptyState>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agreement with gold</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Compare a second rater against the dataset labels.</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RaterPicker
                      value={raterB}
                      counts={raters.data?.annotators ?? {}}
                      raters={otherRaters}
                      onChange={(v) => { setRaterB(v); setPage(1); }}
                    />
                    {raterB && (
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" title="Edit annotator"
                        onClick={() => { setEditName(raterB); setOpenEdit(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Stat label="Pairs" value={report.pairs} sub={`${report.items} items`} />
                  <Stat label="% agreement" value={report.percent_agreement !== null ? `${(report.percent_agreement * 100).toFixed(0)}%` : '—'}
                    sub={`binary ${report.percent_agreement_binary !== null ? (report.percent_agreement_binary * 100).toFixed(0) : '—'}%`} />
                  <Stat label="Cohen's κ (binary)" value={fmt3(report.kappa_binary)} sub={report.interpretation_binary} />
                  <Stat label="Weighted κ (0–3)" value={fmt3(report.kappa_weighted)} sub={report.interpretation_weighted} />
                </div>
                {report.notes.map((n) => (
                  <p key={n} className="rounded-md border border-amber-500/20 bg-amber-500/[0.05] p-2 text-[11px] text-amber-200">{n}</p>
                ))}
                <div className="grid gap-3 md:grid-cols-2">
                  <ConfusionGrid matrix={report.confusion} labels={['0', '1', '2', '3']} rowTitle="gold" colTitle={report.rater_b} />
                  <ConfusionGrid matrix={report.confusion_binary} labels={['not rel.', 'relevant']} rowTitle="gold" colTitle={report.rater_b} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Share of pairs gold marks relevant: {(report.prevalence_relevant * 100).toFixed(0)}%. The rarer "relevant" is, the more
                  raw agreement comes free — which is exactly what κ subtracts.
                </p>
              </div>
            )}

            {report && report.disagreements.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Disagreements · {report.disagreements.length} — largest first. Adopt the other grade if gold is wrong.
                </p>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1 pr-2">item</th><th className="pr-2">query</th><th className="pr-2">doc</th><th className="pr-2">gold</th><th className="pr-2">{report.rater_b}</th><th className="pr-2" /><th /></tr>
                    </thead>
                    <tbody>
                      {disagreementSlice.map((d) => (
                        <tr key={`${d.item_id}-${d.doc_id}`} className="border-t border-white/5">
                          <td className="py-1.5 pr-2 font-mono text-[10px]">{d.item_id}</td>
                          <td className="max-w-[280px] truncate pr-2" dir="auto" title={d.query}>{d.query}</td>
                          <td className="pr-2 font-mono text-[10px]">{d.doc_id}</td>
                          <td className="pr-2 font-mono">{d.a}{d.gold_assumed && <span className="ml-1 text-amber-300" title="never judged — assumed 0">*</span>}</td>
                          <td className="pr-2 font-mono">{d.b}</td>
                          <td className="pr-2">{d.binary_flip ? <Pill tone="bad">relevance flip</Pill> : <Pill>grade Δ{d.distance}</Pill>}</td>
                          <td className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={!draft || adopt.isPending}
                              title={draft ? '' : 'Frozen — fork to change gold labels'}
                              onClick={() => adopt.mutate({ item_id: d.item_id, doc_id: d.doc_id, grade: d.b },
                                { onSuccess: () => qc.invalidateQueries({ queryKey: ['eval', 'agreement', id, version] }) })}>
                              adopt {report.rater_b}'s grade
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={safePage} pageSize={PAGE_SIZE} total={disagreements.length} onPage={setPage} />
                <p className="mt-2 text-[10px] text-muted-foreground">* gold never judged this document; its 0 is an assumption, so the disagreement may be a gap in gold.</p>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Dialog open={openBatch} onOpenChange={setOpenBatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New audit batch</DialogTitle>
            <DialogDescription>
              Blind re-annotation: the annotator sees the question and shuffled documents, never the existing labels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Annotator name">
              <TextField
                autoFocus
                placeholder="e.g. annotator-2"
                value={annotator}
                onChange={(e) => setAnnotator(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') startBatch(); }}
              />
            </Field>
            <Field label="Batch size" hint="How many items to grade in this session.">
              <SelectBox value={sample} onChange={setSample} options={[5, 10, 20, 30].map((n) => ({ value: n, label: `${n}` }))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpenBatch(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" disabled={!canSimulate || fetchTask.isPending} onClick={startBatch}>
              <UserRoundCheck className="h-3.5 w-3.5" /> Start batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit annotator</DialogTitle>
            <DialogDescription>
              Rename this stored rater. Their grades stay attached; only the display name changes.
            </DialogDescription>
          </DialogHeader>
          <Field label="Annotator name">
            <TextField
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editName.trim() && editName.trim() !== 'gold') {
                  rename.mutate(editName.trim());
                }
              }}
            />
          </Field>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5"
              disabled={!editName.trim() || editName.trim() === 'gold' || rename.isPending}
              onClick={() => rename.mutate(editName.trim())}>
              <Pencil className="h-3.5 w-3.5" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrincipalNote title="Inter-annotator agreement">
        Every metric inherits its labels' error rate: if two careful people disagree on a third of (question, document)
        pairs, a 3-point recall difference is below the ruler's resolution. <strong>Percent agreement</strong> is inflated by
        chance; <strong>Cohen's κ</strong> subtracts the agreement two annotators would reach labelling at random with their
        own label frequencies; <strong>weighted κ</strong> makes a 2-vs-3 disagreement cost less than 0-vs-3. Watch for the
        <strong> kappa paradox</strong>: when almost everything is "not relevant", 90% agreement and a low κ can both be true.
      </PrincipalNote>
    </div>
  );
}

function RaterPicker({
  value, raters, counts, onChange,
}: {
  value: string;
  raters: string[];
  counts: Record<string, number>;
  onChange: (v: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  if (raters.length === 0) return null;
  const selected = raters.includes(value) ? value : raters[0];
  const selectedCount = counts[selected] ?? 0;

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const w = triggerRef.current?.getBoundingClientRect().width;
          if (w) setMenuWidth(w);
        }
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Choose annotator"
          className={cn(
            'group flex h-9 w-[16.5rem] items-center gap-2 rounded-xl border px-2 text-left transition-all',
            'border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 shadow-inner',
            'hover:border-neon/40 hover:bg-white/[0.04]',
            open && 'border-neon/45 shadow-glow-inner',
          )}
        >
          <span className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            open ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-neon/15 text-neon',
          )}>
            <UserRound className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">{selected}</span>
          </span>
          <Pill>{selectedCount} items</Pill>
          <ChevronDown className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-neon',
          )} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          style={{ width: Math.max(menuWidth ?? 0, 280), minWidth: 280 }}
          className={cn(
            'z-[80] overflow-hidden rounded-xl border border-white/12 p-1 shadow-panel',
            'bg-[hsl(var(--popover)/0.96)] backdrop-blur-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Second rater
          </p>
          <div className="max-h-64 overflow-y-auto py-0.5">
            {raters.map((name) => {
              const active = name === selected;
              const n = counts[name] ?? 0;
              return (
                <DropdownMenu.Item
                  key={name}
                  onSelect={() => onChange(name)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 outline-none',
                    'data-[highlighted]:bg-neon/12',
                    active && 'bg-neon/10',
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    active ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-white/5 text-muted-foreground',
                  )}>
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>{name}</span>
                    <span className="text-[11px] text-muted-foreground">{n} annotated item{n === 1 ? '' : 's'}</span>
                  </span>
                  <Check className={cn('h-3.5 w-3.5 shrink-0 text-neon', active ? 'opacity-100' : 'opacity-0')} />
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
