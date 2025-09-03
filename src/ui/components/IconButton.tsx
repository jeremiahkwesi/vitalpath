// src/ui/components/IconButton.tsx
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";

export default function IconButton({
  name,
  size = 20,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={theme.colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});