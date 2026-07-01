import { useState, useEffect, useCallback } from 'react';
import { permissionsApi } from '@/api/permissions.api';
import { usersApi }       from '@/api/users.api';
import type { Permission, RoleWithPermissions } from '@/types/permission';
import type { User, AccountStatus, Role, AdminCreateUserPayload } from '@/types/user';
import { Button }   from '@/components/ui/button';
import { Card }     from '@/components/ui/card';
import { Label }    from '@/components/ui/label';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  Shield, Users, Lock, ShieldCheck, ChevronLeft, ChevronRight,
  UserPlus, UserX, UserCheck, Pencil, Trash2, RefreshCw,
  Save, CheckCheck, AlertTriangle, KeyRound, Layers, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const TABS = [
  { id: 'users',       label: 'Users',       icon: Users,      color: 'text-blue-500'   },
  { id: 'roles',       label: 'Roles',       icon: ShieldCheck, color: 'text-violet-500' },
  { id: 'permissions', label: 'Permissions', icon: Lock,        color: 'text-amber-500'  },
] as const;
type TabId = typeof TABS[number]['id'];

const ROLE_META: Record<string, { color: string; bg: string; border: string; glow: string; icon: React.ElementType }> = {
  ADMIN:  { color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',  glow: 'shadow-amber-500/20',  icon: Shield },
  EDITOR: { color: 'text-blue-600  dark:text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',   glow: 'shadow-blue-500/20',   icon: Pencil },
  VIEWER: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20', icon: UserCheck },
};

const RESOURCE_META: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  document:   { color: 'text-blue-600',   bg: 'bg-blue-500/10',   icon: Layers,   label: 'Documents'   },
  note:       { color: 'text-teal-600',   bg: 'bg-teal-500/10',   icon: Pencil,   label: 'Notes'       },
  user:       { color: 'text-violet-600', bg: 'bg-violet-500/10', icon: Users,    label: 'Users'       },
  role:       { color: 'text-amber-600',  bg: 'bg-amber-500/10',  icon: ShieldCheck, label: 'Roles'    },
  permission: { color: 'text-rose-600',   bg: 'bg-rose-500/10',   icon: KeyRound, label: 'Permissions' },
};

const ACTION_COLORS: Record<string, string> = {
  read:    'text-sky-600   bg-sky-500/10   border-sky-500/30',
  create:  'text-green-600 bg-green-500/10 border-green-500/30',
  update:  'text-blue-600  bg-blue-500/10  border-blue-500/30',
  archive: 'text-orange-600 bg-orange-500/10 border-orange-500/30',
  delete:  'text-red-600   bg-red-500/10   border-red-500/30',
  assign:  'text-violet-600 bg-violet-500/10 border-violet-500/30',
  manage:  'text-amber-600  bg-amber-500/10  border-amber-500/30',
};

const PAGE_SIZE_USERS = 10;

const ALLOWED_STATUS_TRANSITIONS: Partial<Record<AccountStatus, AccountStatus[]>> = {
  pending_identity: ['active', 'failed'],
  active:           ['suspended', 'disabled'],
  suspended:        ['active', 'disabled'],
};

const STATUS_BADGE: Record<AccountStatus, string> = {
  pending_identity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  active:           'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300',
  suspended:        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  disabled:         'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  failed:           'bg-gray-100   text-gray-600   dark:bg-gray-800/40   dark:text-gray-400',
};
const STATUS_LABEL: Record<AccountStatus, string> = {
  pending_identity: 'Pending', active: 'Active', suspended: 'Suspended', disabled: 'Disabled', failed: 'Failed',
};
const ALL_ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

// ============================================================================
// SHARED HELPERS
// ============================================================================

function getInitials(user: User) {
  if (user.fullName) return user.fullName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  return user.email[0]?.toUpperCase() ?? '?';
}

function errMsg(err: unknown) {
  return (err as { response?: { data?: { error?: { message?: string } } } })
    ?.response?.data?.error?.message ?? 'Something went wrong';
}

// ============================================================================
// ─── USERS TAB ──────────────────────────────────────────────────────────────
// ============================================================================

// ── Modals ──

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: (u: User) => void }) {
  const [form, setForm] = useState<AdminCreateUserPayload>({ email: '', fullName: '', displayName: '', password: '', roles: ['VIEWER'] });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function toggleRole(role: Role) {
    setForm(f => {
      const next = f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role];
      return { ...f, roles: next.length ? next : f.roles };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      const user = await usersApi.adminCreate({ email: form.email.trim(), password: form.password, roles: form.roles, ...(form.fullName?.trim() && { fullName: form.fullName.trim() }), ...(form.displayName?.trim() && { displayName: form.displayName.trim() }) });
      onSaved(user);
    } catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  }

  return (
    <Modal title="Create User" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <ErrorBanner msg={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email *" span={2}><input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" className={INPUT_CLS} /></Field>
          <Field label="Full Name"><input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Jane Doe" className={INPUT_CLS} /></Field>
          <Field label="Display Name"><input type="text" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Jane" className={INPUT_CLS} /></Field>
          <Field label="Password * (min 8)" span={2}><input type="password" required minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={INPUT_CLS} /></Field>
        </div>
        <Field label="Roles *">
          <div className="flex gap-2">{ALL_ROLES.map(r => <RoleToggleChip key={r} role={r} active={form.roles.includes(r)} onClick={() => toggleRole(r)} />)}</div>
        </Field>
        <ModalActions onClose={onClose} saving={saving} submitLabel="Create" />
      </form>
    </Modal>
  );
}

function EditRolesModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (u: User) => void }) {
  const [roles, setRoles]   = useState<Role[]>(user.roles);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function toggle(r: Role) { setRoles(prev => { const next = prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]; return next.length ? next : prev; }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    try { onSaved(await usersApi.assignRoles(user.id, roles)); }
    catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  }

  return (
    <Modal title="Edit Roles" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <ErrorBanner msg={error} />}
        <p className="text-sm text-muted-foreground">Editing roles for <span className="font-medium text-foreground">{user.email}</span></p>
        <div className="flex gap-2">{ALL_ROLES.map(r => <RoleToggleChip key={r} role={r} active={roles.includes(r)} onClick={() => toggle(r)} />)}</div>
        <ModalActions onClose={onClose} saving={saving} submitLabel="Save" />
      </form>
    </Modal>
  );
}

function ChangeStatusModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (u: User) => void }) {
  const options = ALLOWED_STATUS_TRANSITIONS[user.accountStatus] ?? [];
  const [status, setStatus] = useState<AccountStatus>(options[0] ?? user.accountStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  if (!options.length) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSaving(true);
    try { onSaved(await usersApi.updateStatus(user.id, status)); }
    catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  }

  return (
    <Modal title="Change Status" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <ErrorBanner msg={error} />}
        <p className="text-sm text-muted-foreground">Current: <StatusPill status={user.accountStatus} /></p>
        <Field label="New Status">
          <select value={status} onChange={e => setStatus(e.target.value as AccountStatus)} className={INPUT_CLS}>
            {options.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <ModalActions onClose={onClose} saving={saving} submitLabel="Apply" />
      </form>
    </Modal>
  );
}

function DisableUserModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (u: User) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function doDelete() {
    setError(null); setSaving(true);
    try { onSaved(await usersApi.delete(user.id)); }
    catch (err) { setError(errMsg(err)); } finally { setSaving(false); }
  }

  return (
    <Modal title="Disable User" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error && <ErrorBanner msg={error} />}
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <p className="text-sm">This will move <span className="font-medium">{user.email}</span> to <strong>DISABLED</strong> state. The account is retained for audit.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={doDelete} disabled={saving}>{saving ? <LoadingSpinner /> : 'Disable'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function UsersTab() {
  const [users, setUsers]   = useState<User[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(0);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState<string | null>(null);
  type UModal = { type: 'create' } | { type: 'editRoles'; user: User } | { type: 'status'; user: User } | { type: 'delete'; user: User } | null;
  const [modal, setModal]   = useState<UModal>(null);

  const fetch = useCallback(async (p: number) => {
    setLoad(true); setError(null);
    try { const r = await usersApi.list({ limit: PAGE_SIZE_USERS, offset: p * PAGE_SIZE_USERS }); setUsers(r.items); setTotal(r.total); }
    catch { setError('Failed to load users'); } finally { setLoad(false); }
  }, []);

  useEffect(() => { fetch(page); }, [fetch, page]);

  function saved() { setModal(null); fetch(page); }
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE_USERS));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} user{total !== 1 ? 's' : ''}</p>
        <Button onClick={() => setModal({ type: 'create' })} size="sm" className="gap-2">
          <UserPlus className="h-3.5 w-3.5" /> Create User
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error ? (
        <EmptyState icon={UserX} message={error} action={() => fetch(page)} actionLabel="Retry" />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} message="No users yet." action={() => setModal({ type: 'create' })} actionLabel="Create first user" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Roles</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{getInitials(u)}</div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.fullName ?? u.email}</p>
                          {u.fullName && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={u.accountStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length ? u.roles.map(r => (
                          <span key={r} className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', ROLE_META[r]?.bg, ROLE_META[r]?.color, ROLE_META[r]?.border)}>{r}</span>
                        )) : <span className="text-xs italic text-muted-foreground">none</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionBtn title="Edit roles" icon={Pencil} onClick={() => setModal({ type: 'editRoles', user: u })} />
                        {!!ALLOWED_STATUS_TRANSITIONS[u.accountStatus]?.length && (
                          <ActionBtn title="Change status" icon={RefreshCw} onClick={() => setModal({ type: 'status', user: u })} />
                        )}
                        {u.accountStatus !== 'disabled' && u.accountStatus !== 'failed' && (
                          <ActionBtn title="Disable" icon={Trash2} onClick={() => setModal({ type: 'delete', user: u })} danger />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">Showing {page * PAGE_SIZE_USERS + 1}–{Math.min((page + 1) * PAGE_SIZE_USERS, total)} of {total}</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="px-2 text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {modal?.type === 'create'    && <CreateUserModal     onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'editRoles' && <EditRolesModal      user={modal.user} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'status'    && <ChangeStatusModal   user={modal.user} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'delete'    && <DisableUserModal    user={modal.user} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}

// ============================================================================
// ─── ROLES TAB ──────────────────────────────────────────────────────────────
// ============================================================================

function RolesTab() {
  const [roles, setRoles]     = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    permissionsApi.listRoles()
      .then(setRoles)
      .catch(() => setError('Failed to load roles'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error)   return <EmptyState icon={AlertTriangle} message={error} />;

  // Group permissions by resource for each role
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {roles.map((role, i) => {
        const meta = ROLE_META[role.name] ?? ROLE_META['VIEWER'];
        const Icon = meta.icon;
        const byResource: Record<string, Permission[]> = {};
        for (const p of role.permissions) {
          (byResource[p.resource] ??= []).push(p);
        }
        const isExpanded = expanded === role.id;

        return (
          <div
            key={role.id}
            className={cn(
              'rounded-2xl border bg-card shadow-sm transition-all duration-300',
              'hover:shadow-lg cursor-pointer',
              meta.border, isExpanded && `shadow-lg ${meta.glow}`,
            )}
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => setExpanded(isExpanded ? null : role.id)}
          >
            {/* Card header */}
            <div className={cn('flex items-center gap-4 rounded-t-2xl p-5', meta.bg)}>
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', meta.border, meta.bg)}>
                <Icon className={cn('h-6 w-6', meta.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn('text-lg font-bold', meta.color)}>{role.name}</h3>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', meta.bg, meta.color, meta.border)}>
                    {role.permissions.length} perms
                  </span>
                </div>
                {role.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{role.description}</p>}
              </div>
            </div>

            {/* Permission summary / expanded */}
            <div className="p-4">
              {isExpanded ? (
                <div className="flex flex-col gap-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                  {Object.entries(byResource).map(([resource, perms]) => {
                    const rm = RESOURCE_META[resource];
                    const RIcon = rm?.icon ?? Shield;
                    return (
                      <div key={resource}>
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <div className={cn('flex h-5 w-5 items-center justify-center rounded', rm?.bg)}><RIcon className={cn('h-3 w-3', rm?.color)} /></div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{rm?.label ?? resource}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {perms.map(p => (
                            <span key={p.id} className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', ACTION_COLORS[p.action] ?? 'text-gray-600 bg-gray-100 border-gray-200')}>{p.action}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.slice(0, 8).map(p => (
                    <span key={p.id} className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', ACTION_COLORS[p.action] ?? 'text-gray-600 bg-gray-100')}>{p.name}</span>
                  ))}
                  {role.permissions.length > 8 && (
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground border-muted-foreground/30">+{role.permissions.length - 8} more</span>
                  )}
                </div>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">{isExpanded ? '▲ click to collapse' : '▼ click to expand'}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// ─── PERMISSIONS TAB (MATRIX) ────────────────────────────────────────────────
// ============================================================================

function PermissionsTab() {
  const [roles,       setRoles]       = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Local draft state: roleId → Set<permissionId>
  const [draft, setDraft]   = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    Promise.all([permissionsApi.listRoles(), permissionsApi.listPermissions()])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
        // Initialise draft from current assignments
        const initial: Record<string, Set<string>> = {};
        for (const role of r) {
          initial[role.id] = new Set(role.permissions.map(p => p.id));
        }
        setDraft(initial);
      })
      .catch(() => setError('Failed to load permissions'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(roleId: string, permId: string) {
    setDraft(prev => {
      const next = { ...prev, [roleId]: new Set(prev[roleId]) };
      if (next[roleId].has(permId)) next[roleId].delete(permId);
      else next[roleId].add(permId);
      return next;
    });
    setDirty(true);
    setSaved(false);
  }

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all(
        roles.map(r => permissionsApi.setRolePermissions(r.id, Array.from(draft[r.id] ?? [])))
      );
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Failed to save permissions'); } finally { setSaving(false); }
  }

  function reset() {
    const initial: Record<string, Set<string>> = {};
    for (const role of roles) initial[role.id] = new Set(role.permissions.map(p => p.id));
    setDraft(initial);
    setDirty(false);
    setSaved(false);
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error)   return <EmptyState icon={AlertTriangle} message={error} />;

  // Group permissions by resource
  const byResource: Record<string, Permission[]> = {};
  for (const p of permissions) (byResource[p.resource] ??= []).push(p);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky save bar */}
      <div className={cn(
        'sticky top-0 z-10 flex items-center justify-between rounded-xl border px-4 py-3 backdrop-blur-sm transition-all duration-300',
        dirty
          ? 'border-amber-500/50 bg-amber-500/10 shadow-md shadow-amber-500/10'
          : saved
          ? 'border-green-500/50 bg-green-500/10'
          : 'border-border/50 bg-card/80',
      )}>
        <div className="flex items-center gap-2">
          {dirty ? (
            <><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-sm font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span></>
          ) : saved ? (
            <><CheckCheck className="h-4 w-4 text-green-500" /><span className="text-sm font-medium text-green-700 dark:text-green-400">Saved successfully</span></>
          ) : (
            <><Settings2 className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click cells to toggle permissions</span></>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && <Button variant="outline" size="sm" onClick={reset}>Reset</Button>}
          <Button size="sm" onClick={saveAll} disabled={!dirty || saving} className="gap-1.5">
            {saving ? <LoadingSpinner /> : <><Save className="h-3.5 w-3.5" /> Save</>}
          </Button>
        </div>
      </div>

      {/* Matrix table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-4 text-left text-sm font-semibold">Permission</th>
                {roles.map(role => {
                  const meta = ROLE_META[role.name] ?? ROLE_META['VIEWER'];
                  const Icon = meta.icon;
                  return (
                    <th key={role.id} className="px-6 py-4 text-center">
                      <div className={cn('inline-flex flex-col items-center gap-1 rounded-xl px-4 py-2', meta.bg)}>
                        <Icon className={cn('h-5 w-5', meta.color)} />
                        <span className={cn('text-xs font-bold uppercase tracking-wide', meta.color)}>{role.name}</span>
                        <span className="text-xs text-muted-foreground">{draft[role.id]?.size ?? 0} perms</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byResource).map(([resource, perms]) => {
                const rm   = RESOURCE_META[resource];
                const RIcon = rm?.icon ?? Shield;
                return [
                  // Resource group header
                  <tr key={`group-${resource}`} className="border-b bg-muted/30">
                    <td colSpan={roles.length + 1} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded', rm?.bg)}><RIcon className={cn('h-3.5 w-3.5', rm?.color)} /></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{rm?.label ?? resource}</span>
                      </div>
                    </td>
                  </tr>,
                  // Permission rows
                  ...perms.map(perm => (
                    <tr key={perm.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', ACTION_COLORS[perm.action] ?? '')}>{perm.action}</span>
                          <span className="text-sm text-muted-foreground">{perm.description ?? perm.name}</span>
                        </div>
                      </td>
                      {roles.map(role => {
                        const granted = draft[role.id]?.has(perm.id) ?? false;
                        const meta = ROLE_META[role.name] ?? ROLE_META['VIEWER'];
                        return (
                          <td key={role.id} className="px-6 py-3 text-center">
                            <button
                              onClick={() => toggle(role.id, perm.id)}
                              className={cn(
                                'h-7 w-7 rounded-full border-2 transition-all duration-200 mx-auto flex items-center justify-center',
                                granted
                                  ? cn('scale-110', meta.bg, meta.border, meta.color)
                                  : 'border-muted-foreground/20 hover:border-muted-foreground/50',
                              )}
                              title={`${granted ? 'Revoke' : 'Grant'} ${perm.name} from ${role.name}`}
                            >
                              {granted && <CheckCheck className="h-3.5 w-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// ─── SHARED MICRO-COMPONENTS ────────────────────────────────────────────────
// ============================================================================

const INPUT_CLS = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, span, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'col-span-2 flex flex-col gap-1' : 'flex flex-col gap-1'}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ModalActions({ onClose, saving, submitLabel }: { onClose: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? <LoadingSpinner /> : submitLabel}</Button>
    </div>
  );
}

function RoleToggleChip({ role, active, onClick }: { role: Role; active: boolean; onClick: () => void }) {
  const meta = ROLE_META[role] ?? ROLE_META['VIEWER'];
  return (
    <button type="button" onClick={onClick}
      className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150',
        active ? cn(meta.bg, meta.color, meta.border, 'scale-105') : 'border-border text-muted-foreground hover:border-primary/50')}>
      <Shield className="h-3 w-3" />{role}
    </button>
  );
}

function StatusPill({ status }: { status: AccountStatus }) {
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_BADGE[status])}>{STATUS_LABEL[status]}</span>;
}

function ActionBtn({ title, icon: Icon, onClick, danger }: { title: string; icon: React.ElementType; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick}
      className={cn('rounded p-1.5 transition-colors text-muted-foreground',
        danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-accent hover:text-accent-foreground')}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function EmptyState({ icon: Icon, message, action, actionLabel }: { icon: React.ElementType; message: string; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && actionLabel && <Button variant="outline" size="sm" onClick={action}>{actionLabel}</Button>}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive border border-destructive/20">{msg}</p>;
}

// ============================================================================
// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
// ============================================================================

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('users');

  return (
    <div className="flex flex-col gap-0 min-h-screen">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden border-b bg-gradient-to-br from-violet-950/30 via-indigo-950/20 to-background px-6 pt-8 pb-6">
        {/* Background orbs */}
        <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-8 right-10 h-48 w-48 rounded-full bg-indigo-600/10 blur-2xl" />

        <div className="relative flex items-center gap-4 max-w-6xl mx-auto">
          {/* Icon */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>

          {/* Title */}
          <div>
            <h1 className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Administration
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Manage users, roles, and fine-grained permissions
            </p>
          </div>

          {/* Live indicator */}
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            <span className="text-xs font-medium text-violet-400">Live</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="relative mt-6 max-w-6xl mx-auto">
          <div className="flex gap-1 rounded-xl bg-muted/50 border p-1 w-fit">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-card shadow-sm text-foreground border border-border/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? tab.color : 'text-muted-foreground')} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full">
        {activeTab === 'users'       && <UsersTab />}
        {activeTab === 'roles'       && <RolesTab />}
        {activeTab === 'permissions' && <PermissionsTab />}
      </div>
    </div>
  );
}
