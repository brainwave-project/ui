import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Activity, ClipboardList, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { AICore } from '@/components/ai/AICore';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'      },
  { to: '/search',        icon: Sparkles,        label: 'Neural Search'  },
  { to: '/documents',     icon: FileText,        label: 'Documents'      },
  { to: '/activity',      icon: ClipboardList,   label: 'Activity'       },
  { to: '/admin',         icon: ShieldCheck,     label: 'Administration' },
  { to: '/observability', icon: Activity,        label: 'Observability'  },
  { to: '/profile',       icon: Users,           label: 'Profile'        },
];

export function Sidebar({ open }: { open: boolean }) {
  const { logout, user } = useAuthStore();

  async function handleLogout() {
    await authApi.logout().catch(() => {});
    logout();
  }

  return (
    <aside
      className={cn(
        'glass-strong z-10 flex h-screen flex-col border-r border-white/5 transition-all duration-300',
        open ? 'w-60' : 'w-16',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-3">
        <AICore size={open ? 40 : 36} ripples={false} className="shrink-0" />
        {open && (
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-tight neon-text">BRAINWAVE</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              AI Core
            </p>
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-neon/10 text-neon shadow-glow-inner'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                !open && 'justify-center px-2',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* active rail */}
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-neon transition-all duration-200',
                    isActive ? 'opacity-100 shadow-glow' : 'opacity-0',
                  )}
                />
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                    isActive && 'drop-glow',
                  )}
                />
                {open && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-white/5" />

      {/* Status + user + logout */}
      <div className="space-y-2 p-3">
        {open && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              Systems Online
            </span>
          </div>
        )}
        {open && user && (
          <p className="truncate px-1 text-xs text-muted-foreground">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            !open && 'justify-center px-2',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open && <span>Disconnect</span>}
        </button>
      </div>
    </aside>
  );
}
