import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode:  ['class'],
  content:   ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center:  true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        /* AI identity accents */
        neon:   'hsl(var(--neon))',
        plasma: 'hsl(var(--plasma))',
        aurora: 'hsl(var(--aurora))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'glow-sm':     '0 0 12px hsl(var(--neon) / 0.45)',
        'glow':        '0 0 24px hsl(var(--neon) / 0.45)',
        'glow-lg':     '0 0 48px hsl(var(--neon) / 0.55)',
        'glow-plasma': '0 0 32px hsl(var(--plasma) / 0.55)',
        'glow-inner':  'inset 0 0 24px hsl(var(--neon) / 0.18)',
        'panel':       '0 8px 40px -8px hsl(var(--background) / 0.9), inset 0 1px 0 hsl(0 0% 100% / 0.04)',
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, hsl(var(--neon)), hsl(var(--plasma)))',
        'plasma-radial': 'radial-gradient(circle at 50% 50%, hsl(var(--plasma) / 0.35), transparent 70%)',
        'neon-radial':   'radial-gradient(circle at 50% 50%, hsl(var(--neon) / 0.35), transparent 70%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(1.25)' },
        },
        /* ---- AI / robotic identity ---- */
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to:   { transform: 'rotate(0deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6', filter: 'drop-shadow(0 0 6px hsl(var(--neon) / 0.6))' },
          '50%':      { opacity: '1',   filter: 'drop-shadow(0 0 18px hsl(var(--neon) / 0.95))' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translateY(2000%)', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'grid-pan': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '44px 44px' },
        },
        blink: {
          '0%, 92%, 100%': { transform: 'scaleY(1)' },
          '96%':           { transform: 'scaleY(0.1)' },
        },
        'aurora-drift': {
          '0%':   { transform: 'translate(0, 0) scale(1)' },
          '33%':  { transform: 'translate(6%, -8%) scale(1.15)' },
          '66%':  { transform: 'translate(-8%, 6%) scale(0.95)' },
          '100%': { transform: 'translate(0, 0) scale(1)' },
        },
        ripple: {
          '0%':   { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'text-flicker': {
          '0%, 100%':  { opacity: '1' },
          '41%':       { opacity: '1' },
          '42%':       { opacity: '0.5' },
          '43%':       { opacity: '1' },
          '88%':       { opacity: '1' },
          '89%':       { opacity: '0.6' },
          '90%':       { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in-up':     'fade-in-up 0.5s ease-out both',
        'fade-in':        'fade-in 0.6s ease-out both',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'pulse-dot':      'pulse-dot 2s ease-in-out infinite',
        float:            'float 6s ease-in-out infinite',
        'float-slow':     'float 9s ease-in-out infinite',
        'spin-slow':      'spin-slow 18s linear infinite',
        'spin-slow-rev':  'spin-reverse 24s linear infinite',
        'spin-med':       'spin-slow 9s linear infinite',
        'glow-pulse':     'glow-pulse 3s ease-in-out infinite',
        scan:             'scan 4s linear infinite',
        shimmer:          'shimmer 2.5s linear infinite',
        'grid-pan':       'grid-pan 3s linear infinite',
        blink:            'blink 5s ease-in-out infinite',
        'aurora-drift':   'aurora-drift 18s ease-in-out infinite',
        ripple:           'ripple 2.4s ease-out infinite',
        'text-flicker':   'text-flicker 6s linear infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
