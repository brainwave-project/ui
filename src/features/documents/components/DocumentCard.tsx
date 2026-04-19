import { FileText, Archive, Trash2, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useArchiveDocument, useDeleteDocument } from '../hooks/useDocuments';
import type { Document } from '@/types/document';

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE:  'default',
  RECEIVED:   'secondary',
  PERSISTING: 'secondary',
  ARCHIVED:   'outline',
  DELETED:    'destructive',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
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

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="truncate text-sm font-medium">{doc.title}</CardTitle>
          </div>
          <Badge variant={STATE_VARIANT[doc.state] ?? 'outline'} className="shrink-0 text-xs">
            {doc.state}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-1 pb-2 text-xs text-muted-foreground">
        {doc.mimeType && <p className="truncate">{doc.mimeType}</p>}
        {doc.sizeBytes != null && <p>{formatBytes(doc.sizeBytes)}</p>}
        <div className="flex items-center gap-1 pt-1">
          <Clock className="h-3 w-3" />
          <span>{formatDate(doc.createdAt)}</span>
        </div>
        {doc.tags && doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {doc.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="px-1 py-0 text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-2">
        {isActive && onView && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onView(doc)}
          >
            <ExternalLink className="h-3 w-3" />
            View
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
      </CardFooter>
    </Card>
  );
}
