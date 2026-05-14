import { useState, useEffect, useCallback } from 'react';
import { auditApi } from '@/api/audit.api';
import type { AuditEvent, AuditQuery } from '@/types/audit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  LogIn, LogOut, RefreshCw, UserPlus, UserCog, ShieldCheck, UserX,
  FileUp, FileDown, Archive, Trash2, StickyNote, AlertCircle, Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LOGIN_SUCCESS:        { label: 'Login',            icon: LogIn,      color: 'text-green-500' },
  LOGIN_FAILURE:        { label: 'Login Failed',     icon: LogIn,      color: 'text-red-500'   },
  LOGOUT:               { label: 'Logout',           icon: LogOut,     color: 'text-slate-500' },
  TOKEN_REFRESHED:      { label: 'Token Refreshed',  icon: RefreshCw,  color: 'text-blue-400'  },
  USER_CREATED:         { label: 'User Created',     icon: UserPlus,   color: 'text-green-500' },
  USER_STATUS_CHANGED:  { label: 'Status Changed',   icon: UserCog,    color: 'text-yellow-500'},
  USER_ROLES_ASSIGNED:  { label: 'Roles Assigned',   icon: ShieldCheck,color: 'text-purple-500'},
  USER_DELETED:         { label: 'User Deleted',     icon: UserX,      color: 'text-red-500'   },
  DOCUMENT_UPLOADED:    { label: 'Document Uploaded',icon: FileUp,     color: 'text-green-500' },
  DOCUMENT_DOWNLOADED:  { label: 'Document Downloaded',icon: FileDown, color: 'text-blue-500'  },
  DOCUMENT_ARCHIVED:    { label: 'Document Archived',icon: Archive,    color: 'text-orange-500'},
  DOCUMENT_DELETED:     { label: 'Document Deleted', icon: Trash2,     color: 'text-red-500'   },
  NOTE_CREATED:         { label: 'Note Created',     icon: StickyNote, color: 'text-teal-500'  },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: AlertCircle, color: 'text-slate-400' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const SERVICE_BADGE: Record<string, string> = {
  'auth-hub':  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'user-hub':  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'know-hub':  'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: AuditEvent }) {
  const meta = getActionMeta(event.action);
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-0">
      {/* Icon */}
      <div className={`mt-0.5 shrink-0 ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{meta.label}</span>

          {/* Service badge */}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SERVICE_BADGE[event.service] ?? 'bg-muted text-muted-foreground'}`}>
            {event.service}
          </span>

          {/* Outcome */}
          {event.outcome === 'FAILURE' && (
            <Badge variant="destructive" className="text-xs">FAILED</Badge>
          )}
        </div>

        {/* Resource */}
        {event.resource && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {event.resource.type}: <span className="font-mono">{event.resource.name ?? event.resource.id}</span>
          </p>
        )}

        {/* Timestamp */}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(event.occurredAt)}
          {event.correlationId && (
            <span className="ml-2 font-mono opacity-50">{event.correlationId.slice(0, 8)}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  query:    AuditQuery;
  onChange: (q: AuditQuery) => void;
}

function FilterBar({ query, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="grid gap-1">
        <Label className="text-xs">Action</Label>
        <Input
          className="h-8 w-44 text-sm"
          placeholder="e.g. DOCUMENT_UPLOADED"
          value={query.action ?? ''}
          onChange={(e) => onChange({ ...query, action: e.target.value || undefined, offset: 0 })}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Service</Label>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={query.service ?? ''}
          onChange={(e) => onChange({ ...query, service: e.target.value || undefined, offset: 0 })}
        >
          <option value="">All</option>
          <option value="auth-hub">auth-hub</option>
          <option value="user-hub">user-hub</option>
          <option value="know-hub">know-hub</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Outcome</Label>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={query.outcome ?? ''}
          onChange={(e) =>
            onChange({ ...query, outcome: (e.target.value as 'SUCCESS' | 'FAILURE') || undefined, offset: 0 })
          }
        >
          <option value="">All</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
        </select>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => onChange({ limit: PAGE_SIZE, offset: 0 })}
      >
        Reset
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ActivityPage() {
  const [query, setQuery] = useState<AuditQuery>({ limit: PAGE_SIZE, offset: 0 });
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(async (q: AuditQuery) => {
    setLoading(true);
    setError(null);
    try {
      const page = await auditApi.myActivity(q);
      setEvents(page.items);
      setTotal(page.total);
    } catch {
      setError('Failed to load activity. The audit service may not be running yet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(query); }, [query, load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor((query.offset ?? 0) / PAGE_SIZE) + 1;

  function handleFilter(q: AuditQuery) {
    setQuery({ ...q, limit: PAGE_SIZE });
  }

  function goPage(page: number) {
    setQuery((prev) => ({ ...prev, offset: (page - 1) * PAGE_SIZE }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">My Activity</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">({total} events)</span>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filters</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <FilterBar query={query} onChange={handleFilter} />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="px-4 py-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No activity found for the selected filters.</p>
            </div>
          ) : (
            <div>
              {events.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={currentPage <= 1}
              onClick={() => goPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
