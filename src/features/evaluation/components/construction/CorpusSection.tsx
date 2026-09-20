import { useRef, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useDatasetMutation } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Pager, Panel, Pill, PrincipalNote, TextArea, TextField,
} from '@/features/evaluation/components/EvalPrimitives';
import { useUIStore } from '@/store/ui.store';
import type { CorpusDoc, DatasetBundle } from '@/types/eval';

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const PAGE_SIZE = 10;
const TEXT_FILE = /\.(md|txt|markdown)$/i;

function slugFromName(name: string) {
  const stem = name.replace(/\.(md|txt|markdown)$/i, '');
  return stem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '').replace(/[-.]+$/, '') || 'doc';
}

export function CorpusSection({ bundle }: { bundle: DatasetBundle }) {
  const locked = bundle.manifest.status === 'frozen';
  const { id } = bundle.meta;
  const version = bundle.manifest.version;
  const [editing, setEditing] = useState<CorpusDoc | null>(null);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const save = useDatasetMutation((doc: CorpusDoc) => evalApi.putDoc(id, version, doc), 'Document saved');
  const saveQuiet = useDatasetMutation((doc: CorpusDoc) => evalApi.putDoc(id, version, doc));
  const remove = useDatasetMutation((docId: string) => evalApi.deleteDoc(id, version, docId), 'Document removed');

  async function onFiles(files: FileList | null) {
    if (!files?.length || locked) return;
    const chosen = Array.from(files);
    const usable = chosen.filter((f) => TEXT_FILE.test(f.name));
    const skipped = chosen.length - usable.length;
    if (!usable.length) {
      addToast({ type: 'error', message: 'Upload .md or .txt files — the corpus stores text, not binaries.' });
      return;
    }
    setUploading(true);
    let ok = 0;
    try {
      for (const file of usable) {
        const body = await file.text();
        if (!body.trim()) continue;
        const docId = slugFromName(file.name);
        await saveQuiet.mutateAsync({ doc_id: docId, lang: bundle.meta.lang, body, source: file.name });
        ok += 1;
      }
      if (ok) addToast({ type: 'success', message: ok === 1 ? 'Document uploaded' : `${ok} documents uploaded` });
      if (skipped) addToast({ type: 'error', message: `Skipped ${skipped} non-text file${skipped === 1 ? '' : 's'}` });
    } finally {
      setUploading(false);
    }
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
          ) : !locked ? (
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setEditing({ doc_id: '', lang: bundle.meta.lang, body: '', source: '' })}>
              <Plus className="h-3.5 w-3.5" /> Write a document
            </Button>
          ) : undefined
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
        ) : (
          <div className="space-y-4">
            {!locked && (
              <UploadDropzone pending={uploading} onFiles={onFiles} compact={bundle.corpus.length > 0} />
            )}
            {bundle.corpus.length === 0 ? (
              <EmptyState icon={FileText} title="Empty corpus">
                Upload .md or .txt files, or write a document. Retrieval will search everything you put here — answers and distractors alike.
              </EmptyState>
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
          </div>
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

function UploadDropzone({
  pending, onFiles, compact,
}: {
  pending: boolean;
  onFiles: (files: FileList | null) => void;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors',
        compact ? 'gap-1.5 px-4 py-4' : 'gap-2 px-4 py-8',
        over ? 'border-neon/70 bg-neon/[0.08]' : 'border-white/15 bg-white/[0.02]',
      )}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".md,.txt,.markdown,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
      />
      {pending
        ? <Loader2 className={cn('animate-spin text-neon', compact ? 'h-5 w-5' : 'h-7 w-7')} />
        : <Upload className={cn('text-neon', compact ? 'h-5 w-5' : 'h-7 w-7')} />}
      <p className="text-sm font-medium">
        {pending ? 'Uploading…' : compact ? 'Drop more files, or choose them' : 'Drop .md or .txt files here'}
      </p>
      <p className="text-[11px] text-muted-foreground">Multiple files · markdown or plain text</p>
      <Button
        type="button"
        size="sm"
        variant={compact ? 'outline' : 'neon'}
        className="mt-1 h-8 gap-1.5 text-xs"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" /> Choose files
      </Button>
    </div>
  );
}
