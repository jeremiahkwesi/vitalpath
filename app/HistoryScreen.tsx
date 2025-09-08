// app/HistoryScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";

type Row = {
  date: string;
  steps: number;
  water: number;
  workouts: number;
  meals: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const keys = await AsyncStorage.getAllKeys();
        const mine = keys.filter((k) => k.startsWith(`activity:${user.uid}:`));
        const kv = await AsyncStorage.multiGet(mine);
        const list: Row[] = [];
        for (const [, v] of kv) {
          if (!v) continue;
          const data = JSON.parse(v);
          list.push({
            date: data.date,
            steps: Number(data.steps || 0),
            water: Number(data.waterIntake || 0),
            workouts: Array.isArray(data.workouts) ? data.workouts.length : 0,
            meals: Array.isArray(data.meals) ? data.meals.length : 0,
            calories: Number(data.totalCalories || 0),
            protein: Number(data.macros?.protein || 0),
            carbs: Number(data.macros?.carbs || 0),
            fat: Number(data.macros?.fat || 0),
          });
        }
        list.sort((a, b) => (a.date < b.date ? 1 : -1));
        setRows(list);
      } catch {}
    })();
  }, [user?.uid]);

  const last7 = useMemo(() => rows.slice(0, 7), [rows]);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const weekAvgKcal = avg(last7.map((r) => r.calories));
  const weekAvgSteps = avg(last7.map((r) => r.steps));
  const weekWorkouts = last7.reduce((a, b) => a + b.workouts, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>History</Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.section, { color: theme.colors.text }]}>Last 7 days</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Avg kcal: {weekAvgKcal} • Workouts: {weekWorkouts} • Avg steps: {weekAvgSteps}
        </Text>
      </View>

      {!rows.length ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>No history yet.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.date} style={[styles.item, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.date, { color: theme.colors.text }]}>{r.date}</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Steps: {r.steps} • Water: {r.water} ml • Workouts: {r.workouts} • Meals: {r.meals}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Calories: {r.calories} • P{r.protein} C{r.carbs} F{r.fat}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12 },
  section: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 6 },
  item: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10 },
  date: { fontFamily: fonts.semiBold, marginBottom: 4 },
});