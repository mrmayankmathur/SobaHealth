/**
 * Global Design System
 *
 * Color Palette (Health & Trust Focus)
 * Primary Action: #0066FF (Trust Blue)
 * Secondary Action: #E5F0FF (Light Blue)
 * Success/Health: #10B981 (Emerald Green)
 * Warning/Risk: #F59E0B (Amber) & #EF4444 (Red)
 * Background (Light): #F9FAFB (Off-white)
 * Surface (Light): #FFFFFF (White)
 * Text: #111827 (Dark Gray/Black) for primary, #6B7280 (Medium Gray)
 */

export const Colors = {
  primary: "#0066FF",
  secondary: "#E5F0FF",
  success: "#10B981",
  warning: "#F59E0B",
  emergency: "#EF4444",
  background: "#F9FAFB",
  surface: "#FFFFFF",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  online: "#10B981", // Offline/Local AI badge (Emerald Green)
  offline: "#EF4444",
  connecting: "#F59E0B",
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: "bold" as const },
  h2: { fontSize: 18, fontWeight: "600" as const },
  bodyPrimary: { fontSize: 16, fontWeight: "normal" as const },
  bodySecondary: { fontSize: 14, fontWeight: "normal" as const },
  micro: { fontSize: 12, fontWeight: "500" as const },
  nano: { fontSize: 10, fontWeight: "500" as const },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
};
