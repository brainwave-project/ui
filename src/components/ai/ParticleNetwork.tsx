import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0 = cyan, 1 = violet */
  hue: number;
}

const CYAN   = [56, 222, 245] as const;
const VIOLET = [163, 110, 246] as const;

function mix(t: number): [number, number, number] {
  return [
    Math.round(CYAN[0] + (VIOLET[0] - CYAN[0]) * t),
    Math.round(CYAN[1] + (VIOLET[1] - CYAN[1]) * t),
    Math.round(CYAN[2] + (VIOLET[2] - CYAN[2]) * t),
  ];
}

/**
 * Animated neural constellation: nodes drift slowly, lines connect nearby
 * nodes (fading with distance), and the cursor gently attracts and brightens
 * its neighbourhood. Canvas-based for smoothness; respects reduced-motion.
 */
export function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext('2d');
    if (!context) return;
    // Non-null typed aliases so the nested animation closures keep the narrowing.
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    const mouse = { x: -9999, y: -9999 };

    const LINK_DIST = 150;   // px: connect nodes within this range
    const MOUSE_DIST = 200;  // px: cursor influence radius

    function build() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width === 0 || height === 0) return; // box not laid out yet
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(120, Math.max(36, Math.floor((width * height) / 14000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 1,
        hue: Math.random(),
      }));
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;

          // cursor attraction
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const md = Math.hypot(mdx, mdy);
          if (md < MOUSE_DIST) {
            const f = (1 - md / MOUSE_DIST) * 0.015;
            p.vx += (mdx / (md || 1)) * f;
            p.vy += (mdy / (md || 1)) * f;
          }

          // gentle damping + speed cap
          p.vx = Math.max(-0.6, Math.min(0.6, p.vx * 0.995));
          p.vy = Math.max(-0.6, Math.min(0.6, p.vy * 0.995));

          // wrap around edges
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }
      }

      // links between nearby nodes
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const t = (a.hue + b.hue) / 2;
            const [r, g, bl] = mix(t);
            const alpha = (1 - dist / LINK_DIST) * 0.28;
            ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // bright links to cursor
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_DIST) {
          const alpha = (1 - dist / MOUSE_DIST) * 0.5;
          ctx.strokeStyle = `rgba(56,222,245,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // nodes
      for (const p of particles) {
        const [r, g, bl] = mix(p.hue);
        ctx.fillStyle = `rgba(${r},${g},${bl},0.9)`;
        ctx.shadowColor = `rgba(${r},${g},${bl},0.8)`;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (!reduce) raf = requestAnimationFrame(step);
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }
    function onResize() {
      build();
      if (reduce) step();
    }

    build();
    step();

    // Rebuild whenever the canvas box actually changes size (covers initial
    // layout settling, not just window resizes) so the buffer always matches.
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn('h-full w-full', className)}
    />
  );
}
