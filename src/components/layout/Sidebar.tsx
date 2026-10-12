import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogOut, Activity, ClipboardList, ShieldCheck,
  MessageSquare, SlidersHorizontal, Boxes, Workflow, FlaskConical, FolderArchive, ChevronDown,
  Gauge, Database, Search, Scale, Sigma, Settings2, MessageSquareQuote, Gavel, GitPullRequestArrow, Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { AICore } from '@/components/ai/AICore';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

interface NavItem { to: string; icon: React.ElementType; label: string }

const TOP: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

const KNOW_OPS: NavItem[] = [
  { to: '/know-ops/ingestion', icon: Workflow,      label: 'Ingestion'     },
  { to: '/know-ops/retrieval', icon: FlaskConical,  label: 'Retrieval Lab' },
  { to: '/know-ops/documents', icon: FolderArchive, label: 'Documents'     },
  { to: '/know-ops/chat',      icon: MessageSquare, label: 'Chat'          },
];

const EVALUATION: NavItem[] = [
  { to: '/evaluation/dataset',     icon: Database,      label: 'Golden Sets'   },
  { to: '/evaluation/retrieval',   icon: Search,        label: 'Retrieval'     },
  { to: '/evaluation/normalization', icon: Languages,   label: 'Arabic Norm'    },
  { to: '/evaluation/experiments', icon: Scale,         label: 'Experiments'   },
  { to: '/evaluation/stats',       icon: Sigma,         label: 'Stats Lab'     },
  { to: '/evaluation/generation',  icon: MessageSquareQuote, label: 'Generation' },
  { to: '/evaluation/judges',      icon: Gavel,         label: 'Judge Lab'     },
  { to: '/evaluation/gate',        icon: GitPullRequestArrow, label: 'Release Gate' },
];

/** Account + platform operations — everything that is not a knowledge or evaluation workflow. */
const PLATFORM: NavItem[] = [
  { to: '/profile',       icon: Users,             label: 'Profile'        },
  { to: '/observability', icon: Activity,          label: 'Observability'  },
  { to: '/governance',    icon: SlidersHorizontal, label: 'Governance'     },
  { to: '/admin',         icon: ShieldCheck,       label: 'Administration' },
  { to: '/activity',      icon: ClipboardList,     label: 'Activity'       },
];

function ActiveRail({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-neon transition-all duration-200',
        active ? 'opacity-100 shadow-glow' : 'opacity-0',
      )}
    />
  );
}

function NavRow({ item, open }: { item: NavItem; open: boolean }) {
  const { icon: Icon, to, label } = item;
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive ? 'bg-neon/10 text-neon shadow-glow-inner' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
        !open && 'justify-center px-2',
      )}
    >
      {({ isActive }) => (
        <>
          <ActiveRail active={isActive} />
          <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', isActive && 'drop-glow')} />
          {open && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

/**
 * A collapsible nav group. Active when the current path belongs to any of its items;
 * on the collapsed rail the header jumps to the first item.
 */
function NavGroup({
  label, icon: Icon, items, open, defaultExpanded = true,
}: {
  label: string; icon: React.ElementType; items: NavItem[]; open: boolean; defaultExpanded?: boolean;
}) {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const active       = items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  const [expanded, setExpanded] = useState(defaultExpanded || active);

  function toggle() {
    if (!open) {
      navigate(items[0].to);
      return;
    }
    setExpanded((v) => !v);
  }

  return (
    <>
      <button
        onClick={toggle}
        className={cn(
          'group relative mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          active ? 'text-neon' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
          !open && 'justify-center px-2',
        )}
      >
        <ActiveRail active={active && !expanded} />
        <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active && 'drop-glow')} />
        {open && (
          <>
            <span className="flex-1 text-left">{label}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded ? 'rotate-180' : '')} />
          </>
        )}
      </button>

      {open && expanded && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-white/8 pl-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                  isActive ? 'bg-neon/10 text-neon' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                )
              }
            >
              <item.icon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

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
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">AI Core</p>
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {TOP.map((item) => <NavRow key={item.to} item={item} open={open} />)}

        <NavGroup label="Know Ops"   icon={Boxes}     items={KNOW_OPS}   open={open} />
        <NavGroup label="Evaluation" icon={Gauge}     items={EVALUATION} open={open} />

        <Separator className="my-1 bg-white/5" />

        <NavGroup label="Platform"   icon={Settings2} items={PLATFORM}   open={open} defaultExpanded={false} />
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
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Systems Online</span>
          </div>
        )}
        {open && user && <p className="truncate px-1 text-xs text-muted-foreground">{user.email}</p>}
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
