import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuroraBackground } from '@/components/ai/AuroraBackground';
import { useUIStore } from '@/store/ui.store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':            'Dashboard',
  '/know-ops/ingestion':   'Know Ops · Ingestion',
  '/know-ops/retrieval':   'Know Ops · Retrieval Lab',
  '/know-ops/documents':   'Know Ops · Documents',
  '/know-ops/chat':        'Know Ops · Chat',
  '/evaluation/dataset':     'Evaluation · Dataset Construction',
  '/evaluation/data-lab':    'Evaluation · Data Lab',
  '/evaluation/retrieval':   'Evaluation · Retrieval',
  '/evaluation/experiments': 'Evaluation · Experiments',
  '/evaluation/stats':       'Evaluation · Stats Lab',
  '/evaluation/learn':       'Evaluation · Learning Path',
  '/activity':             'Activity',
  '/admin':                'Administration',
  '/governance':           'Platform Governance',
  '/observability':        'Observability',
  '/profile':              'Profile',
};

export function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { pathname } = useLocation();
  const title =
    PAGE_TITLES[pathname]
    ?? Object.entries(PAGE_TITLES).find(([path]) => path !== '/' && pathname.startsWith(`${path}/`))?.[1]
    ?? '';

  return (
    <div className="relative flex h-screen overflow-hidden">
      <AuroraBackground />
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">
          <div key={pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
