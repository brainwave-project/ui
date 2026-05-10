import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Loader2, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUploadDocument } from '../hooks/useDocuments';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  tags:  z.string().optional(),
  note:  z.string().max(10_000).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  onSuccess?: () => void;
}

export function UploadForm({ onSuccess }: Props) {
  const upload   = useUploadDocument();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function pickFile(f: File) {
    setFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function onSubmit(data: FormData) {
    if (!file) return;

    const tags = data.tags
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    await upload.mutateAsync({
      file,
      title:    data.title,
      tags,
      mimeType: file.type || 'application/octet-stream',
      note:     data.note,
    });

    reset();
    setFile(null);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Select file"
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {file ? (
          <>
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground">Any file type accepted</p>
            </div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
        />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          placeholder="My document"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">
          Tags{' '}
          <span className="text-xs text-muted-foreground">(comma-separated, optional)</span>
        </Label>
        <Input
          id="tags"
          placeholder="architecture, design, api"
          {...register('tags')}
        />
      </div>

      {/* Optional initial note */}
      <div className="space-y-2">
        <Label htmlFor="note">
          Note{' '}
          <span className="text-xs text-muted-foreground">(optional, stored separately as MongoDB note)</span>
        </Label>
        <textarea
          id="note"
          rows={3}
          placeholder="Why are you uploading this document?"
          className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          {...register('note')}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!file || upload.isPending}
      >
        {upload.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </>
        )}
      </Button>
    </form>
  );
}
