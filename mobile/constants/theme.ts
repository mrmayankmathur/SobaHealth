/**
 * Aivaan Design System
 * Premium, modern health app theme with dark mode support.
 * Colors inspired by medical/health aesthetics — calming teals + warm accents.
 */

export const Colors = {
  // Primary palette — Calming teal/cyan (trust, health, care)
  primary: '#0EA5A0',
  primaryLight: '#14B8B3',
  primaryDark: '#0D8E89',
  primaryMuted: 'rgba(14, 165, 160, 0.15)',

  // Accent — Warm amber for CTAs and highlights
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  accentMuted: 'rgba(245, 158, 11, 0.15)',

  // Urgency colors (symptom checker)
  emergency: '#EF4444',
  emergencyMuted: 'rgba(239, 68, 68, 0.15)',
  urgent: '#F97316',
  urgentMuted: 'rgba(249, 115, 22, 0.15)',
  safe: '#22C55E',
  safeMuted: 'rgba(34, 197, 94, 0.15)',

  // Dark theme (primary)
  background: '#0F1419',
  surface: '#1A1F2E',
  surfaceElevated: '#232A3B',
  surfaceBright: '#2D3548',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0F1419',

  // Borders
  border: '#2D3548',
  borderLight: '#384152',

  // Status
  online: '#22C55E',
  offline: '#EF4444',
  connecting: '#F59E0B',

  // Glassmorphism
  glass: 'rgba(26, 31, 46, 0.8)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
};
