// src/ui/components/Typography.tsx
import React from "react";
import { Text, TextProps } from "react-native";
import { useTheme } from "../ThemeProvider";

export function Title(props: TextProps) {
  const { theme } = useTheme();
  return <Text {...props} style={[{ color: theme.colors.text, fontSize: 22, fontWeight: "700" }, props.style]} />;
}
export function Subtitle(props: TextProps) {
  const { theme } = useTheme();
  return <Text {...props} style={[{ color: theme.colors.textMuted, fontSize: 14 }, props.style]} />;
}
export function Body(props: TextProps) {
  const { theme } = useTheme();
  return <Text {...props} style={[{ color: theme.colors.text, fontSize: 16 }, props.style]} />;
}