import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LogIn, RefreshCw, UserPlus, UserCog, ShieldCheck, UserX,
  FileUp, FileDown, Archive, Trash2, StickyNote, Activity, ArrowRight, Loader2,
} from 'lucide-react';
import { auditApi } from '@/api/audit.api';
import { cn } from '@/lib/utils';

const META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LOGIN_SUCCESS:       { label: 'Login',             icon: LogIn,       color: 'text-emerald-400' },
  LOGIN_FAILURE:       { label: 'Login failed',      icon: LogIn,       color: 'text-destructive' },
  TOKEN_REFRESHED:     { label: 'Token refreshed',   icon: RefreshCw,   color: 'text-sky-400' },
  USER_CREATED:        { label: 'User created',      icon: UserPlus,    color: 'text-emerald-400' },
  USER_STATUS_CHANGED: { label: 'Status changed',    icon: UserCog,     color: 'text-amber-400' },
  USER_ROLES_ASSIGNED: { label: 'Roles assigned',    icon: ShieldCheck, color: 'text-plasma' },
  USER_DELETED:        { label: 'User deleted',      icon: UserX,       color: 'text-destructive' },
  DOCUMENT_UPLOADED:   { label: 'Document uploaded', icon: FileUp,      color: 'text-emerald-400' },
  DOCUMENT_DOWNLOADED: { label: 'Document downloaded', icon: FileDown,  color: 'text-sky-400' },
  DOCUMENT_ARCHIVED:   { label: 'Document archived', icon: Archive,     color: 'text-amber-400' },
  DOCUMENT_DELETED:    { label: 'Document deleted',  icon: Trash2,      color: 'text-destructive' },
  NOTE_CREATED:        { label: 'Note created',      icon: StickyNote,  color: 'text-teal-400' },
};

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ActivityFeed({ admin }: { admin: boolean }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'activity', admin],
    queryFn:  () => (admin ? auditApi.allActivity({ limit: 8 }) : auditApi.myActivity({ limit: 8 })),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  if (isError || !data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Activity className="h-7 w-7 opacity-50" />
        <p className="text-sm">No recent activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {data.items.map((e) => {
        const meta = META[e.action] ?? { label: e.action, icon: Activity, color: 'text-muted-foreground' };
        const Icon = meta.icon;
        return (
          <div key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5', meta.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {meta.label}
                {e.outcome === 'FAILURE' && <span className="ml-1.5 text-[10px] font-medium text-destructive">FAILED</span>}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {e.actor.email ?? e.actor.userId.slice(0, 8)} · {e.service}
              </p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{ago(e.occurredAt)}</span>
          </div>
        );
      })}
      <Link
        to="/activity"
        className="mt-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs text-muted-foreground transition-colors hover:text-neon"
      >
        View all activity <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
