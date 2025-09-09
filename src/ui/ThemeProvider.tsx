import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme,
  Theme as NavTheme,
} from "@react-navigation/native";
import { createTheme, AppTheme } from "./tokens";

type Scheme = "system" | "light" | "dark";

type Ctx = {
  theme: AppTheme;
  navTheme: NavTheme;
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
  isDark: boolean;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sys = useColorScheme();
  const [scheme, setScheme] = useState<Scheme>("system");

  const effective = scheme === "system" ? sys || "light" : scheme;
  const isDark = effective === "dark";
  const theme = useMemo(() => createTheme(isDark), [isDark]);

  // Start from React Navigation's default themes to preserve expected keys
  const baseNav = isDark ? NavDarkTheme : NavDefaultTheme;

  // Merge our colors and add fonts used by @react-navigation/bottom-tabs
  const navTheme = useMemo<NavTheme>(
    () =>
      ({
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
        // Add fonts for label rendering (BottomTabItem uses theme.fonts.medium)
        // Casting fontWeight as any to satisfy RN's TextStyle types across platforms
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" as any },
          medium: { fontFamily: "System", fontWeight: "500" as any },
          bold: { fontFamily: "System", fontWeight: "700" as any },
          heavy: { fontFamily: "System", fontWeight: "800" as any },
        },
      } as unknown as NavTheme),
    [baseNav, theme.colors, isDark]
  );

  const value = useMemo<Ctx>(
    () => ({ theme, navTheme, scheme, setScheme, isDark }),
    [theme, navTheme, scheme, isDark]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}