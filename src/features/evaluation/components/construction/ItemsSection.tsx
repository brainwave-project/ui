import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ListChecks, Lock, Plus, Save, Trash2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Pager, Panel, Pill, PrincipalNote, Segmented, SelectBox,
  TextArea, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import type { DatasetBundle, Difficulty, Evidence, GoldenItem } from '@/types/eval';

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const PAGE_SIZE = 10;
const GRADES = [
  { value: 3, label: '3 · fully answers' },
  { value: 2, label: '2 · substantially' },
  { value: 1, label: '1 · partially / related' },
];

const normText = (s: string) => s.split(/\s+/).filter(Boolean).join(' ').toLowerCase();

/**
 * Narrow the table to the rows a readiness check is complaining about.
 *
 * The free-text filter searches id/query/trap/origin, which cannot express
 * "unassigned split" or "difficulty = hard". These facets can, so a check that
 * names a defect can hand over the exact rows instead of a vague search term.
 */
function matchesFacet(item: GoldenItem, facet: string | null): boolean {
  if (!facet) return true;
  const [kind, value = ''] = facet.split(':');
  switch (kind) {
    case 'ids':        return value.split(',').includes(item.id);
    case 'split':      return value === 'none' ? item.split == null : item.split === value;
    case 'origin':     return item.origin === value;
    case 'difficulty': return item.difficulty === value;
    case 'trap':       return item.trap === value;
    case 'lang':       return item.lang === value;
    case 'evidence':   return value === 'none' ? item.evidence.length === 0 : true;
    case 'answerable': return value === 'no' ? Object.keys(item.relevant).length === 0 : true;
    default:           return true;
  }
}

const FACET_LABEL: Record<string, string> = {
  ids: 'these items', split: 'split', origin: 'origin', difficulty: 'difficulty',
  trap: 'trap', lang: 'language', evidence: 'evidence', answerable: 'answerable',
};

const emptyItem = (id: string, lang: string): GoldenItem => ({
  id, query: '', lang, relevant: {}, evidence: [], ground_truth: '', difficulty: 'medium',
  trap: 'none', tags: [], split: null, pinned: false, notes: '', judged_nonrelevant: [], origin: 'human',
});

export function ItemsSection({ bundle }: { bundle: DatasetBundle }) {
  const locked = bundle.manifest.status === 'frozen';
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const [editing, setEditing] = useState<GoldenItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [jsonl, setJsonl] = useState('');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  // A readiness check links here with `f=` (which rows are at fault) and
  // optionally `item=` (open that one). Both are cleared once consumed, so the
  // narrowed view never outlives the question that caused it.
  const [params, setParams] = useSearchParams();
  const facet = params.get('f');
  const wantedItem = params.get('item');

  const clearFacet = () => {
    const next = new URLSearchParams(params);
    next.delete('f');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!wantedItem) return;
    const match = bundle.items.find((i) => i.id === wantedItem);
    if (match) {
      setEditing(match);
      setIsNew(false);
    }
    const next = new URLSearchParams(params);
    next.delete('item');
    setParams(next, { replace: true });
    // Runs once per incoming link; `params` is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedItem, bundle.items]);

  const save = useDatasetMutation((item: GoldenItem) => evalApi.putItem(id, version, item), 'Item saved');
  const remove = useDatasetMutation((itemId: string) => evalApi.deleteItem(id, version, itemId), 'Item removed');
  const importItems = useDatasetMutation(() => evalApi.importItems(id, version, jsonl, mode), 'Items imported');

  const bodies = useMemo(() => Object.fromEntries(bundle.corpus.map((d) => [d.doc_id, normText(d.body)])), [bundle.corpus]);
  const rows = bundle.items.filter((i) =>
    matchesFacet(i, facet)
    && (!filter || `${i.id} ${i.query} ${i.trap} ${i.origin}`.toLowerCase().includes(filter.toLowerCase())));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function newItem() {
    let n = bundle.items.length + 1;
    while (bundle.items.some((i) => i.id === `q-${String(n).padStart(3, '0')}`)) n++;
    setEditing(emptyItem(`q-${String(n).padStart(3, '0')}`, bundle.meta.lang));
    setIsNew(true);
  }

  return (
    <div className="space-y-4">
      <Panel
        title={editing ? editing.id : 'Golden items'}
        icon={ListChecks}
        subtitle={editing
          ? 'Edit the item, then save or go back to the list.'
          : `${bundle.items.length} items · ${bundle.split_summary.dev} dev · ${bundle.split_summary.holdout} holdout · ${bundle.split_summary.unassigned} unassigned`}
        actions={
          editing ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => { setEditing(null); setIsNew(false); }}>
              <ArrowLeft className="h-3.5 w-3.5" /> List
            </Button>
          ) : (
            <>
              <TextField className="h-8 w-40 text-xs" placeholder="filter…" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} />
              {!locked && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowImport((v) => !v)}>
                    <Upload className="h-3.5 w-3.5" /> JSONL
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs" onClick={newItem}><Plus className="h-3.5 w-3.5" /> Item</Button>
                </>
              )}
            </>
          )
        }>
        {editing ? (
          <ItemEditor
            key={`${editing.id}-${isNew}`}
            item={editing}
            bundle={bundle}
            locked={locked}
            saving={save.isPending}
            duplicateId={isNew && bundle.items.some((i) => i.id === editing.id)}
            onSave={(item) => save.mutate(item, { onSuccess: () => { setEditing(item); setIsNew(false); } })}
          />
        ) : (
          <>
            {showImport && !locked && (
              <div className="mb-3 space-y-2 rounded-lg border border-white/8 p-3">
                <p className="text-[11px] text-muted-foreground">
                  One JSON object per line. Accepts the lab schema or the harness schema
                  (<code className="font-mono">relevant_doc_ids</code>, <code className="font-mono">holdout</code>).
                </p>
                <TextArea dir="auto" value={jsonl} onChange={(e) => setJsonl(e.target.value)}
                  placeholder='{"id": "q-001", "query": "What is the refund window?", "relevant": {"refund-policy": 3}, "difficulty": "easy"}' />
                <div className="flex items-center gap-2">
                  <Segmented size="xs" value={mode} onChange={setMode}
                    options={[{ value: 'append', label: 'append' }, { value: 'replace', label: 'replace all' }]} />
                  <Button size="sm" className="ml-auto text-xs" disabled={!jsonl.trim() || importItems.isPending}
                    onClick={() => importItems.mutate(undefined, { onSuccess: () => { setJsonl(''); setShowImport(false); } })}>
                    Import
                  </Button>
                </div>
              </div>
            )}
            {bundle.items.length === 0 ? (
              <EmptyState icon={ListChecks} title="No golden items">
                A golden item is a question plus the documents that answer it, graded. Write them the way a user would ask —
                or generate candidates in Synthetic and review them.
              </EmptyState>
            ) : rows.length === 0 ? (
              <EmptyState icon={ListChecks} title="No matching items">
                {facet ? (
                  <>
                    No item matches the check that sent you here.{' '}
                    <button type="button" className="text-neon underline-offset-2 hover:underline" onClick={clearFacet}>
                      Show all items
                    </button>
                  </>
                ) : 'Clear the filter to see every golden item.'}
              </EmptyState>
            ) : (
              <>
                {facet && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-neon/30 bg-neon/[0.05] px-2.5 py-1.5 text-xs">
                    <span className="text-muted-foreground">
                      Showing {rows.length} item{rows.length === 1 ? '' : 's'} from a readiness check —{' '}
                      <span className="text-foreground">
                        {FACET_LABEL[facet.split(':')[0]] ?? facet.split(':')[0]}
                        {facet.split(':')[0] !== 'ids' && ` = ${facet.split(':').slice(1).join(':')}`}
                      </span>
                    </span>
                    <button type="button" className="ml-auto text-neon underline-offset-2 hover:underline" onClick={clearFacet}>
                      Show all items
                    </button>
                  </div>
                )}
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="py-1.5 pr-2">id</th><th className="pr-2">query</th><th className="pr-2">judgements</th><th className="pr-2">diff · trap</th><th className="pr-2">split</th><th /></tr>
                    </thead>
                    <tbody>
                      {slice.map((item) => {
                        const badEvidence = item.evidence.some((e) => !bodies[e.doc_id]?.includes(normText(e.text)));
                        return (
                          <tr key={item.id}
                            className="cursor-pointer border-t border-white/5 align-top hover:bg-white/[0.03]"
                            onClick={() => { setEditing(item); setIsNew(false); }}>
                            <td className="py-1.5 pr-2 font-mono">
                              {item.id}
                              {item.origin !== 'human' && <div><Pill tone={item.origin === 'synthetic' ? 'warn' : 'neutral'}>{item.origin}</Pill></div>}
                            </td>
                            <td className="max-w-[260px] pr-2" dir="auto">{item.query}</td>
                            <td className="pr-2">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(item.relevant).map(([doc, g]) => (
                                  <Pill key={doc} tone={bundle.corpus.some((d) => d.doc_id === doc) ? 'neutral' : 'bad'} title={`grade ${g}`}>{doc}·{g}</Pill>
                                ))}
                                {Object.keys(item.relevant).length === 0 && <Pill tone="warn">unanswerable</Pill>}
                                {item.judged_nonrelevant.length > 0 && <Pill title={item.judged_nonrelevant.join(', ')}>✕ {item.judged_nonrelevant.length}</Pill>}
                                {item.evidence.length > 0 && <Pill tone={badEvidence ? 'bad' : 'good'}>{item.evidence.length} ev</Pill>}
                              </div>
                            </td>
                            <td className="whitespace-nowrap pr-2 text-muted-foreground">{item.difficulty} · {item.trap}</td>
                            <td className="pr-2">
                              {item.split ? <Pill tone={item.split === 'holdout' ? 'info' : 'neutral'}>{item.pinned && <Lock className="h-2.5 w-2.5" />}{item.split}</Pill> : <Pill tone="warn">—</Pill>}
                            </td>
                            <td className="text-right">
                              {!locked && (
                                <button className="text-muted-foreground hover:text-red-400" title="Remove"
                                  onClick={(e) => { e.stopPropagation(); remove.mutate(item.id); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pager page={safePage} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
              </>
            )}
          </>
        )}
      </Panel>
      <PrincipalNote title="Golden data">
        <strong>Graded relevance</strong> lets NDCG tell “answers the question” (3) from “related” (1) — write the rubric
        down, because the 2ᵍ−1 gain amplifies inconsistent grading. <strong>Evidence spans</strong> are copied verbatim
        from the document: they make chunk-level scoring survive rechunking. Record <strong>explicit “not relevant”</strong>
        judgements too — anything unjudged is only <em>assumed</em> irrelevant. Label <strong>traps</strong> and
        <strong> difficulty</strong> so results can be stratified.
      </PrincipalNote>
    </div>
  );
}

function ItemEditor({
  item: initial, bundle, locked, saving, duplicateId, onSave,
}: {
  item: GoldenItem; bundle: DatasetBundle; locked: boolean; saving: boolean; duplicateId: boolean;
  onSave: (item: GoldenItem) => void;
}) {
  const [item, setItem] = useState<GoldenItem>(initial);
  const [newDoc, setNewDoc] = useState('');
  const [newNegative, setNewNegative] = useState('');
  const set = <K extends keyof GoldenItem>(k: K, v: GoldenItem[K]) => setItem((cur) => ({ ...cur, [k]: v }));
  const docOptions = bundle.corpus.map((d) => ({ value: d.doc_id, label: d.doc_id }));
  const bodyOf = (doc: string) => normText(bundle.corpus.find((d) => d.doc_id === doc)?.body ?? '');
  const idValid = SLUG.test(item.id);
  const judged = new Set([...Object.keys(item.relevant), ...item.judged_nonrelevant]);

  function addRelevant() {
    const doc = newDoc || docOptions.find((o) => !judged.has(o.value))?.value;
    if (!doc) return;
    setItem((cur) => ({ ...cur, relevant: { ...cur.relevant, [doc]: 3 }, judged_nonrelevant: cur.judged_nonrelevant.filter((d) => d !== doc) }));
    setNewDoc('');
  }

  function addNegative() {
    if (!newNegative) return;
    setItem((cur) => {
      const relevant = { ...cur.relevant };
      delete relevant[newNegative];
      return {
        ...cur, relevant,
        judged_nonrelevant: [...cur.judged_nonrelevant.filter((d) => d !== newNegative), newNegative].sort(),
        evidence: cur.evidence.filter((e) => e.doc_id !== newNegative),
      };
    });
    setNewNegative('');
  }

  function setEvidence(i: number, patch: Partial<Evidence>) {
    set('evidence', item.evidence.map((e, n) => (n === i ? { ...e, ...patch } : e)));
  }

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {item.origin !== 'human' && <Pill tone={item.origin === 'synthetic' ? 'warn' : 'neutral'}>{item.origin}</Pill>}
        {!locked && (
          <Button size="sm" className="ml-auto gap-1.5 text-xs" disabled={saving || !idValid || duplicateId || !item.query.trim()}
            onClick={() => onSave(item)}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        )}
      </div>
      <fieldset disabled={locked} className="space-y-3">
        <div className="grid grid-cols-[1fr_70px] gap-2">
          <Field label="id" hint={duplicateId ? 'An item with this id already exists.' : !idValid ? 'Letters, digits, . _ - only.' : undefined}>
            <TextField value={item.id} onChange={(e) => set('id', e.target.value)} />
          </Field>
          <Field label="lang"><TextField value={item.lang} onChange={(e) => set('lang', e.target.value)} /></Field>
        </div>
        <Field label="Query" hint="Phrase it as a user would — a question copied from the document measures string matching.">
          <TextArea dir="auto" className="min-h-[60px] font-sans text-sm" value={item.query} onChange={(e) => set('query', e.target.value)} />
        </Field>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Relevant documents (graded)</p>
          {Object.entries(item.relevant).map(([doc, grade]) => (
            <div key={doc} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{doc}</span>
              <SelectBox className="w-48 text-xs" value={grade} options={GRADES}
                onChange={(g) => set('relevant', { ...item.relevant, [doc]: g })} />
              <button type="button" className="text-muted-foreground hover:text-red-400"
                onClick={() => {
                  const next = { ...item.relevant };
                  delete next[doc];
                  set('relevant', next);
                }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <SelectBox className="text-xs" value={newDoc}
              options={[{ value: '', label: 'choose document…' }, ...docOptions.filter((o) => !(o.value in item.relevant))]}
              onChange={setNewDoc} />
            <Button type="button" size="sm" variant="outline" className="text-xs" onClick={addRelevant}>Add</Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Judged NOT relevant (grade 0)</p>
          <div className="flex flex-wrap gap-1">
            {item.judged_nonrelevant.map((d) => (
              <button key={d} type="button" onClick={() => set('judged_nonrelevant', item.judged_nonrelevant.filter((x) => x !== d))}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-red-500/40 hover:text-red-300">
                {d} <XCircle className="h-3 w-3" />
              </button>
            ))}
            {item.judged_nonrelevant.length === 0 && <span className="text-[11px] text-muted-foreground">none — every other document is only assumed irrelevant</span>}
          </div>
          <div className="flex gap-2">
            <SelectBox className="text-xs" value={newNegative}
              options={[{ value: '', label: 'choose document…' }, ...docOptions.filter((o) => !judged.has(o.value))]}
              onChange={setNewNegative} />
            <Button type="button" size="sm" variant="outline" className="text-xs" onClick={addNegative}>Mark 0</Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Evidence spans (verbatim)</p>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
              disabled={!Object.keys(item.relevant).length}
              onClick={() => set('evidence', [...item.evidence, { doc_id: Object.keys(item.relevant)[0], text: '' }])}>
              <Plus className="mr-1 h-3 w-3" /> Span
            </Button>
          </div>
          {item.evidence.map((ev, i) => {
            const found = ev.text.trim().length >= 3 && bodyOf(ev.doc_id).includes(normText(ev.text));
            return (
              <div key={i} className="space-y-1 rounded-md border border-white/8 p-2">
                <div className="flex items-center gap-2">
                  <SelectBox className="text-xs" value={ev.doc_id}
                    options={Object.keys(item.relevant).map((d) => ({ value: d, label: d }))}
                    onChange={(d) => setEvidence(i, { doc_id: d })} />
                  {found
                    ? <Pill tone="good"><CheckCircle2 className="h-3 w-3" /> found</Pill>
                    : <Pill tone="bad"><XCircle className="h-3 w-3" /> not in doc</Pill>}
                  <button type="button" className="text-muted-foreground hover:text-red-400"
                    onClick={() => set('evidence', item.evidence.filter((_, n) => n !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <TextArea dir="auto" className="min-h-[44px]" value={ev.text} onChange={(e) => setEvidence(i, { text: e.target.value })} />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Difficulty">
            <SelectBox<Difficulty> value={item.difficulty} onChange={(v) => set('difficulty', v)}
              options={[{ value: 'easy', label: 'easy' }, { value: 'medium', label: 'medium' }, { value: 'hard', label: 'hard' }]} />
          </Field>
          <Field label="Trap" hint="e.g. alef-hamza, taa-marbuta, none (control)">
            <TextField value={item.trap} onChange={(e) => set('trap', e.target.value)} />
          </Field>
        </div>
        <Field label="Tags (comma separated)">
          <TextField value={item.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
        </Field>
        <Field label="Ground truth answer" hint="Used by generation evals; retrieval metrics ignore it.">
          <TextArea dir="auto" className="min-h-[44px] font-sans" value={item.ground_truth} onChange={(e) => set('ground_truth', e.target.value)} />
        </Field>
        <Field label="Notes">
          <TextArea className="min-h-[44px] font-sans" value={item.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </fieldset>
    </div>
  );
}
