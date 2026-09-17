import { useMemo, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Database, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill } from '@/features/evaluation/components/EvalPrimitives';
import { VersionPicker } from '@/features/evaluation/components/construction/VersionPicker';
import type { DatasetSummary } from '@/types/eval';

type VersionRow = DatasetSummary['versions'][number];

function latestFirst<T extends { version: number }>(versions: T[]) {
  return [...versions].sort((a, b) => b.version - a.version);
}

/** Highest frozen version, else the newest version. */
export function preferredVersion(versions: VersionRow[]): number | undefined {
  const ordered = latestFirst(versions);
  return ordered.find((v) => v.status === 'frozen')?.version ?? ordered[0]?.version;
}

export function DatasetPicker({
  datasets, datasetId, version, onChange, className,
}: {
  datasets: DatasetSummary[];
  datasetId: string | null;
  version: number | null;
  onChange: (id: string, version: number) => void;
  className?: string;
}) {
  const selected = datasets.find((d) => d.id === datasetId);
  const resolvedVersion = version
    ?? (selected ? preferredVersion(selected.versions) : undefined)
    ?? null;

  return (
    <div className={cn('flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto', className)}>
      <DatasetMenu
        datasets={datasets}
        datasetId={datasetId}
        onChange={(id) => {
          const d = datasets.find((row) => row.id === id);
          const v = d ? preferredVersion(d.versions) : undefined;
          if (v == null) return;
          onChange(id, v);
        }}
      />
      {selected && resolvedVersion != null && (
        <VersionPicker
          compact
          align="end"
          className="w-[13.5rem]"
          versions={selected.versions}
          value={resolvedVersion}
          onChange={(v) => onChange(selected.id, v)}
        />
      )}
    </div>
  );
}

function DatasetMenu({
  datasets, datasetId, onChange,
}: {
  datasets: DatasetSummary[];
  datasetId: string | null;
  onChange: (id: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuWidth, setMenuWidth] = useState<number>();
  const selected = datasets.find((d) => d.id === datasetId);
  const searchable = datasets.length > 6;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter((d) => `${d.name} ${d.id} ${d.lang}`.toLowerCase().includes(q));
  }, [datasets, query]);

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const w = triggerRef.current?.getBoundingClientRect().width;
          if (w) setMenuWidth(w);
        } else {
          setQuery('');
        }
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Choose dataset"
          className={cn(
            'group flex h-9 w-full items-center gap-2 rounded-xl border px-2 text-left transition-all sm:w-[16rem]',
            'border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 shadow-inner',
            'hover:border-neon/40 hover:bg-white/[0.04]',
            open && 'border-neon/45 shadow-glow-inner',
          )}
        >
          <span className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            open ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-neon/15 text-neon',
          )}>
            <Database className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-xs font-medium text-foreground">{selected?.name ?? 'Select dataset'}</span>
              {selected && <Pill>{selected.lang}</Pill>}
            </span>
          </span>
          <ChevronDown className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180 text-neon',
          )} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          style={{ width: Math.max(menuWidth ?? 0, 320), minWidth: 320 }}
          className={cn(
            'z-[80] overflow-hidden rounded-xl border border-white/12 p-1 shadow-panel',
            'bg-[hsl(var(--popover)/0.96)] backdrop-blur-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          {searchable && (
            <div className="relative mb-1 px-0.5 pt-0.5" onKeyDown={(e) => e.stopPropagation()}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter datasets…"
                className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-neon/40"
              />
            </div>
          )}
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Datasets
          </p>
          <div className="max-h-[min(24rem,70vh)] overflow-y-auto py-0.5">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches</p>
            )}
            {filtered.map((d) => {
              const active = d.id === datasetId;
              const def = preferredVersion(d.versions);
              const defRow = d.versions.find((v) => v.version === def);
              return (
                <DropdownMenu.Item
                  key={d.id}
                  onSelect={() => onChange(d.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 outline-none',
                    'data-[highlighted]:bg-neon/12',
                    active && 'bg-neon/10',
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    active ? 'bg-neon text-primary-foreground shadow-glow-sm' : 'bg-neon/15 text-neon',
                  )}>
                    <Database className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('truncate text-sm font-medium', active ? 'text-neon' : 'text-foreground')}>{d.name}</span>
                      <Pill>{d.lang}</Pill>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {d.versions.length} version{d.versions.length === 1 ? '' : 's'}
                      {defRow ? ` · opens v${defRow.version} ${defRow.status}` : ''}
                    </span>
                  </span>
                  <Check className={cn('h-3.5 w-3.5 shrink-0 text-neon', active ? 'opacity-100' : 'opacity-0')} />
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
