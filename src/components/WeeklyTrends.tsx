// src/components/WeeklyTrends.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { Card, SectionHeader } from "../ui/components/UKit";

type DaySummary = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  water: number;
};

function lastNDates(n: number): string[] {
  const arr: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    arr.unshift(d.toISOString().split("T")[0]);
  }
  return arr;
}

export default function WeeklyTrends({ days = 7 }: { days?: number }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState<DaySummary[]>([]);
  const dates = useMemo(() => lastNDates(days), [days]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const rows: DaySummary[] = [];
      for (const d of dates) {
        const id = `${user.uid}_${d}`;
        const ref = doc(db, "activities", id);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const a = snap.data() as any;
            rows.push({
              date: d,
              calories: a.totalCalories || 0,
              protein: a.macros?.protein || 0,
              carbs: a.macros?.carbs || 0,
              fat: a.macros?.fat || 0,
              steps: a.steps || 0,
              water: a.waterIntake || 0,
            });
          } else {
            rows.push({
              date: d,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              steps: 0,
              water: 0,
            });
          }
        } catch {
          rows.push({
            date: d,
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            steps: 0,
            water: 0,
          });
        }
      }
      setData(rows);
    })();
  }, [user, dates]);

  const maxCal = Math.max(1, ...data.map((r) => r.calories));
  const maxSteps = Math.max(1, ...data.map((r) => r.steps));
  const maxWater = Math.max(1, ...data.map((r) => r.water));

  const Bar = ({
    value,
    max,
    color,
  }: {
    value: number;
    max: number;
    color: string;
  }) => (
    <View
      style={[
        styles.barTrack,
        {
          backgroundColor: theme.colors.surface2,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.min(100, (value / max) * 100)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );

  return (
    <Card>
      <SectionHeader title={`Last ${days} days`} />
      {data.map((r) => (
        <View key={r.date} style={styles.row}>
          <Text
            style={[styles.dateLabel, { color: theme.colors.textMuted }]}
          >
            {new Date(r.date + "T00:00:00").toLocaleDateString(
              undefined,
              { weekday: "short" }
            )}
          </Text>
          <View style={styles.metricCol}>
            <Text
              style={[styles.metricLabel, { color: theme.colors.textMuted }]}
            >
              Calories
            </Text>
            <Bar
              value={r.calories}
              max={maxCal}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.metricCol}>
            <Text
              style={[styles.metricLabel, { color: theme.colors.textMuted }]}
            >
              Steps
            </Text>
            <Bar value={r.steps} max={maxSteps} color="#4ECDC4" />
          </View>
          <View style={styles.metricCol}>
            <Text
              style={[styles.metricLabel, { color: theme.colors.textMuted }]}
            >
              Water
            </Text>
            <Bar value={r.water} max={maxWater} color="#45B7D1" />
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 10 },
  dateLabel: { fontSize: 12, marginBottom: 6, fontFamily: fonts.regular },
  metricCol: { marginBottom: 6 },
  metricLabel: { fontSize: 11, marginBottom: 4, fontFamily: fonts.regular },
  barTrack: {
    height: 8,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
  },
  barFill: { height: 8, borderRadius: 6 },
});