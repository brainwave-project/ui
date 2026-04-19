import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { cn } from '@/lib/utils';
import type { Toast } from '@/store/ui.store';

const ICON: Record<Toast['type'], React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
};

const COLOR: Record<Toast['type'], string> = {
  success: 'border-green-500/30  bg-green-50  text-green-900  dark:bg-green-950  dark:text-green-200',
  error:   'border-destructive/30 bg-red-50   text-red-900    dark:bg-red-950    dark:text-red-200',
  info:    'border-blue-500/30   bg-blue-50   text-blue-900   dark:bg-blue-950   dark:text-blue-200',
};

export function Toaster() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
              'min-w-[280px] max-w-sm text-sm',
              'animate-in slide-in-from-bottom-4 fade-in duration-200',
              COLOR[t.type],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 rounded opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
