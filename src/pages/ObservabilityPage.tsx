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
    id:          'loki',
    label:       'Loki',
    description: 'Log aggregation API — query LogQL directly or via Grafana',
    url:         'http://localhost:3100/ready',
    icon:        Layers,
    badge:       'Logs',
  },
];

const TRACES: ObservabilityTool[] = [
  {
    id:          'tempo',
    label:       'Tempo',
    description: 'Trace backend API — explore via Grafana Explore → Tempo datasource',
    url:         'http://localhost:3200/ready',
    icon:        GitBranch,
    badge:       'Traces',
  },
  {
    id:          'otel-zpages',
    label:       'OTel Collector zPages',
    description: 'Live pipeline debug — running spans, exporter status, trace samples',
    url:         'http://localhost:55679',
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

function ToolButton({ tool }: { tool: ObservabilityTool }) {
  const Icon = tool.icon;
  return (
    <Button
      variant="outline"
      // Button defaults to `whitespace-nowrap` — override so the description
      // wraps instead of overflowing the card. items-start so the icon aligns
      // to the first line of a multi-line description.
      className="h-auto w-full items-start justify-start gap-3 whitespace-normal p-4 text-left"
      asChild
    >
      <a href={tool.url} target="_blank" rel="noopener noreferrer">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{tool.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            {tool.description}
          </p>
        </div>
        <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
          {tool.badge}
        </Badge>
      </a>
    </Button>
  );
}

interface SectionProps {
  title:       string;
  description: string;
  tools:       ObservabilityTool[];
}

function Section({ title, description, tools }: SectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {tools.map((tool) => (
            <ToolButton key={tool.id} tool={tool} />
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
        <div className="grid gap-4 lg:grid-cols-3">
          <Section
            title="Metrics"
            description="Time-series data, dashboards, and SLO alerting"
            tools={METRICS}
          />
          <Section
            title="Logs"
            description="Structured log aggregation via Loki + Promtail"
            tools={LOGS}
          />
          <Section
            title="Traces"
            description="Distributed request tracing via OTel Collector + Tempo"
            tools={TRACES}
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
