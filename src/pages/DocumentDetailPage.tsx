import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, Trash2, FileText, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  useDocument,
  useArchiveDocument,
  useDeleteDocument,
} from '@/features/documents/hooks/useDocuments';
import { NotesPanel } from '@/features/documents/components/NotesPanel';
import { documentsApi } from '@/api/documents.api';

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{String(value)}</span>
    </div>
  );
}

export function DocumentDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { data: doc, isLoading, isError } = useDocument(id!);
  const archive    = useArchiveDocument();
  const remove     = useDeleteDocument();

  async function handleArchive() {
    await archive.mutateAsync(id!);
  }

  async function handleDelete() {
    await remove.mutateAsync(id!);
    navigate('/documents');
  }

  async function handleDownload() {
    if (!doc) return;
    const result = await documentsApi.download(doc.documentId);
    if (result.url) {
      window.open(result.url, '_blank');
    } else if (result.payload) {
      const blob = new Blob([JSON.stringify(result.payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Document not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="flex gap-2">
          {doc.state === 'AVAILABLE' && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          )}
          {doc.state === 'AVAILABLE' && (
            <Button
              variant="outline"
              size="sm"
              disabled={archive.isPending}
              onClick={handleArchive}
            >
              {archive.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Archive className="mr-2 h-4 w-4" />}
              Archive
            </Button>
          )}
          {doc.state === 'ARCHIVED' && (
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={handleDelete}
            >
              {remove.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Document card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-base">{doc.title}</CardTitle>
              <Badge variant="secondary">{doc.state}</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Separator className="mb-4" />
          <div className="divide-y">
            <Row label="Document ID"  value={doc.documentId} />
            <Row label="MIME Type"    value={doc.mimeType} />
            <Row label="Size"
              value={doc.sizeBytes != null
                ? `${(doc.sizeBytes / 1024).toFixed(1)} KB`
                : undefined}
            />
            <Row label="Version"      value={doc.version} />
            <Row label="Created"
              value={new Date(doc.createdAt).toLocaleString()}
            />
            <Row label="Updated"
              value={new Date(doc.updatedAt).toLocaleString()}
            />
          </div>

          {doc.tags && doc.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {doc.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes panel */}
      <NotesPanel documentId={doc.documentId} />
    </div>
  );
}
