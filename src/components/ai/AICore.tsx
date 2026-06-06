import { cn } from '@/lib/utils';

interface Props {
  /** Pixel size of the square core. */
  size?: number;
  className?: string;
  /** Render the emanating ripple rings (default true). */
  ripples?: boolean;
}

/**
 * AICore — the robotic, neural identity of Brainwave.
 *
 * A self-contained animated SVG "entity": counter-rotating orbital rings with
 * traveling electrons, a glowing neural core, and a robotic scanner-eye that
 * blinks and sweeps. Scales cleanly from a 24px favicon-sized mark to a giant
 * hero. Honors prefers-reduced-motion via the global CSS reset.
 */
export function AICore({ size = 96, className, ripples = true }: Props) {
  const spin     = { transformOrigin: 'center', transformBox: 'fill-box' as const };

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Emanating energy ripples */}
      {ripples && (
        <>
          <span className="absolute inset-0 rounded-full border border-neon/40 animate-ripple" />
          <span className="absolute inset-0 rounded-full border border-plasma/30 animate-ripple [animation-delay:1.2s]" />
        </>
      )}

      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="relative drop-glow"
        role="img"
        aria-label="Brainwave AI core"
      >
        <defs>
          <radialGradient id="ai-core" cx="50%" cy="42%" r="60%">
            <stop offset="0%"   stopColor="hsl(187 96% 80%)" />
            <stop offset="45%"  stopColor="hsl(187 96% 53%)" />
            <stop offset="100%" stopColor="hsl(258 90% 40%)" />
          </radialGradient>
          <linearGradient id="ai-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="hsl(187 96% 53%)" />
            <stop offset="100%" stopColor="hsl(268 90% 66%)" />
          </linearGradient>
          <filter id="ai-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer orbital ring + electron */}
        <g className="animate-spin-slow" style={spin}>
          <circle
            cx="50" cy="50" r="46"
            fill="none" stroke="url(#ai-ring)" strokeWidth="1.5"
            strokeDasharray="4 10" strokeLinecap="round" opacity="0.85"
          />
          <circle cx="50" cy="4" r="2.4" fill="hsl(187 96% 70%)" filter="url(#ai-glow)" />
        </g>

        {/* Middle ring, counter-rotating + electron */}
        <g className="animate-spin-slow-rev" style={spin}>
          <circle
            cx="50" cy="50" r="35"
            fill="none" stroke="hsl(268 90% 66%)" strokeWidth="1"
            strokeDasharray="2 7" opacity="0.7"
          />
          <circle cx="85" cy="50" r="2" fill="hsl(315 90% 70%)" filter="url(#ai-glow)" />
        </g>

        {/* Inner ring, faster */}
        <g className="animate-spin-med" style={spin}>
          <circle
            cx="50" cy="50" r="27"
            fill="none" stroke="hsl(187 96% 53% / 0.5)" strokeWidth="0.8"
            strokeDasharray="1 5"
          />
        </g>

        {/* Neural core */}
        <g className="animate-glow-pulse" style={spin}>
          <circle cx="50" cy="50" r="20" fill="url(#ai-core)" filter="url(#ai-glow)" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="hsl(187 96% 85% / 0.6)" strokeWidth="0.6" />
        </g>

        {/* Robotic scanner-eye / visor */}
        <g>
          <rect x="38" y="46" width="24" height="8" rx="4" fill="hsl(224 60% 6%)" opacity="0.92" />
          {/* blinking scan bar */}
          <g className="animate-blink" style={spin}>
            <rect x="40" y="48.5" width="20" height="3" rx="1.5" fill="hsl(187 96% 75%)" filter="url(#ai-glow)" />
            {/* sweeping pupil */}
            <circle cx="50" cy="50" r="1.8" fill="hsl(0 0% 100%)">
              <animate
                attributeName="cx"
                values="42;58;42"
                dur="3.2s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
              />
            </circle>
          </g>
        </g>
      </svg>
    </div>
  );
}
