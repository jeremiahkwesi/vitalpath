import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { colors } from "../constants/colors";
import { fonts } from "../constants/fonts";

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

  const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${(value / max) * 100}%`, backgroundColor: color }]} />
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Last {days} Days Trends</Text>
      {data.map((r) => (
        <View key={r.date} style={styles.row}>
          <Text style={styles.dateLabel}>{new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}</Text>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Calories</Text>
            <Bar value={r.calories} max={maxCal} color={colors.primary} />
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Steps</Text>
            <Bar value={r.steps} max={maxSteps} color="#4ECDC4" />
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Water</Text>
            <Bar value={r.water} max={maxWater} color="#45B7D1" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 12 },
  row: { marginBottom: 10 },
  dateLabel: { fontSize: 12, color: colors.gray, marginBottom: 6, fontFamily: fonts.regular },
  metricCol: { marginBottom: 6 },
  metricLabel: { fontSize: 11, color: colors.gray, marginBottom: 4, fontFamily: fonts.regular },
  barTrack: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 6 },
});