import { Plus, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DocumentList } from '@/features/documents/components/DocumentList';

export function DocumentsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-neon shadow-glow-inner">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Documents</h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Knowledge Base
            </p>
          </div>
        </div>
        <Button asChild variant="neon" size="sm">
          <Link to="/documents/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Link>
        </Button>
      </div>

      <DocumentList />
    </div>
  );
}
