import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  title?: string;
}

export function Header({ title }: Props) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);

  return (
    <header className="glass z-[5] flex h-16 items-center justify-between border-b border-white/5 px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <PanelLeft className="h-4 w-4" />
        </Button>
        {title && (
          <div className="flex items-center gap-2">
            <span className="h-4 w-px bg-gradient-to-b from-transparent via-neon/60 to-transparent" />
            <h1 className="font-display text-sm font-semibold tracking-wide text-foreground">
              {title}
            </h1>
          </div>
        )}
      </div>

      {user && (
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden font-mono text-xs text-muted-foreground sm:block">
            {user.email}
          </span>
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neon-gradient text-xs font-bold text-primary-foreground shadow-glow-sm">
              {user.email[0]?.toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
          </div>
        </div>
      )}
    </header>
  );
}
