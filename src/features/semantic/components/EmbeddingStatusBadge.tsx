import { Loader2, CheckCircle2, Clock, AlertTriangle, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EmbeddingStatus } from '@/types/semantic';

const CONFIG: Record<
  EmbeddingStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: typeof Clock; spin?: boolean }
> = {
  PENDING:  { label: 'Queued',   variant: 'secondary', icon: Clock },
  INDEXING: { label: 'Indexing', variant: 'warning',   icon: Loader2, spin: true },
  INDEXED:  { label: 'Searchable', variant: 'success', icon: CheckCircle2 },
  FAILED:   { label: 'Failed',   variant: 'destructive', icon: AlertTriangle },
  SKIPPED:  { label: 'No text layer', variant: 'outline', icon: MinusCircle },
};

interface Props {
  status: EmbeddingStatus;
  className?: string;
}

/** Surfaces the semantic indexing lifecycle of a document. */
export function EmbeddingStatusBadge({ status, className }: Props) {
  const { label, variant, icon: Icon, spin } = CONFIG[status] ?? CONFIG.PENDING;
  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
      {label}
    </Badge>
  );
}
