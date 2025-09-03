// src/ui/components/Button.tsx
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "../ThemeProvider";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export default function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
}: Props) {
  const { theme } = useTheme();
  const bg =
    variant === "primary"
      ? theme.colors.primary
      : variant === "outline"
      ? "transparent"
      : "transparent";
  const border =
    variant === "outline" ? theme.colors.border : "transparent";
  const color =
    variant === "primary" ? "#fff" : theme.colors.text;

  const pad = size === "sm" ? 10 : size === "lg" ? 16 : 12;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border, paddingVertical: pad, opacity: pressed ? theme.state.pressOpacity : 1 },
        variant === "outline" && { borderWidth: 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.text, { color }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  text: { fontSize: 16, fontWeight: "600" },
});