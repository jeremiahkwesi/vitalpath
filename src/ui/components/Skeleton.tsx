// src/ui/components/Skeleton.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../ThemeProvider";

export function SkeletonBlock({ style }: { style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.block,
        { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={{ gap: 8, marginVertical: 8 }}>
      <SkeletonBlock style={{ height: 16, width: "70%", borderRadius: 8 }} />
      <SkeletonBlock style={{ height: 12, width: "50%", borderRadius: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderWidth: 1,
  },
});