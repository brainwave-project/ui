import { useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, GitFork, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill } from '@/features/evaluation/components/EvalPrimitives';
import { fmtTime } from '@/features/evaluation/lib/evalStats';
import type { DatasetSummary } from '@/types/eval';

type VersionRow = DatasetSummary['versions'][number];

function latestFirst(versions: VersionRow[]) {
  return [...versions].sort((a, b) => b.version - a.version);
}

export function VersionPicker({
  versions, value, onChange, className, compact = false, align = 'start',
}: {
  versions: VersionRow[];
  value: number;
  onChange: (v: number) => void;
  className?: string;
  compact?: boolean;
  align?: 'start' | 'end';
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const ordered = useMemo(() => latestFirst(versions), [versions]);
  const latest = ordered[0]?.version;
  const selected = ordered.find((v) => v.version === value) ?? ordered[0];

  if (!selected) return null;

  const listWidth = Math.max(menuWidth ?? 0, compact ? 320 : menuWidth ?? 280);

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const w = triggerRef.current?.getBoundingClientRect().width;
          if (w) setMenuWidth(w);
        }
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Choose version"
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl border text-left transition-all',
            'border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 shadow-inner',
            'hover:border-neon/40 hover:bg-white/[0.04]',
            open && 'border-neon/45 shadow-glow-inner',
            compact ? 'h-9 gap-2 px-2 py-0' : 'px-3 py-2.5',
            className,
          )}
        >
          <VersionBadge version={selected.version} active latest={selected.version === latest} compact={compact} />
          <span className="min-w-0 flex-1">
            <span className={cn('flex items-center gap-1.5', compact ? 'overflow-hidden' : 'flex-wrap')}>
              <span className={cn('shrink-0 font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>v{selected.version}</span>
              {selected.version === latest && <Pill tone="neon">latest</Pill>}
              <StatusPill status={selected.status} />
            </span>
            {!compact && (
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {selected.items} items · {selected.documents} docs · {fmtTime(selected.status === 'frozen' ? selected.frozen_at : selected.created_at)}
              </span>
            )}
          </span>
          <ChevronDown className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-neon',
          )} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          style={{ width: listWidth, minWidth: listWidth }}
          className={cn(
            'z-[80] overflow-hidden rounded-xl border border-white/12 p-1 shadow-panel',
            'bg-[hsl(var(--popover)/0.96)] backdrop-blur-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Latest first
          </p>
          <div className="max-h-[min(22rem,70vh)] overflow-y-auto py-0.5">
            {ordered.map((v) => {
              const active = v.version === value;
              const isLatest = v.version === latest;
              return (
                <DropdownMenu.Item
                  key={v.version}
                  onSelect={() => onChange(v.version)}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 outline-none',
                    'data-[highlighted]:bg-neon/12',
                    active && 'bg-neon/10',
                  )}
                >
                  <VersionBadge version={v.version} active={active} latest={isLatest} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>v{v.version}</span>
                      {isLatest && <Pill tone="neon">latest</Pill>}
                      <StatusPill status={v.status} />
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {v.items} items · {v.documents} docs · {fmtTime(v.status === 'frozen' ? v.frozen_at : v.created_at)}
                    </span>
                    {v.parent_version != null && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <GitFork className="h-2.5 w-2.5" /> forked from v{v.parent_version}
                      </span>
                    )}
                  </span>
                  <Check className={cn('mt-1 h-3.5 w-3.5 shrink-0 text-neon', active ? 'opacity-100' : 'opacity-0')} />
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function VersionBadge({ version, active, latest, compact }: { version: number; active: boolean; latest: boolean; compact?: boolean }) {
  return (
    <span className={cn(
      'flex shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors',
      compact ? 'h-7 w-7' : 'mt-0.5 h-8 w-8',
      active ? 'bg-neon text-primary-foreground shadow-glow-sm' : latest ? 'bg-neon/15 text-neon' : 'bg-white/5 text-muted-foreground',
    )}>
      {version}
    </span>
  );
}

function StatusPill({ status }: { status: 'draft' | 'frozen' }) {
  return status === 'frozen'
    ? <Pill tone="info"><Lock className="h-2.5 w-2.5" />frozen</Pill>
    : <Pill tone="warn">draft</Pill>;
}
