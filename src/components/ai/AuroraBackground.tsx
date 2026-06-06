import { cn } from '@/lib/utils';
import { ParticleNetwork } from './ParticleNetwork';

/**
 * Ambient futuristic backdrop: a slow-drifting neural constellation (animated
 * canvas) over a faint grid and soft colour wash. Fixed, behind everything,
 * pointer-events disabled.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      {/* Soft colour wash for depth */}
      <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-neon/15 blur-[100px] animate-aurora-drift" />
      <div className="absolute -right-40 top-1/4 h-[32rem] w-[32rem] rounded-full bg-plasma/15 blur-[100px] animate-aurora-drift [animation-delay:6s]" />

      {/* Neural grid */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Animated constellation */}
      <ParticleNetwork className="absolute inset-0" />

      {/* Scan line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/60 to-transparent animate-scan" />

      {/* Vignette keeps edges deep */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,hsl(var(--background))_100%)]" />
    </div>
  );
}
