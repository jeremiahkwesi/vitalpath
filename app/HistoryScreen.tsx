import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { Card, SectionHeader, Pill, StatTile } from "../src/ui/components/UKit";

type Row = {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  workouts: number;
  meals: number;
};

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().split("T")[0]);
  }
  return out.reverse();
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const keys = await AsyncStorage.getAllKeys();
        const my = keys.filter((k) => k.startsWith(`activity:${user.uid}:`));
        const kv = await AsyncStorage.multiGet(my);
        const map: Record<string, any> = {};
        for (const [, v] of kv) {
          if (!v) continue;
          const data = JSON.parse(v);
          map[data.date] = data;
        }
        const days = lastNDates(period);
        const list: Row[] = days.map((d) => {
          const x = map[d] || {};
          return {
            date: d,
            kcal: Number(x.totalCalories || 0),
            protein: Number(x.macros?.protein || 0),
            carbs: Number(x.macros?.carbs || 0),
            fat: Number(x.macros?.fat || 0),
            steps: Number(x.steps || 0),
            workouts: Array.isArray(x.workouts) ? x.workouts.length : 0,
            meals: Array.isArray(x.meals) ? x.meals.length : 0,
          };
        });
        setRows(list);
      } catch {}
    })();
  }, [user?.uid, period]);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const aKcal = avg(rows.map((r) => r.kcal));
  const aProt = avg(rows.map((r) => r.protein));
  const aCarb = avg(rows.map((r) => r.carbs));
  const aFat = avg(rows.map((r) => r.fat));
  const aSteps = avg(rows.map((r) => r.steps));
  const totWorkouts = rows.reduce((a, b) => a + b.workouts, 0);
  const mealsLogged = rows.reduce((a, b) => a + b.meals, 0);

  const bestStreak = useMemo(() => {
    let best = 0;
    let run = 0;
    for (const r of rows) {
      if (r.workouts > 0 || r.meals > 0) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    return best;
  }, [rows]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <SectionHeader
        title="History"
        subtitle="Trends across your recent activity"
        right={
          <View style={{ flexDirection: "row" }}>
            <Pill
              label="7d"
              selected={period === 7}
              onPress={() => setPeriod(7)}
            />
            <Pill
              label="14d"
              selected={period === 14}
              onPress={() => setPeriod(14)}
            />
            <Pill
              label="30d"
              selected={period === 30}
              onPress={() => setPeriod(30)}
            />
          </View>
        }
      />

      <Card>
        <SectionHeader title="Overview" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile icon="flame-outline" value={`${aKcal}`} label="avg kcal" />
          <StatTile icon="barbell-outline" value={`${totWorkouts}`} label="workouts" />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <StatTile icon="walk-outline" value={`${aSteps}`} label="avg steps" />
          <StatTile icon="restaurant-outline" value={`${mealsLogged}`} label="meals logged" />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Macros (daily averages)" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile value={`${aProt} g`} label="Protein" />
          <StatTile value={`${aCarb} g`} label="Carbs" />
          <StatTile value={`${aFat} g`} label="Fat" />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Best streak" />
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: fonts.semiBold,
            fontSize: 18,
          }}
        >
          {bestStreak} day{bestStreak === 1 ? "" : "s"}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Counted as days with at least one workout or one meal logged.
        </Text>
      </Card>
    </ScrollView>
  );
}