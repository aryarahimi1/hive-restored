// Color tokens — single source of truth.
// Mirrors src/client/game.tsx and src/client/index.css palette.
// All values are oklch() literals — Chromium 111+ (Remotion) supports them natively.

export const tokens = {
  bg: {
    cream: 'oklch(0.96 0.012 72)',
    creamBright: 'oklch(0.985 0.008 72)',
    creamAlt: 'oklch(0.95 0.018 72)',
    walnutDeep: 'oklch(0.18 0.035 58)',
    walnut: 'oklch(0.20 0.04 58)',
    walnutWarm: 'oklch(0.22 0.04 58)',
  },
  text: {
    ink: 'oklch(0.19 0.026 62)',
    muted: 'oklch(0.43 0.028 62)',
    softMuted: 'oklch(0.48 0.03 62)',
    onDark: 'oklch(0.97 0.008 72)',
    onDarkDim: 'oklch(0.83 0.02 72)',
    onDarkLabel: 'oklch(0.78 0.08 62)',
  },
  accent: {
    amber: 'oklch(0.58 0.17 39)',
    amberHot: 'oklch(0.52 0.18 39)',
    amberSoft: 'oklch(0.56 0.14 38)',
    kraft: 'oklch(0.48 0.09 42)',
  },
  danger: {
    red: 'oklch(0.55 0.18 28)',
    redSoft: 'oklch(0.72 0.12 32)',
  },
  ok: {
    green: 'oklch(0.58 0.14 148)',
  },
  border: {
    warm: 'oklch(0.86 0.032 68)',
    warmAlt: 'oklch(0.82 0.035 68)',
  },
} as const;

// Drop-shadow that matches the dashboard Panel chrome.
export const panelShadow = '0 24px 80px rgba(65, 45, 25, 0.12)';
