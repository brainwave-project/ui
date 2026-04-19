import { create } from 'zustand';

export interface Toast {
  id:      string;
  type:    'success' | 'error' | 'info';
  message: string;
}

interface UIState {
  sidebarOpen: boolean;
  toasts:      Toast[];

  toggleSidebar(): void;
  setSidebar(open: boolean): void;
  addToast(toast: Omit<Toast, 'id'>): void;
  removeToast(id: string): void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toasts:      [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar:    (open) => set({ sidebarOpen: open }),

  addToast(toast) {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    // Auto-dismiss after 4 s
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4_000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
