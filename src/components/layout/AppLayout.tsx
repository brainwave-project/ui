import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '@/store/ui.store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/documents': 'Documents',
  '/profile':   'Profile',
};

export function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? '';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
