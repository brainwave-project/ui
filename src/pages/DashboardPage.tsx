import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText, FolderArchive, Workflow, Users, AlertTriangle, ArrowRight,
  Sparkles, PieChart, Activity, Telescope, FlaskConical, MessageSquare, Gauge, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AICore } from '@/components/ai/AICore';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { CompositionGauge, type GaugeSegment } from '@/features/dashboard/components/CompositionGauge';
import { ActivityFeed } from '@/features/dashboard/components/ActivityFeed';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { env } from '@/config/env';

export function DashboardPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = !!user?.roles.includes('ADMIN');

  const available  = useDocuments({ state: 'AVAILABLE',  limit: 1 });
  const archived   = useDocuments({ state: 'ARCHIVED',   limit: 1 });
  const received   = useDocuments({ state: 'RECEIVED',   limit: 1 });
  const persisting = useDocuments({ state: 'PERSISTING', limit: 1 });
  const failed     = useDocuments({ state: 'FAILED',     limit: 1 });

  const users = useQuery({
    queryKey: ['dashboard', 'users-count'],
    queryFn:  () => usersApi.list({ limit: 1 }),
    enabled:  isAdmin,
  });

  const inPipeline = (received.data?.total ?? 0) + (persisting.data?.total ?? 0);
  const docsLoading =
    available.isLoading || archived.isLoading || received.isLoading || persisting.isLoading || failed.isLoading;

  const segments: GaugeSegment[] = [
    { label: 'Searchable',  value: available.data?.total ?? 0,  color: 'hsl(152 76% 50%)' },
    { label: 'In pipeline', value: inPipeline,                  color: 'hsl(38 92% 56%)' },
    { label: 'Archived',    value: archived.data?.total ?? 0,   color: 'hsl(220 9% 60%)' },
    { label: 'Failed',      value: failed.data?.total ?? 0,     color: 'hsl(var(--destructive))' },
  ];
  const totalDocs = segments.reduce((s, x) => s + x.value, 0);
  const health    = totalDocs > 0 ? (available.data?.total ?? 0) / totalDocs : 0;

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
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neon">Neural Workspace</p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              {greeting}
              {user?.email ? <>, <span className="neon-text">{user.email.split('@')[0]}</span></> : ''}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Your knowledge base is online and indexed. Operate the full RAG stack from{' '}
              <span className="text-foreground">Know Ops</span> — ingestion, retrieval, documents and chat.
            </p>
            <Link
              to="/know-ops/retrieval"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-neon-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow-sm transition-all hover:shadow-glow"
            >
              <Sparkles className="h-4 w-4" /> Open Retrieval Lab <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <AICore size={120} className="hidden shrink-0 animate-float sm:block" />
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={FileText}      label="Searchable Docs" value={available.data?.total} caption={`${totalDocs} total in base`} to="/know-ops/documents" loading={available.isLoading} accent="neon"    delay={0} />
        <StatTile icon={Workflow}      label="In Pipeline"     value={inPipeline}            caption="received + persisting"      to="/know-ops/ingestion" loading={received.isLoading || persisting.isLoading} accent="plasma" delay={80} />
        <StatTile icon={FolderArchive} label="Archived"        value={archived.data?.total}  to="/know-ops/documents" loading={archived.isLoading} accent="aurora"  delay={160} />
        {isAdmin ? (
          <StatTile icon={Users}         label="Users"   value={users.data?.total}  to="/users"              loading={users.isLoading}   accent="emerald" delay={240} />
        ) : (
          <StatTile icon={AlertTriangle} label="Failed"  value={failed.data?.total} to="/know-ops/ingestion" loading={failed.isLoading}  accent="aurora"  delay={240} />
        )}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Composition donut */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart className="h-4 w-4 text-neon" /> Knowledge Base Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex h-[220px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-neon" />
              </div>
            ) : totalDocs === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileText className="h-7 w-7 opacity-50" />
                <p className="text-sm">No documents yet — upload to begin indexing.</p>
              </div>
            ) : (
              <CompositionGauge segments={segments} health={health} healthLabel="searchable" />
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-plasma" /> {isAdmin ? 'System Activity' : 'Your Activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed admin={isAdmin} />
          </CardContent>
        </Card>
      </div>

      {/* Quick links / system map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-neon" /> System Map
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/know-ops/ingestion"  icon={Workflow}      title="Ingestion"      desc="Pipeline & chunking governance" />
          <QuickLink to="/know-ops/retrieval"  icon={FlaskConical}  title="Retrieval Lab"  desc="Tune Top-K, score, vector space" />
          <QuickLink to="/know-ops/chat"       icon={MessageSquare} title="AI Chat"        desc="Grounded, cited conversations" />
          <QuickLink to="/observability"       icon={Gauge}         title="Observability"  desc="Metrics, logs & traces" />
          <QuickLink to="/llm-observability"   icon={Telescope}     title="LLM Traces"     desc="RAG spans & generations" />
          <QuickLink href={env.VITE_LANGFUSE_URL} icon={ExternalLink} title="Langfuse"     desc="Self-hosted prompt console" external />
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLink({
  to, href, icon: Icon, title, desc, external,
}: {
  to?: string; href?: string; icon: React.ElementType; title: string; desc: string; external?: boolean;
}) {
  const inner = (
    <div className="group flex items-center gap-3 rounded-xl border border-white/8 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-neon/40 hover:shadow-glow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neon transition-colors group-hover:bg-neon/15">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium">
          {title}
          {external && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-neon" />
    </div>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noreferrer">{inner}</a>;
  }
  return <Link to={to!}>{inner}</Link>;
}
