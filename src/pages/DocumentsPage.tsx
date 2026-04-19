import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DocumentList } from '@/features/documents/components/DocumentList';

export function DocumentsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">Your knowledge base</p>
        </div>
        <Button asChild size="sm">
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
