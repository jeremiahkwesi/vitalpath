// src/ui/ThemeProvider.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { ColorSchemeName, useColorScheme, Platform } from "react-native";
import {
  DefaultTheme as NavDefault,
  DarkTheme as NavDark,
  Theme as NavTheme,
} from "@react-navigation/native";
import { colors as base } from "../constants/colors";

type ThemeTokens = {
  isDark: boolean;
  colors: {
    primary: string;
    secondary: string;
    appBg: string;
    surface: string;
    surface2: string;
    card: string;
    border: string;
    text: string;
    textMuted: string;
    white: string;
    success: string;
    warning: string;
    danger: string;
  };
  radius: { sm: number; md: number; lg: number; xl: number; round: number };
  spacing: (n: number) => number;
  shadow: {
    sm: any;
    md: any;
    lg: any;
  };
  state: {
    pressOpacity: number;
  };
};

type ThemeContextType = {
  theme: ThemeTokens;
  setScheme: (scheme: "light" | "dark" | "system") => void;
  scheme: "light" | "dark" | "system";
  navTheme: NavTheme;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function makeTheme(isDark: boolean): ThemeTokens {
  const c = {
    primary: base.primary,
    secondary: base.secondary,
    appBg: isDark ? "#0B0B0F" : base.background,
    surface: isDark ? "#141418" : base.card,
    surface2: isDark ? "#1B1B21" : "#FAFAFD",
    card: base.card,
    border: isDark ? "rgba(255,255,255,0.08)" : base.border,
    text: isDark ? "#FFFFFF" : base.text,
    textMuted: isDark ? "rgba(255,255,255,0.7)" : base.gray,
    white: base.white,
    success: base.success,
    warning: base.warning,
    danger: base.danger,
  };

  return {
    isDark,
    colors: c,
    radius: { sm: 8, md: 12, lg: 16, xl: 24, round: 999 },
    spacing: (n: number) => n * 8,
    shadow: {
      sm:
        Platform.OS === "web"
          ? { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
          : {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 2,
              elevation: 1,
            },
      md:
        Platform.OS === "web"
          ? { boxShadow: "0 6px 16px rgba(0,0,0,0.12)" }
          : {
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 12,
              elevation: 3,
            },
      lg:
        Platform.OS === "web"
          ? { boxShadow: "0 10px 24px rgba(0,0,0,0.16)" }
          : {
              shadowColor: "#000",
              shadowOpacity: 0.16,
              shadowOffset: { width: 0, height: 10 },
              shadowRadius: 20,
              elevation: 6,
            },
    },
    state: { pressOpacity: 0.9 },
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() || ("light" as ColorSchemeName);
  const [scheme, setScheme] = useState<"light" | "dark" | "system">("system");

  const isDark = scheme === "system" ? system === "dark" : scheme === "dark";
  const theme = useMemo(() => makeTheme(isDark), [isDark]);

  // Start from React Navigation's default/dark theme (includes fonts) and override colors
  const baseNav = isDark ? NavDark : NavDefault;
  const navTheme: NavTheme = useMemo(
    () => ({
      ...baseNav,
      colors: {
        ...baseNav.colors,
        primary: theme.colors.primary,
        background: theme.colors.appBg,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
      // fonts property is preserved from baseNav (includes .medium)
    }),
    [baseNav, theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setScheme, scheme, navTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}