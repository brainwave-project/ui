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
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <PanelLeft className="h-4 w-4" />
        </Button>
        {title && <h1 className="text-sm font-semibold">{title}</h1>}
      </div>

      {user && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:block">{user.email}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user.email[0]?.toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
