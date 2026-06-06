import { FileText, Archive, Trash2, ArrowUpRight, Clock, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useArchiveDocument, useDeleteDocument } from '../hooks/useDocuments';
import type { Document } from '@/types/document';

/** Per-state visual identity: accent rail + badge tint. */
const STATE_STYLE: Record<string, { rail: string; badge: string; dot: string }> = {
  AVAILABLE:  { rail: 'from-emerald-400/80', badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400' },
  RECEIVED:   { rail: 'from-neon/80',        badge: 'border-neon/30 bg-neon/10 text-neon',                     dot: 'bg-neon' },
  PERSISTING: { rail: 'from-amber-400/80',   badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',     dot: 'bg-amber-400' },
  ARCHIVED:   { rail: 'from-muted-foreground/60', badge: 'border-white/15 bg-white/5 text-muted-foreground',  dot: 'bg-muted-foreground' },
  DELETED:    { rail: 'from-destructive/80',  badge: 'border-destructive/30 bg-destructive/10 text-destructive', dot: 'bg-destructive' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  document: Document;
  onView?: (doc: Document) => void;
}

export function DocumentCard({ document: doc, onView }: Props) {
  const archive = useArchiveDocument();
  const remove  = useDeleteDocument();

  const isActive   = doc.state === 'AVAILABLE';
  const isArchived = doc.state === 'ARCHIVED';
  const style      = STATE_STYLE[doc.state] ?? STATE_STYLE.ARCHIVED;

  return (
    <Card
      className={cn(
        'group relative flex flex-col overflow-hidden p-4 pl-5',
        'hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow',
      )}
    >
      {/* State accent rail */}
      <div className={cn('absolute left-0 top-0 h-full w-1 bg-gradient-to-b to-transparent', style.rail)} />
      {/* corner glow on hover */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-neon/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neon transition-colors group-hover:bg-neon/15">
            <FileText className="h-4 w-4" />
          </div>
          <h3 className="truncate text-sm font-semibold" title={doc.title}>{doc.title}</h3>
        </div>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider', style.badge)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
          {doc.state}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
        {doc.mimeType && <p className="truncate font-mono text-[11px]">{doc.mimeType}</p>}
        <div className="flex items-center gap-4">
          {doc.sizeBytes != null && (
            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatBytes(doc.sizeBytes)}</span>
          )}
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(doc.createdAt)}</span>
        </div>
        {doc.tags && doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {doc.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3">
        {isActive && onView && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs hover:text-neon" onClick={() => onView(doc)}>
            <ArrowUpRight className="h-3 w-3" />
            Open
          </Button>
        )}
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={archive.isPending}
            onClick={() => archive.mutate(doc.documentId)}
          >
            <Archive className="h-3 w-3" />
            Archive
          </Button>
        )}
        {isArchived && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(doc.documentId)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
