// src/ui/tokens.ts
export type ThemeColors = {
  appBg: string;
  surface: string;
  surface2: string;
  primary: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  overlay: string;
};

export type ThemeShadows = {
  sm: any;
  md: any;
  lg: any;
};

export type ThemeRadii = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type ThemeSpacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type AppTheme = {
  isDark: boolean;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  shadows: ThemeShadows;
};

const brand = {
  primary: "#6C5CE7", // indigo
  primaryDark: "#5548C5",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
};

const light: ThemeColors = {
  appBg: "#F7F7FB",
  surface: "#FFFFFF",
  surface2: "#F3F4F6",
  primary: brand.primary,
  text: "#0F172A",
  textMuted: "#6B7280",
  border: "rgba(2,6,23,0.12)",
  danger: brand.danger,
  warning: brand.warning,
  success: brand.success,
  info: brand.info,
  overlay: "rgba(0,0,0,0.35)",
};

const dark: ThemeColors = {
  appBg: "#0B1220",
  surface: "#121826",
  surface2: "#0F1524",
  primary: brand.primary,
  text: "#E5E7EB",
  textMuted: "#9CA3AF",
  border: "rgba(148,163,184,0.24)",
  danger: brand.danger,
  warning: brand.warning,
  success: brand.success,
  info: brand.info,
  overlay: "rgba(0,0,0,0.45)",
};

const spacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

const radii: ThemeRadii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
};

const shadows: ThemeShadows = {
  sm: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
};

export function createTheme(isDark: boolean): AppTheme {
  return {
    isDark,
    colors: isDark ? dark : light,
    spacing,
    radii,
    shadows,
  };
}