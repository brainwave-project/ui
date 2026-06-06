import { useAuthStore } from '@/store/auth.store';
import { UserProfile } from '@/features/users/components/UserProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Shield, Terminal, KeyRound, Clock } from 'lucide-react';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <div className="text-sm text-muted-foreground">No session found.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-neon shadow-glow-inner">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Operator Profile</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Identity · Keycloak &amp; UserHub
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Live UserHub data */}
        <UserProfile userId={user.sub} />

        {/* JWT claims — terminal panel */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Terminal className="h-4 w-4 text-neon" />
              Session Claims · JWT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            <Claim label="Subject (sub)" value={user.sub} mono />
            <Separator className="bg-white/5" />
            <Claim label="Email" value={user.email} />
            <Separator className="bg-white/5" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-neon" />
                Realm Roles
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {user.roles.length > 0
                  ? user.roles.map((r) => (
                      <span key={r} className="rounded-full border border-neon/20 bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon">
                        {r}
                      </span>
                    ))
                  : <span className="text-xs text-muted-foreground">none</span>}
              </div>
            </div>
            <Separator className="bg-white/5" />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-neon" />
                Token expires
              </span>
              <span className="font-mono text-xs">{new Date(user.exp * 1000).toLocaleTimeString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Claim({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'truncate font-mono text-xs' : 'truncate text-right'}>{value}</span>
    </div>
  );
}
