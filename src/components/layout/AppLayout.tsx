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
  '/activity':             'Activity',
  '/admin':                'Administration',
  '/observability':        'Observability',
  '/llm-observability':    'LLM Observability',
  '/profile':              'Profile',
};

export function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? '';

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
