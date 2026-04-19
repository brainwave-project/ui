import { FileText, FolderArchive, Upload, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useAuthStore } from '@/store/auth.store';

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value?: number | string;
  to: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
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
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-semibold">
          {greeting}{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's a quick look at your knowledge base.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Available Documents"
          value={available.data?.total}
          to="/documents"
        />
        <StatCard
          icon={FolderArchive}
          label="Archived"
          value={archived.data?.total}
          to="/documents"
        />
        <StatCard
          icon={Upload}
          label="Upload New"
          value="↑"
          to="/documents/upload"
        />
        <StatCard
          icon={User}
          label="Your Profile"
          value="→"
          to="/profile"
        />
      </div>

      {/* Quick tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Upload documents via the{' '}
            <Link to="/documents/upload" className="text-primary underline-offset-4 hover:underline">
              Upload
            </Link>{' '}
            page — they'll transition through <code className="rounded bg-muted px-1 text-xs">RECEIVED → PERSISTING → AVAILABLE</code> automatically.
          </p>
          <p>
            Once a document is <span className="font-medium text-foreground">AVAILABLE</span> you can view or archive it. Archived documents can be permanently deleted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
