import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Layers, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChunks } from '@/features/evaluation/hooks/useEval';
import {
  EmptyState, Field, Panel, Pill, PrincipalNote, SelectBox, Stat,
} from '@/features/evaluation/components/EvalPrimitives';
import type { DatasetBundle } from '@/types/eval';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(content: string, spans: string[]) {
  const patterns = spans.map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+/).map(escapeRe).join('\\s+'));
  if (!patterns.length) return content;
  const parts = content.split(new RegExp(`(${patterns.join('|')})`, 'gi'));
  return parts.map((p, i) =>
    i % 2 === 1 ? <mark key={i} className="rounded bg-amber-400/25 px-0.5 text-foreground">{p}</mark> : p,
  );
}

export function ChunkingSection({ bundle }: { bundle: DatasetBundle }) {
  const [docId, setDocId] = useState<string>(bundle.corpus[0]?.doc_id ?? '');
  const [maxTokens, setMaxTokens] = useState(512);
  const [overlap, setOverlap] = useState(64);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data, isFetching } = useChunks(docId || null, maxTokens, overlap);

  const spansByChunk = (index: number) => (data?.evidence ?? []).filter((e) => e.chunks_containing.includes(index)).map((e) => e.text);
  const selected = data?.chunks.find((c) => c.index === openIndex) ?? null;

  if (!bundle.corpus.length) {
    return <Panel title="Chunking" icon={Layers}><EmptyState icon={Layers} title="Add documents first" /></Panel>;
  }

  function pickDoc(id: string) {
    setDocId(id);
    setOpenIndex(null);
  }

  return (
    <div className="space-y-4">
      <Panel
        title={selected ? `Chunk #${selected.index} · ${docId}` : 'Chunking'}
        icon={Layers}
        subtitle={selected
          ? `words ${selected.start_word}–${selected.end_word} · ~${selected.token_count} tokens`
          : (isFetching ? 'recomputing…' : `Port of core/src/ai/chunker.ts — ${data ? `${data.chunks.length} chunks · ${data.words} words` : 'fixed word windows'}`)}
        actions={
          selected ? (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setOpenIndex(null)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Chunks
            </Button>
          ) : data?.is_knowhub_config
            ? <Pill tone="good">matches the live index (512/64)</Pill>
            : <Pill tone="warn">what-if — index uses 512/64</Pill>
        }
      >
        {selected ? (
          <div key={selected.index} className="animate-fade-in space-y-3">
            <div className={cn('rounded-lg border p-3', spansByChunk(selected.index).length ? 'border-amber-400/30 bg-amber-400/[0.03]' : 'border-white/8 bg-card/30')}>
              {spansByChunk(selected.index).length > 0 && (
                <div className="mb-2"><Pill tone="warn">{spansByChunk(selected.index).length} evidence</Pill></div>
              )}
              <p dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {highlight(selected.content, spansByChunk(selected.index))}
              </p>
            </div>
            {data && data.evidence.filter((e) => e.chunks_containing.includes(selected.index) || (!e.found_in_doc && e.chunks_containing.length === 0)).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Evidence in this chunk</p>
                {data.evidence.filter((e) => e.chunks_containing.includes(selected.index)).map((e, i) => (
                  <div key={i} className="rounded-md border border-white/8 p-2 text-xs">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{e.item_id}</span>
                      <Pill tone="good">chunk {e.chunks_containing.join(', ')}</Pill>
                    </div>
                    <p dir="auto" className="text-muted-foreground">“{e.text}”</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Document" className="sm:col-span-2">
                <SelectBox value={docId} onChange={pickDoc} options={bundle.corpus.map((d) => ({ value: d.doc_id, label: `${d.doc_id} (${d.words} words)` }))} />
              </Field>
              <Field label={`Max tokens · ${maxTokens}`}>
                <input type="range" min={32} max={2048} step={16} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
              </Field>
              <Field label={`Overlap · ${overlap}`}>
                <input type="range" min={0} max={Math.min(512, maxTokens - 16)} step={8} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} className="w-full accent-[hsl(var(--neon))]" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {data && (
                <div className="grid grid-cols-2 gap-2 sm:w-80">
                  <Stat label="Chunks" value={data.chunks.length} />
                  <Stat label="Evidence spans" value={data.evidence.length}
                    sub={`${data.evidence.filter((e) => e.straddles_boundary).length} split · ${data.evidence.filter((e) => !e.found_in_doc).length} missing`} />
                </div>
              )}
              <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => { setMaxTokens(512); setOverlap(64); }}>Reset 512/64</Button>
            </div>

            {data && data.evidence.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Where the evidence lands</p>
                {data.evidence.map((e, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!e.chunks_containing.length}
                    onClick={() => e.chunks_containing[0] != null && setOpenIndex(e.chunks_containing[0])}
                    className="w-full rounded-md border border-white/8 p-2 text-left text-xs hover:border-white/20 disabled:cursor-default disabled:hover:border-white/8"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{e.item_id}</span>
                      {!e.found_in_doc
                        ? <Pill tone="bad"><XCircle className="h-3 w-3" /> not in document</Pill>
                        : e.straddles_boundary
                          ? <Pill tone="warn"><AlertTriangle className="h-3 w-3" /> split by a boundary</Pill>
                          : <Pill tone="good">chunk {e.chunks_containing.join(', ')}</Pill>}
                    </div>
                    <p dir="auto" className="text-muted-foreground">“{e.text}”</p>
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background/90 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5 pr-2">chunk</th><th className="pr-2">words</th><th className="pr-2">tokens</th><th className="pr-2">preview</th><th /></tr>
                </thead>
                <tbody>
                  {data?.chunks.map((c) => {
                    const spans = spansByChunk(c.index);
                    return (
                      <tr
                        key={c.index}
                        className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
                        onClick={() => setOpenIndex(c.index)}
                      >
                        <td className="py-1.5 pr-2 font-mono">#{c.index}</td>
                        <td className="pr-2 tabular-nums text-muted-foreground">{c.start_word}–{c.end_word}</td>
                        <td className="pr-2 tabular-nums text-muted-foreground">~{c.token_count}</td>
                        <td className="max-w-[420px] truncate pr-2 text-muted-foreground" dir="auto">{c.content}</td>
                        <td className="text-right">{spans.length > 0 && <Pill tone="warn">{spans.length} ev</Pill>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>
      <PrincipalNote title="Chunking sets a ceiling">
        An answer sentence that <strong>straddles a chunk boundary</strong> exists in no single chunk, so chunk-level
        recall for that question is capped below 1.0 by the chunker — whatever the retriever does. Overlap exists to
        reduce this. Drag the sliders and watch spans move between “in chunk” and “split”.
      </PrincipalNote>
    </div>
  );
}
