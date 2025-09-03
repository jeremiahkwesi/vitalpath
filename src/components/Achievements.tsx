// src/components/Achievements.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import Card from "../ui/components/Card";

export default function Achievements({
  uid,
  newly = [],
}: {
  uid: string;
  newly?: string[];
}) {
  const { theme } = useTheme();
  if (!newly?.length) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        New Badges
      </Text>
      <View style={styles.row}>
        {newly.map((b, idx) => (
          <View
            key={`${b}-${idx}`}
            style={[
              styles.badge,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.text }]}>{b}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
        Great progress! Keep the streak going.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 12 },
});