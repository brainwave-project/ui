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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Tool registry — update ports here if your .env.dev changes them
// ---------------------------------------------------------------------------
interface ObservabilityTool {
  id:          string;
  label:       string;
  description: string;
  url:         string;
  icon:        React.ElementType;
  badge:       string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const METRICS: ObservabilityTool[] = [
  {
    id:          'grafana',
    label:       'Grafana',
    description: 'Dashboards for metrics, logs, and traces (admin / admin)',
    url:         'http://localhost:3030',
    icon:        BarChart3,
    badge:       'Metrics · Logs · Traces',
  },
  {
    id:          'prometheus',
    label:       'Prometheus',
    description: 'Metrics store — query PromQL, inspect scrape targets & alerts',
    url:         'http://localhost:9090',
    icon:        Activity,
    badge:       'Metrics',
  },
  {
    id:          'alertmanager',
    label:       'Alertmanager',
    description: 'Alert routing, silences, and notification status',
    url:         'http://localhost:9093',
    icon:        Bell,
    badge:       'Alerts',
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
  },
  {
    id:          'otel-zpages',
    label:       'OTel Collector zPages',
    description: 'Live pipeline debug — running spans, exporter status, trace samples',
    url:         'http://localhost:5679/debug/servicez',
    icon:        Activity,
    badge:       'OTel Pipeline',
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
  },
  {
    id:          'node-exporter',
    label:       'Node Exporter',
    description: 'Host-level OS metrics — CPU, memory, disk, network',
    url:         'http://localhost:9100/metrics',
    icon:        Server,
    badge:       'Host',
  },
  {
    id:          'postgres-exporter',
    label:       'Postgres Exporter',
    description: 'PostgreSQL query stats, connection pool, and replication lag',
    url:         'http://localhost:9187/metrics',
    icon:        Database,
    badge:       'PostgreSQL',
  },
  {
    id:          'mongodb-exporter',
    label:       'MongoDB Exporter',
    description: 'MongoDB operation counters, replica set state, WiredTiger stats',
    url:         'http://localhost:9216/metrics',
    icon:        Database,
    badge:       'MongoDB',
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
  },
  {
    id:          'konga',
    label:       'Konga (Kong UI)',
    description: 'Visual management for Kong routes, plugins, and consumers',
    url:         'http://localhost:1337',
    icon:        Server,
    badge:       'API Gateway',
  },
  {
    id:          'minio',
    label:       'MinIO Console',
    description: 'Object storage browser — buckets, objects, and access policies',
    url:         'http://localhost:9001',
    icon:        Database,
    badge:       'Object Storage',
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ToolTile({ tool }: { tool: ObservabilityTool }) {
  const Icon = tool.icon;
  return (
    <Button
      variant="outline"
      asChild
      className="!flex h-auto w-full min-w-0 max-w-full items-start justify-start overflow-hidden border-2 p-0 text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-0 min-w-0 max-w-full gap-4 overflow-hidden whitespace-normal p-5 no-underline [word-break:break-word]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="min-w-0 break-words text-base font-semibold leading-tight">{tool.label}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          <Badge
            variant="secondary"
            className="inline-flex h-auto max-w-full min-w-0 flex-wrap items-center whitespace-normal rounded-md px-2 py-1 text-left text-xs font-normal leading-snug [word-break:break-word]"
          >
            {tool.badge}
          </Badge>
          <p className="break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {tool.description}
          </p>
        </div>
      </a>
    </Button>
  );
}

interface SectionProps {
  title:       string;
  description: string;
  tools:       ObservabilityTool[];
  /**
   * `single` — one tile per row (use inside narrow columns, e.g. three-pillar layout).
   * `wide` — multi-column when the section spans the full main width (viewport-based cols are OK).
   */
  toolColumns?: 'single' | 'wide';
}

function Section({ title, description, tools, toolColumns = 'wide' }: SectionProps) {
  const gridClass =
    toolColumns === 'single'
      ? 'grid grid-cols-1 gap-3'
      : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  return (
    <Card className="min-w-0">
      <CardHeader className="min-w-0 space-y-1 pb-4">
        <CardTitle className="break-words text-lg">{title}</CardTitle>
        <CardDescription className="break-words text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 pt-0">
        <div className={cn(gridClass, 'min-w-0 [&>*]:min-w-0')}>
          {tools.map((tool) => (
            <ToolTile key={tool.id} tool={tool} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ObservabilityPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Observability</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform governance — quick access to all monitoring, tracing, and admin tools.
          All links open in a new tab and connect to your local Docker stack.
        </p>
      </div>

      <Separator />

      {/* Three pillars */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Three Pillars of Observability
        </h2>
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <Section
            title="Metrics"
            description="Time-series data, dashboards, and SLO alerting"
            tools={METRICS}
            toolColumns="single"
          />
          <Section
            title="Logs"
            description="Structured log aggregation via Loki + Promtail"
            tools={LOGS}
            toolColumns="single"
          />
          <Section
            title="Traces"
            description="Distributed request tracing via OTel Collector + Tempo"
            tools={TRACES}
            toolColumns="single"
          />
        </div>
      </div>

      <Separator />

      {/* Infrastructure */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Infrastructure Exporters
        </h2>
        <Section
          title="Host & Container Metrics"
          description="Node Exporter (OS), cAdvisor (containers), and database exporters"
          tools={INFRA}
        />
      </div>

      <Separator />

      {/* Admin UIs */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Admin
        </h2>
        <Section
          title="Admin Interfaces"
          description="Identity, API gateway, and object storage management"
          tools={ADMIN}
        />
      </div>
    </div>
  );
}
