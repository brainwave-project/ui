import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '@/api/users.api';
import type { User, AccountStatus, Role, AdminCreateUserPayload } from '@/types/user';
import { Button }     from '@/components/ui/button';
import { Badge }      from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label }      from '@/components/ui/label';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  UserPlus, ChevronLeft, ChevronRight, Shield, UserX, UserCheck,
  RefreshCw, Pencil, Trash2, Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

const ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

const STATUS_BADGE: Record<AccountStatus, string> = {
  pending_identity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  active:           'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300',
  suspended:        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  disabled:         'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  failed:           'bg-gray-100   text-gray-600   dark:bg-gray-800/40   dark:text-gray-400',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending_identity: 'Pending',
  active:           'Active',
  suspended:        'Suspended',
  disabled:         'Disabled',
  failed:           'Failed',
};

// Status transitions available per current status
const NEXT_STATUSES: Partial<Record<AccountStatus, AccountStatus[]>> = {
  pending_identity: ['active', 'failed'],
  active:           ['suspended', 'disabled'],
  suspended:        ['active', 'disabled'],
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getInitials(user: User): string {
  if (user.fullName) {
    return user.fullName
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
  return user.email[0]?.toUpperCase() ?? '?';
}

// ---------------------------------------------------------------------------
// Create User Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  onClose:  () => void;
  onSaved:  (user: User) => void;
}

function CreateModal({ onClose, onSaved }: CreateModalProps) {
  const [form, setForm] = useState<AdminCreateUserPayload>({
    email:       '',
    fullName:    '',
    displayName: '',
    password:    '',
    roles:       ['VIEWER'],
  });
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  function handleChange(field: keyof AdminCreateUserPayload, value: string | Role[]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleRole(role: Role) {
    setForm((f) => {
      const has = f.roles.includes(role);
      const next = has ? f.roles.filter((r) => r !== role) : [...f.roles, role];
      return { ...f, roles: next.length ? next : f.roles }; // keep at least one
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: AdminCreateUserPayload = {
        email:    form.email.trim(),
        password: form.password,
        roles:    form.roles,
        ...(form.fullName?.trim()    && { fullName:    form.fullName.trim() }),
        ...(form.displayName?.trim() && { displayName: form.displayName.trim() }),
      };
      const user = await usersApi.adminCreate(payload);
      onSaved(user);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to create user';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card shadow-xl border">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Create User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="cu-email">Email <span className="text-destructive">*</span></Label>
              <input
                id="cu-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="user@example.com"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="cu-full">Full Name</Label>
              <input
                id="cu-full"
                type="text"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Jane Doe"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="cu-display">Display Name</Label>
              <input
                id="cu-display"
                type="text"
                value={form.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Jane"
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="cu-password">
                Temporary Password <span className="text-destructive">*</span>
              </Label>
              <input
                id="cu-password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Min 8 characters"
              />
            </div>
          </div>

          {/* Role picker */}
          <div className="flex flex-col gap-2">
            <Label>
              Roles <span className="text-destructive">*</span>
              <span className="ml-1 text-xs text-muted-foreground">(select at least one)</span>
            </Label>
            <div className="flex gap-2">
              {ROLES.map((role) => {
                const active = form.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={[
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                    ].join(' ')}
                  >
                    <Shield className="h-3 w-3" />
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || form.roles.length === 0}>
              {saving ? <LoadingSpinner /> : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Roles Modal
// ---------------------------------------------------------------------------

interface EditRolesModalProps {
  user:    User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

function EditRolesModal({ user, onClose, onSaved }: EditRolesModalProps) {
  const [roles,   setRoles]   = useState<Role[]>(user.roles);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function toggleRole(role: Role) {
    setRoles((prev) => {
      const has  = prev.includes(role);
      const next = has ? prev.filter((r) => r !== role) : [...prev, role];
      return next.length ? next : prev;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await usersApi.assignRoles(user.id, roles);
      onSaved(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to update roles';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card shadow-xl border">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Edit Roles</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Updating roles for <span className="font-medium text-foreground">{user.email}</span>
          </p>

          <div className="flex gap-2">
            {ROLES.map((role) => {
              const active = roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={[
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                  ].join(' ')}
                >
                  <Shield className="h-3 w-3" />
                  {role}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || roles.length === 0}>
              {saving ? <LoadingSpinner /> : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change Status Modal
// ---------------------------------------------------------------------------

interface ChangeStatusModalProps {
  user:    User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

function ChangeStatusModal({ user, onClose, onSaved }: ChangeStatusModalProps) {
  const options = NEXT_STATUSES[user.accountStatus] ?? [];
  const [status,  setStatus]  = useState<AccountStatus>(options[0] ?? user.accountStatus);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await usersApi.updateStatus(user.id, status);
      onSaved(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to update status';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (options.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card shadow-xl border">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Change Status</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Current status:{' '}
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[user.accountStatus]}`}>
              {STATUS_LABEL[user.accountStatus]}
            </span>
          </p>

          <div className="flex flex-col gap-1">
            <Label htmlFor="cs-status">New Status</Label>
            <select
              id="cs-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {options.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <LoadingSpinner /> : 'Apply'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  user:    User;
  onClose: () => void;
  onSaved: (user: User) => void;
}

function DeleteModal({ user, onClose, onSaved }: DeleteModalProps) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setSaving(true);
    try {
      const updated = await usersApi.delete(user.id);
      onSaved(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to disable user';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-card shadow-xl border">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-destructive">Disable User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <p className="text-sm text-muted-foreground">
            This will move <span className="font-medium text-foreground">{user.email}</span> to{' '}
            <strong>DISABLED</strong> state. The account is retained for audit purposes.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <LoadingSpinner /> : 'Disable'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Row
// ---------------------------------------------------------------------------

interface UserRowProps {
  user:           User;
  onEditRoles:    (u: User) => void;
  onChangeStatus: (u: User) => void;
  onDelete:       (u: User) => void;
}

function UserRow({ user, onEditRoles, onChangeStatus, onDelete }: UserRowProps) {
  const canChangeStatus = !!NEXT_STATUSES[user.accountStatus]?.length;
  const canDelete       = user.accountStatus !== 'disabled' && user.accountStatus !== 'failed';

  return (
    <tr className="border-b transition-colors hover:bg-muted/40 last:border-0">
      {/* Avatar + name/email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {getInitials(user)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName ?? user.email}</p>
            {user.fullName && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[user.accountStatus]}`}>
          {STATUS_LABEL[user.accountStatus]}
        </span>
      </td>

      {/* Roles */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {user.roles.length ? user.roles.map((role) => (
            <Badge key={role} variant="outline" className="text-xs">
              {role}
            </Badge>
          )) : (
            <span className="text-xs text-muted-foreground italic">none</span>
          )}
        </div>
      </td>

      {/* Joined */}
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(user.createdAt).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
        })}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            title="Edit roles"
            onClick={() => onEditRoles(user)}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {canChangeStatus && (
            <button
              title="Change status"
              onClick={() => onChangeStatus(user)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {user.accountStatus === 'suspended' ? (
                <UserCheck className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {canDelete && (
            <button
              title="Disable user"
              onClick={() => onDelete(user)}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Modal =
  | { type: 'create' }
  | { type: 'editRoles';    user: User }
  | { type: 'changeStatus'; user: User }
  | { type: 'delete';       user: User }
  | null;

export function UsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState<Modal>(null);

  const fetchUsers = useCallback(async (pageIndex: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list({ limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE });
      setUsers(result.items);
      setTotal(result.total);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(page); }, [fetchUsers, page]);

  function handleSaved(updated: User) {
    setModal(null);
    // Refresh current page — updated user may appear on any page
    fetchUsers(page);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground">
              {total} user{total !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>

        <Button onClick={() => setModal({ type: 'create' })} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <UserX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchUsers(page)} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No users yet.</p>
              <Button onClick={() => setModal({ type: 'create' })} className="gap-2">
                <UserPlus className="h-4 w-4" /> Create the first user
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Roles</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onEditRoles={   (user) => setModal({ type: 'editRoles',    user })}
                      onChangeStatus={(user) => setModal({ type: 'changeStatus', user })}
                      onDelete={      (user) => setModal({ type: 'delete',       user })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {modal?.type === 'create' && (
        <CreateModal onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'editRoles' && (
        <EditRolesModal user={modal.user} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'changeStatus' && (
        <ChangeStatusModal user={modal.user} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal user={modal.user} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
