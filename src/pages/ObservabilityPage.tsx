import {
  BarChart3,
  Layers,
  GitBranch,
  Bell,
  Container,
  Server,
  Database,
  Activity,
  ExternalLink,
  ShieldCheck,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tool registry — update ports here if your .env.dev changes them
// ---------------------------------------------------------------------------
type ToolAccent =
  | 'cyan'      // metrics
  | 'emerald'   // logs
  | 'violet'    // traces
  | 'amber'     // host / container
  | 'sky'       // postgres
  | 'green'     // mongo
  | 'rose'      // auth
  | 'indigo'    // gateway
  | 'orange';   // object storage

interface ObservabilityTool {
  id:          string;
  label:       string;
  description: string;
  url:         string;
  icon:        React.ElementType;
  badge:       string;
  accent:      ToolAccent;
}

// Tailwind classes per accent. Kept as a static map so the JIT can pick them up.
const ACCENT: Record<ToolAccent, {
  icon:       string;
  iconBg:     string;
  border:     string;
  hoverGlow:  string;
  badge:      string;
  dot:        string;
}> = {
  cyan: {
    icon:      'text-cyan-500 dark:text-cyan-400',
    iconBg:    'bg-cyan-500/10 group-hover:bg-cyan-500/20',
    border:    'border-cyan-500/20 hover:border-cyan-500/50',
    hoverGlow: 'hover:shadow-cyan-500/20',
    badge:     'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
    dot:       'bg-cyan-500',
  },
  emerald: {
    icon:      'text-emerald-500 dark:text-emerald-400',
    iconBg:    'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    border:    'border-emerald-500/20 hover:border-emerald-500/50',
    hoverGlow: 'hover:shadow-emerald-500/20',
    badge:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    dot:       'bg-emerald-500',
  },
  violet: {
    icon:      'text-violet-500 dark:text-violet-400',
    iconBg:    'bg-violet-500/10 group-hover:bg-violet-500/20',
    border:    'border-violet-500/20 hover:border-violet-500/50',
    hoverGlow: 'hover:shadow-violet-500/20',
    badge:     'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
    dot:       'bg-violet-500',
  },
  amber: {
    icon:      'text-amber-500 dark:text-amber-400',
    iconBg:    'bg-amber-500/10 group-hover:bg-amber-500/20',
    border:    'border-amber-500/20 hover:border-amber-500/50',
    hoverGlow: 'hover:shadow-amber-500/20',
    badge:     'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    dot:       'bg-amber-500',
  },
  sky: {
    icon:      'text-sky-500 dark:text-sky-400',
    iconBg:    'bg-sky-500/10 group-hover:bg-sky-500/20',
    border:    'border-sky-500/20 hover:border-sky-500/50',
    hoverGlow: 'hover:shadow-sky-500/20',
    badge:     'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
    dot:       'bg-sky-500',
  },
  green: {
    icon:      'text-green-500 dark:text-green-400',
    iconBg:    'bg-green-500/10 group-hover:bg-green-500/20',
    border:    'border-green-500/20 hover:border-green-500/50',
    hoverGlow: 'hover:shadow-green-500/20',
    badge:     'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
    dot:       'bg-green-500',
  },
  rose: {
    icon:      'text-rose-500 dark:text-rose-400',
    iconBg:    'bg-rose-500/10 group-hover:bg-rose-500/20',
    border:    'border-rose-500/20 hover:border-rose-500/50',
    hoverGlow: 'hover:shadow-rose-500/20',
    badge:     'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
    dot:       'bg-rose-500',
  },
  indigo: {
    icon:      'text-indigo-500 dark:text-indigo-400',
    iconBg:    'bg-indigo-500/10 group-hover:bg-indigo-500/20',
    border:    'border-indigo-500/20 hover:border-indigo-500/50',
    hoverGlow: 'hover:shadow-indigo-500/20',
    badge:     'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    dot:       'bg-indigo-500',
  },
  orange: {
    icon:      'text-orange-500 dark:text-orange-400',
    iconBg:    'bg-orange-500/10 group-hover:bg-orange-500/20',
    border:    'border-orange-500/20 hover:border-orange-500/50',
    hoverGlow: 'hover:shadow-orange-500/20',
    badge:     'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
    dot:       'bg-orange-500',
  },
};

const METRICS: ObservabilityTool[] = [
  {
    id:          'grafana',
    label:       'Grafana',
    description: 'Dashboards for metrics, logs, and traces (admin / admin)',
    url:         'http://localhost:3030',
    icon:        BarChart3,
    badge:       'Metrics · Logs · Traces',
    accent:      'cyan',
  },
  {
    id:          'prometheus',
    label:       'Prometheus',
    description: 'Metrics store — query PromQL, inspect scrape targets & alerts',
    url:         'http://localhost:9090',
    icon:        Activity,
    badge:       'Metrics',
    accent:      'cyan',
  },
  {
    id:          'alertmanager',
    label:       'Alertmanager',
    description: 'Alert routing, silences, and notification status',
    url:         'http://localhost:9093',
    icon:        Bell,
    badge:       'Alerts',
    accent:      'cyan',
  },
];

const LOGS: ObservabilityTool[] = [
  {
    id:          'loki-explore',
    label:       'View Logs (Grafana → Loki)',
    description: 'Open Grafana Explore with Loki preselected — run LogQL queries against all service logs',
    url:         'http://localhost:3030/explore?left=%7B%22datasource%22:%22loki%22%7D',
    icon:        Layers,
    badge:       'Logs',
    accent:      'emerald',
  },
];

const TRACES: ObservabilityTool[] = [
  {
    id:          'tempo-explore',
    label:       'View Traces (Grafana → Tempo)',
    description: 'Open Grafana Explore with Tempo preselected — run TraceQL queries and view flame graphs',
    url:         'http://localhost:3030/explore?left=%7B%22datasource%22:%22tempo%22%7D',
    icon:        GitBranch,
    badge:       'Traces',
    accent:      'violet',
  },
  {
    id:          'otel-zpages',
    label:       'OTel Collector zPages',
    description: 'Live pipeline debug — running spans, exporter status, trace samples',
    url:         'http://localhost:5679/debug/servicez',
    icon:        Activity,
    badge:       'OTel Pipeline',
    accent:      'violet',
  },
];

const INFRA: ObservabilityTool[] = [
  {
    id:          'cadvisor',
    label:       'cAdvisor',
    description: 'Per-container CPU, memory, and network metrics (live)',
    url:         'http://localhost:8181',
    icon:        Container,
    badge:       'Containers',
    accent:      'amber',
  },
  {
    id:          'node-exporter',
    label:       'Node Exporter',
    description: 'Host-level OS metrics — CPU, memory, disk, network',
    url:         'http://localhost:9100/metrics',
    icon:        Server,
    badge:       'Host',
    accent:      'amber',
  },
  {
    id:          'postgres-exporter',
    label:       'Postgres Exporter',
    description: 'PostgreSQL query stats, connection pool, and replication lag',
    url:         'http://localhost:9187/metrics',
    icon:        Database,
    badge:       'PostgreSQL',
    accent:      'sky',
  },
  {
    id:          'mongodb-exporter',
    label:       'MongoDB Exporter',
    description: 'MongoDB operation counters, replica set state, WiredTiger stats',
    url:         'http://localhost:9216/metrics',
    icon:        Database,
    badge:       'MongoDB',
    accent:      'green',
  },
];

const ADMIN: ObservabilityTool[] = [
  {
    id:          'keycloak',
    label:       'Keycloak Admin',
    description: 'Identity provider — realms, clients, users, and roles',
    url:         'http://localhost:8080/admin',
    icon:        ShieldCheck,
    badge:       'Auth',
    accent:      'rose',
  },
  {
    id:          'kong-manager',
    label:       'Kong Manager',
    description: 'Built-in Kong OSS UI (3.4+) — browse routes, services, plugins, and consumers',
    url:         'http://localhost:8002',
    icon:        Server,
    badge:       'API Gateway',
    accent:      'indigo',
  },
  {
    id:          'minio',
    label:       'MinIO Console',
    description: 'Object storage browser — buckets, objects, and access policies',
    url:         'http://localhost:9001',
    icon:        Database,
    badge:       'Object Storage',
    accent:      'orange',
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface ToolTileProps {
  tool:  ObservabilityTool;
  index: number;
}

function ToolTile({ tool, index }: ToolTileProps) {
  const Icon   = tool.icon;
  const colors = ACCENT[tool.accent];

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        'group relative flex min-w-0 items-start gap-4 overflow-hidden rounded-xl border-2 bg-card p-5',
        'shadow-sm transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-lg',
        'animate-fade-in-up',
        colors.border,
        colors.hoverGlow,
      )}
    >
      {/* Decorative background blob — sits behind everything, brightens on hover */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-30',
          'transition-opacity duration-500 group-hover:opacity-60',
          colors.iconBg,
        )}
      />

      {/* Icon tile */}
      <div
        className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          'transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
          colors.iconBg,
        )}
      >
        <Icon className={cn('h-5 w-5', colors.icon)} />
      </div>

      {/* Body */}
      <div className="relative min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 break-words text-base font-semibold leading-tight">
            {tool.label}
          </span>
          <ExternalLink
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-300',
              'opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
              colors.icon,
            )}
            aria-hidden
          />
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
            colors.badge,
          )}
        >
          {tool.badge}
        </span>
        <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
          {tool.description}
        </p>
      </div>
    </a>
  );
}

interface SectionProps {
  title:       string;
  description: string;
  tools:       ObservabilityTool[];
  accent:      ToolAccent;
  icon:        React.ElementType;
  /**
   * `single` — one tile per row (use inside narrow columns, e.g. three-pillar layout).
   * `wide`   — multi-column when the section spans the full main width.
   */
  toolColumns?: 'single' | 'wide';
  /** Stagger offset for entrance animation so siblings don't all pop in at once. */
  staggerStart?: number;
}

function Section({
  title,
  description,
  tools,
  accent,
  icon: HeaderIcon,
  toolColumns = 'wide',
  staggerStart = 0,
}: SectionProps) {
  const colors = ACCENT[accent];
  const gridClass =
    toolColumns === 'single'
      ? 'grid grid-cols-1 gap-3'
      : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden',
        'transition-all duration-300 hover:bg-card/80',
        colors.border,
      )}
    >
      {/* Header strip — subtle moving gradient tint based on accent color */}
      <div
        className={cn(
          'relative px-5 py-4 border-b overflow-hidden',
          colors.border,
        )}
      >
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 opacity-20',
            'bg-gradient-to-r from-transparent via-current to-transparent',
            'bg-[length:200%_100%] animate-gradient-shift',
            colors.icon,
          )}
        />
        <div className="relative flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              colors.iconBg,
            )}
          >
            <HeaderIcon className={cn('h-4 w-4', colors.icon)} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold leading-tight">{title}</h3>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Tools grid */}
      <div className="p-4">
        <div className={cn(gridClass, 'min-w-0 [&>*]:min-w-0')}>
          {tools.map((tool, i) => (
            <ToolTile key={tool.id} tool={tool} index={staggerStart + i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ObservabilityPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-cyan-500/5 via-violet-500/5 to-emerald-500/5 p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Gauge className="h-6 w-6 text-primary" />
              <h1 className="bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 bg-clip-text text-2xl font-bold text-transparent">
                Observability
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Platform governance — quick access to every monitoring, tracing, and admin tool in your local
              Docker stack. All links open in a new tab.
            </p>
          </div>

          {/* Live indicator */}
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
            </span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Local stack</span>
          </div>
        </div>
      </div>

      {/* Three Pillars */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Three Pillars of Observability
          </h2>
          <span className="text-xs text-muted-foreground">Metrics · Logs · Traces</span>
        </header>
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <Section
            title="Metrics"
            description="Time-series data, dashboards, and SLO alerting"
            tools={METRICS}
            accent="cyan"
            icon={BarChart3}
            toolColumns="single"
            staggerStart={0}
          />
          <Section
            title="Logs"
            description="Structured log aggregation via Loki + Promtail"
            tools={LOGS}
            accent="emerald"
            icon={Layers}
            toolColumns="single"
            staggerStart={3}
          />
          <Section
            title="Traces"
            description="Distributed request tracing via OTel Collector + Tempo"
            tools={TRACES}
            accent="violet"
            icon={GitBranch}
            toolColumns="single"
            staggerStart={4}
          />
        </div>
      </section>

      {/* Infrastructure */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Infrastructure Exporters
          </h2>
          <span className="text-xs text-muted-foreground">Host · Containers · Databases</span>
        </header>
        <Section
          title="Host & Container Metrics"
          description="Node Exporter (OS), cAdvisor (containers), and database exporters"
          tools={INFRA}
          accent="amber"
          icon={Server}
          staggerStart={6}
        />
      </section>

      {/* Platform Admin */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Admin
          </h2>
          <span className="text-xs text-muted-foreground">Identity · Gateway · Storage</span>
        </header>
        <Section
          title="Admin Interfaces"
          description="Identity, API gateway, and object storage management"
          tools={ADMIN}
          accent="rose"
          icon={ShieldCheck}
          staggerStart={10}
        />
      </section>
    </div>
  );
}
