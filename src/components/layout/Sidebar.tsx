import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents',  icon: FileText,        label: 'Documents' },
  { to: '/profile',    icon: Users,            label: 'Profile' },
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
        'flex h-screen flex-col border-r bg-card transition-all duration-200',
        open ? 'w-56' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4 font-semibold">
        <Brain className="h-6 w-6 shrink-0 text-primary" />
        {open && <span className="text-lg">Brainwave</span>}
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                !open && 'justify-center px-2',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {open && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <Separator />

      {/* User + logout */}
      <div className="p-2">
        {open && user && (
          <p className="truncate px-3 py-1 text-xs text-muted-foreground">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
            !open && 'justify-center px-2',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
