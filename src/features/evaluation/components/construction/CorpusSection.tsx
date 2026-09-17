import { useRef, useState } from 'react';
import { ArrowLeft, FileText, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Pager, Panel, Pill, PrincipalNote, TextArea, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import type { CorpusDoc, DatasetBundle } from '@/types/eval';

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const PAGE_SIZE = 10;

export function CorpusSection({ bundle }: { bundle: DatasetBundle }) {
  const locked = bundle.manifest.status === 'frozen';
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const [editing, setEditing] = useState<CorpusDoc | null>(null);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = useDatasetMutation((doc: CorpusDoc) => evalApi.putDoc(id, version, doc), 'Document saved');
  const remove = useDatasetMutation((docId: string) => evalApi.deleteDoc(id, version, docId), 'Document removed');

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const docId = file.name.replace(/\.(md|txt|markdown)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '');
      const body = await file.text();
      await save.mutateAsync({ doc_id: docId, lang: bundle.meta.lang, body, source: file.name });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const distractors = bundle.corpus.filter((d) => d.relevant_for.length === 0).length;
  const idValid = editing ? SLUG.test(editing.doc_id) : true;
  const totalPages = Math.max(1, Math.ceil(bundle.corpus.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = bundle.corpus.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Panel
        title={editing ? (editing.doc_id || 'New document') : 'Corpus'}
        icon={FileText}
        subtitle={editing
          ? 'Edit the document, then save or go back to the list.'
          : `${bundle.corpus.length} documents · ${distractors} distractors`}
        actions={
          editing ? (
            <>
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setEditing(null)}>
                <ArrowLeft className="h-3.5 w-3.5" /> List
              </Button>
              {!locked && (
                <Button size="sm" className="gap-1.5 text-xs" disabled={!idValid || !editing.body.trim() || save.isPending}
                  onClick={() => save.mutate(editing)}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              )}
            </>
          ) : !locked && (
            <>
              <input ref={fileRef} type="file" multiple accept=".md,.txt,.markdown" className="hidden" onChange={(e) => onFiles(e.target.files)} />
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload .md/.txt
              </Button>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setEditing({ doc_id: '', lang: bundle.meta.lang, body: '', source: '' })}>
                <Plus className="h-3.5 w-3.5" /> Document
              </Button>
            </>
          )
        }
      >
        {editing ? (
          <div key={editing.doc_id || 'new'} className="animate-fade-in space-y-3">
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <Field label="doc_id" hint={!idValid ? 'Letters, digits, . _ - only (it becomes the know-hub title).' : 'Stable id — golden labels reference it.'}>
                <TextField value={editing.doc_id} disabled={locked} onChange={(e) => setEditing({ ...editing, doc_id: e.target.value })} />
              </Field>
              <Field label="lang">
                <TextField value={editing.lang} disabled={locked} onChange={(e) => setEditing({ ...editing, lang: e.target.value })} />
              </Field>
            </div>
            <Field label="Source (provenance)">
              <TextField value={editing.source} disabled={locked} placeholder="where did this text come from?" onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
            </Field>
            <Field label="Body">
              <TextArea dir="auto" className="min-h-[320px]" value={editing.body} disabled={locked}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
          </div>
        ) : bundle.corpus.length === 0 ? (
          <EmptyState icon={FileText} title="Empty corpus">Add the documents retrieval will search — answers and distractors alike.</EmptyState>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5 pr-2">doc_id</th><th className="pr-2">words</th><th className="pr-2">role</th><th /></tr>
                </thead>
                <tbody>
                  {slice.map((d) => (
                    <tr key={d.doc_id}
                      className={cn('cursor-pointer border-t border-white/5 hover:bg-white/[0.03]')}
                      onClick={() => setEditing({ doc_id: d.doc_id, lang: d.lang, body: d.body, source: d.source })}>
                      <td className="py-1.5 pr-2 font-mono">{d.doc_id}</td>
                      <td className="pr-2 tabular-nums text-muted-foreground">{d.words}</td>
                      <td className="pr-2">
                        {d.relevant_for.length
                          ? <Pill tone="neon" title={d.relevant_for.join(', ')}>answers {d.relevant_for.length}</Pill>
                          : <Pill>distractor</Pill>}
                      </td>
                      <td className="text-right">
                        {!locked && (
                          <button className="text-muted-foreground hover:text-red-400" title="Remove"
                            onClick={(e) => { e.stopPropagation(); remove.mutate(d.doc_id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={safePage} pageSize={PAGE_SIZE} total={bundle.corpus.length} onPage={setPage} />
          </>
        )}
      </Panel>
      <PrincipalNote title="Corpus vs dataset">
        The <strong>corpus</strong> is what gets indexed; the <strong>dataset</strong> is corpus + questions + judgements.
        An index depends on the corpus alone — editing a question never forces a reindex, editing a document always does.
        Keep <strong>distractors</strong>: topically close documents that answer nothing. Without them, ranking is not a
        real task and every retriever looks good.
      </PrincipalNote>
    </div>
  );
}
