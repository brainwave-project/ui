import { Badge } from '@/components/ui/badge';
import type { AccountStatus } from '@/types/user';

const VARIANT: Record<AccountStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active:            'default',
  pending_identity:  'secondary',
  suspended:         'destructive',
  disabled:          'outline',
  failed:            'destructive',
};

const LABEL: Record<AccountStatus, string> = {
  active:           'Active',
  pending_identity: 'Pending',
  suspended:        'Suspended',
  disabled:         'Disabled',
  failed:           'Failed',
};

interface Props {
  status: AccountStatus;
  className?: string;
}

export function StatusBadge({ status, className }: Props) {
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {LABEL[status]}
    </Badge>
  );
}
