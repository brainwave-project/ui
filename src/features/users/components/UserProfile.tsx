import { User, Mail, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './StatusBadge';
import { useUser } from '../hooks/useUser';

interface Props {
  userId: string;
}

export function UserProfile({ userId }: Props) {
  const { data: user, isLoading, isError } = useUser(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load profile.
      </div>
    );
  }

  const initials = (user.displayName ?? user.fullName ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base">
              {user.displayName ?? user.fullName ?? '—'}
            </CardTitle>
            <StatusBadge status={user.accountStatus} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Separator />

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span>{user.email}</span>
          </div>

          {user.fullName && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>{user.fullName}</span>
            </div>
          )}

          {user.roles && user.roles.length > 0 && (
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground">
          <p>Member since {new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          {user.keycloakId && <p className="mt-0.5 font-mono">ID: {user.keycloakId}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
