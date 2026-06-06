import { FileText, FolderArchive, Upload, User, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AICore } from '@/components/ai/AICore';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useAuthStore } from '@/store/auth.store';

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value?: number | string;
  to: string;
  delay: number;
}) {
  return (
    <Link to={to} className="group block animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <Card className="relative overflow-hidden hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow">
        {/* corner glow */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-neon/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-neon transition-colors group-hover:bg-neon/15">
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="font-display text-3xl font-bold">
            {value ?? <span className="animate-pulse text-muted-foreground/40">—</span>}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPage() {
  const user      = useAuthStore((s) => s.user);
  const available = useDocuments({ state: 'AVAILABLE', limit: 1 });
  const archived  = useDocuments({ state: 'ARCHIVED', limit: 1 });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      {/* Hero command bar */}
      <Card className="relative overflow-hidden holo-border">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.4]" />
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-plasma/20 blur-3xl" />
        <CardContent className="relative flex items-center justify-between gap-6 p-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neon">
              Neural Workspace
            </p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              {greeting}
              {user?.email ? <>, <span className="neon-text">{user.email.split('@')[0]}</span></> : ''}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Your knowledge base is online and indexed. Ask anything in natural language —
              local AI handles the rest.
            </p>
            <Link
              to="/search"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-neon-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow-sm transition-all hover:shadow-glow"
            >
              <Sparkles className="h-4 w-4" />
              Launch Neural Search
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <AICore size={120} className="hidden shrink-0 animate-float sm:block" />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText}     label="Available Docs" value={available.data?.total} to="/documents"        delay={0}   />
        <StatCard icon={FolderArchive} label="Archived"       value={archived.data?.total}  to="/documents"        delay={80}  />
        <StatCard icon={Upload}        label="Upload New"     value="↑"                     to="/documents/upload" delay={160} />
        <StatCard icon={User}          label="Your Profile"   value="→"                     to="/profile"          delay={240} />
      </div>

      {/* Quick tips */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '320ms' }}>
        <CardHeader>
          <CardTitle className="font-display text-sm font-semibold">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Upload documents via the{' '}
            <Link to="/documents/upload" className="text-neon underline-offset-4 hover:underline">
              Upload
            </Link>{' '}
            page — they transition through{' '}
            <code className="rounded bg-muted px-1 font-mono text-xs text-neon">RECEIVED → PERSISTING → AVAILABLE</code>{' '}
            automatically, then get chunked and embedded for semantic search.
          </p>
          <p>
            Once a document is <span className="font-medium text-foreground">AVAILABLE</span> you can view,
            archive, or surface conceptually related documents from its detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
