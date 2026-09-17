import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, CheckCircle2, Circle, GraduationCap, PenLine, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { evalApi } from '@/api/eval.api';
import { useEvalMutation } from '@/features/evaluation/hooks/useEval';
import { EmptyState, Panel, Pill, PrincipalNote, TextArea } from '@/features/evaluation/components/EvalPrimitives';
import type { Mission } from '@/types/eval';

export function LearningPathPage() {
  const learning = useQuery({ queryKey: ['eval', 'learning'], queryFn: evalApi.learning });
  const data = learning.data;

  if (!data) {
    return (
      <EmptyState icon={GraduationCap} title={learning.isError ? 'Eval Lab API unreachable' : 'Loading…'} />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-neon/20 bg-neon/[0.04] p-4">
        <GraduationCap className="h-10 w-10 text-neon" />
        <div className="min-w-[240px] flex-1">
          <p className="font-display text-lg font-bold">{data.done} of {data.total} missions complete</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${Math.round(data.share * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3" /> <strong>verified</strong> missions are checked against lab state — you have to do the thing.
            <PenLine className="mx-1 ml-3 inline h-3 w-3" /> <strong>reflection</strong> missions need at least {data.min_reflection_chars} characters explaining what you saw and why.
          </p>
        </div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        {data.modules.map((module) => (
          <Panel key={module.id} title={module.title} icon={GraduationCap}
            actions={<Pill tone={module.done === module.missions.length ? 'good' : 'neutral'}>{module.done}/{module.missions.length}</Pill>}>
            <div className="space-y-2">
              {module.missions.map((m) => <MissionCard key={m.id} mission={m} minChars={data.min_reflection_chars} />)}
            </div>
          </Panel>
        ))}
      </div>

      <PrincipalNote title="How to use this path">
        Work the modules in order the first time: datasets you build in module 1 become the material for experiments in module 2,
        whose runs feed the metric and statistics missions. Revisit reflections after a few weeks and rewrite them — if the
        explanation got shorter and sharper, the understanding got deeper.
      </PrincipalNote>
    </div>
  );
}

function MissionCard({ mission: m, minChars }: { mission: Mission; minChars: number }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(m.status !== 'done');
  const [reflection, setReflection] = useState(m.reflection);
  const save = useEvalMutation(
    (done: boolean) => evalApi.updateMission(m.id, done, reflection),
    { success: 'Saved', invalidate: [['eval', 'learning']] },
  );
  const done = m.status === 'done';
  const enough = reflection.trim().length >= minChars;

  return (
    <div className={cn('rounded-xl border p-3', done ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-white/8 bg-card/30')}>
      <button className="flex w-full items-start gap-2.5 text-left" onClick={() => setOpen((o) => !o)}>
        {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{m.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Pill tone="neon">{m.concept}</Pill>
            <Pill tone={m.check === 'auto' ? 'info' : 'neutral'}>{m.check === 'auto' ? 'verified' : 'reflection'}</Pill>
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-white/5 pt-3 text-xs">
          <p className="text-muted-foreground"><strong className="text-foreground">Why:</strong> {m.why}</p>
          <ol className="list-inside list-decimal space-y-0.5 text-muted-foreground">
            {m.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          {m.check === 'auto' && (
            <p className={cn('flex items-start gap-1.5 rounded-md border p-2', done ? 'border-emerald-500/20 text-emerald-300' : 'border-white/10 text-muted-foreground')}>
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {done ? 'Verified: ' : 'Not yet — '}{m.evidence}
            </p>
          )}
          {m.check === 'reflection' && (
            <div className="space-y-1.5">
              <TextArea className="min-h-[90px] font-sans" value={reflection} onChange={(e) => setReflection(e.target.value)}
                placeholder="What did you observe? Why does it happen? What would you do differently in a real evaluation?" />
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-[10px]', enough ? 'text-emerald-400' : 'text-muted-foreground')}>{reflection.trim().length}/{minChars}</span>
                <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" disabled={save.isPending} onClick={() => save.mutate(false)}>
                  {done ? 'Reopen' : 'Save draft'}
                </Button>
                {!done && (
                  <Button size="sm" className="h-7 text-xs" disabled={!enough || save.isPending} onClick={() => save.mutate(true)}>
                    Mark complete
                  </Button>
                )}
              </div>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => navigate(m.tab)}>
            Open page <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
