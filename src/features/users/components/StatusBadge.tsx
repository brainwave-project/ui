import { Badge } from '@/components/ui/badge';
import type { AccountStatus } from '@/types/user';

const VARIANT: Record<AccountStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active:            'default',
  pending_identity:  'secondary',
  suspended:         'destructive',
  deactivated:       'outline',
};

const LABEL: Record<AccountStatus, string> = {
  active:           'Active',
  pending_identity: 'Pending',
  suspended:        'Suspended',
  deactivated:      'Deactivated',
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
