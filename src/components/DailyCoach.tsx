// src/components/DailyCoach.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../ui/ThemeProvider";
import { fonts } from "../constants/fonts";
import { Card } from "../ui/components/UKit";

export default function DailyCoach({
  name,
  caloriesRemaining,
  steps,
  waterMl,
  proteinPct,
}: {
  name?: string;
  caloriesRemaining: number;
  steps: number;
  waterMl: number;
  proteinPct: number;
}) {
  const { theme } = useTheme();

  const tip =
    caloriesRemaining > 0
      ? `You still have ${caloriesRemaining} kcal. Prioritize protein and fiber.`
      : `You've hit your calorie goal. Focus on water and steps to round off the day.`;

  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Hi {firstName(name)} 👋
      </Text>
      <Text style={{ color: theme.colors.text }}>{tip}</Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
        Steps: {steps} • Water: {waterMl} ml • Protein:{" "}
        {Math.round(proteinPct)}%
      </Text>
    </Card>
  );
}

function firstName(n?: string) {
  if (!n) return "there";
  return n.split(" ")[0];
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 4 },
});