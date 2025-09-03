// src/ui/components/Segmented.tsx
import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "../ThemeProvider";

type Item = { label: string; value: string };
export default function Segmented({
  items,
  value,
  onChange,
}: {
  items: Item[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
      ]}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => onChange(it.value)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? theme.colors.primary : "transparent",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={{ color: active ? "#fff" : theme.colors.text }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    alignItems: "center",
  },
});