import { User, Mail, Shield, Loader2, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
        <Loader2 className="h-6 w-6 animate-spin text-neon" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
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
    <Card className="relative max-w-lg overflow-hidden holo-border">
      {/* ambient header glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-neon/10 to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-plasma/15 blur-3xl" />

      <CardContent className="relative space-y-5 p-6">
        <div className="flex items-center gap-4">
          {/* Avatar with glowing ring */}
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-full bg-neon-gradient opacity-60 blur-sm" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-neon-gradient text-xl font-bold text-primary-foreground shadow-glow">
              {initials}
            </div>
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background bg-emerald-400" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="truncate font-display text-lg font-bold">
              {user.displayName ?? user.fullName ?? '—'}
            </h3>
            <StatusBadge status={user.accountStatus} />
          </div>
        </div>

        <Separator className="bg-white/5" />

        <div className="space-y-3 text-sm">
          <Row icon={Mail} label="Email" value={user.email} />
          {user.fullName && <Row icon={User} label="Full name" value={user.fullName} />}
          {user.roles && user.roles.length > 0 && (
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
              <div className="flex flex-1 flex-wrap justify-end gap-1">
                {user.roles.map((r) => (
                  <span key={r} className="rounded-full border border-neon/20 bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Row
            icon={CalendarDays}
            label="Member since"
            value={new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          />
        </div>

        {user.keycloakId && (
          <p className="truncate border-t border-white/5 pt-3 font-mono text-[11px] text-muted-foreground">
            <span className="text-neon/70">ID</span> {user.keycloakId}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-neon" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto truncate text-right font-medium">{value}</span>
    </div>
  );
}
