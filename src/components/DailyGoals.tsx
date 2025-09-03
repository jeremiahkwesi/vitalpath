// src/components/DailyGoals.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/components/Card";
import { useTheme } from "../ui/ThemeProvider";
import { fonts } from "../constants/fonts";

export default function DailyGoals({
  steps,
  waterMl,
  proteinG,
  proteinTarget,
  calories,
  calorieTarget,
  stepTarget = 8000,
  waterTarget = 2000,
  sleepHours,
  workoutsCount,
  mealsCount,
}: {
  steps: number;
  waterMl: number;
  proteinG: number;
  proteinTarget: number;
  calories: number;
  calorieTarget: number;
  stepTarget?: number;
  waterTarget?: number;
  sleepHours: number;
  workoutsCount: number;
  mealsCount: number;
}) {
  const { theme } = useTheme();

  const items = [
    {
      label: "Calories",
      valueText: `${Math.round(calories)}/${Math.round(calorieTarget)}`,
      pct: pct(calories, calorieTarget),
      color: theme.colors.primary,
    },
    {
      label: "Protein (g)",
      valueText: `${Math.round(proteinG)}/${Math.round(proteinTarget)}`,
      pct: pct(proteinG, proteinTarget),
      color: "#FF6B6B",
    },
    {
      label: "Water (ml)",
      valueText: `${waterMl}/${waterTarget}`,
      pct: pct(waterMl, waterTarget),
      color: "#4ECDC4",
    },
    {
      label: "Steps",
      valueText: `${steps}/${stepTarget}`,
      pct: pct(steps, stepTarget),
      color: "#45B7D1",
    },
  ];

  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Today’s Goals
      </Text>
      {items.map((it) => (
        <View key={it.label} style={{ marginBottom: 10 }}>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {it.label}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>{it.valueText}</Text>
          </View>
          <View
            style={[
              styles.track,
              { backgroundColor: `${it.color}22` },
            ]}
          >
            <View
              style={[
                styles.fill,
                { width: `${it.pct}%`, backgroundColor: it.color },
              ]}
            />
          </View>
        </View>
      ))}
      <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
        Sleep: {sleepHours} h • Workouts: {workoutsCount} • Meals: {mealsCount}
      </Text>
    </Card>
  );
}

function pct(v: number, t: number) {
  if (!t || t <= 0) return 0;
  return Math.max(0, Math.min(100, (v / t) * 100));
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: { fontFamily: fonts.semiBold, fontSize: 12 },
  track: { height: 8, borderRadius: 6, overflow: "hidden" },
  fill: { height: 8, borderRadius: 6 },
});