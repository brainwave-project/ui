import { useState } from 'react';
import { FolderArchive, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KnowOpsHeader } from '@/features/knowops/components/KnowOpsHeader';
import { DocumentList } from '@/features/documents/components/DocumentList';
import { UploadForm } from '@/features/documents/components/UploadForm';

export function KnowDocumentsPage() {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-6">
      <KnowOpsHeader
        icon={FolderArchive}
        kicker="Documents"
        title="Knowledge base — manage records"
        desc="Create, browse, archive and delete the documents that feed the semantic layer."
        actions={
          <Button
            variant={uploading ? 'outline' : 'neon'}
            size="sm"
            onClick={() => setUploading((v) => !v)}
          >
            {uploading ? <><X className="mr-2 h-4 w-4" /> Close</> : <><Plus className="mr-2 h-4 w-4" /> Upload</>}
          </Button>
        }
      />

      {uploading && (
        <Card className="holo-border animate-fade-in-up">
          <CardContent className="p-6">
            <UploadForm onSuccess={() => setUploading(false)} />
          </CardContent>
        </Card>
      )}

      <DocumentList />
    </div>
  );
}
