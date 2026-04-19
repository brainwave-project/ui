import { useAuthStore } from '@/store/auth.store';
import { UserProfile } from '@/features/users/components/UserProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield } from 'lucide-react';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <div className="text-sm text-muted-foreground">No session found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your Profile</h2>
        <p className="text-sm text-muted-foreground">Account details from Keycloak &amp; UserHub</p>
      </div>

      {/* Live UserHub data */}
      <UserProfile userId={user.sub} />

      {/* JWT claims summary */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Session Claims (JWT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subject (sub)</span>
            <span className="font-mono text-xs">{user.sub}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              Realm Roles
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {user.roles.length > 0
                ? user.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {r}
                    </Badge>
                  ))
                : <span className="text-xs text-muted-foreground">none</span>}
            </div>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token expires</span>
            <span className="text-xs">
              {new Date(user.exp * 1000).toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
