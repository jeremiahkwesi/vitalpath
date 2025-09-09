import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { Card, SectionHeader, Pill, StatTile } from "../src/ui/components/UKit";
import { getHealthAssistantResponse } from "../src/services/healthAI";

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

export default function WeeklyReportScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const [period, setPeriod] = useState<7 | 14>(7);
  const [rows, setRows] = useState<Row[]>([]);
  const [report, setReport] = useState<string>("");

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

  const overview = useMemo(() => {
    return {
      avgKcal: avg(rows.map((r) => r.kcal)),
      avgProt: avg(rows.map((r) => r.protein)),
      avgCarb: avg(rows.map((r) => r.carbs)),
      avgFat: avg(rows.map((r) => r.fat)),
      avgSteps: avg(rows.map((r) => r.steps)),
      workouts: rows.reduce((a, b) => a + b.workouts, 0),
      meals: rows.reduce((a, b) => a + b.meals, 0),
      days: rows.length,
    };
  }, [rows]);

  const buildPrompt = () => {
    const {
      avgKcal,
      avgProt,
      avgCarb,
      avgFat,
      avgSteps,
      workouts,
      meals,
      days,
    } = overview;
    const goal = userProfile?.fitnessGoal || userProfile?.goal || "general health";
    const comp = userProfile?.bodyCompositionGoal || "maintain";
    return `Create a concise ${days}-day weekly fitness report for a user whose goals are: fitness=${goal}, body composition=${comp}.
Data summary:
- Avg calories: ${avgKcal} kcal/day
- Avg macros: P ${avgProt} g, C ${avgCarb} g, F ${avgFat} g
- Avg steps: ${avgSteps}/day
- Workouts completed: ${workouts}
- Meals logged: ${meals}

Write:
1) Highlights (bullets)
2) Nutrition notes (bullets)
3) Training notes (bullets)
4) Simple next-week plan (bullets)

Keep it brief and actionable. Consider any typical constraints for ${userProfile?.healthConditions?.join(", ") || "no special conditions"}.`;
  };

  const generate = async () => {
    const prompt = buildPrompt();
    try {
      const txt = await getHealthAssistantResponse(prompt, { user: "weekly" }, []);
      setReport(txt);
    } catch {
      setReport(
        "Could not generate AI report. Your weekly snapshot is still available above."
      );
    }
  };

  const shareReport = async () => {
    if (!report.trim()) return;
    try {
      await Share.share({ message: report });
    } catch {}
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <SectionHeader
        title="Weekly Report"
        subtitle="Overview and AI summary"
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
          </View>
        }
      />

      <Card>
        <SectionHeader title="Snapshot" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile value={`${overview.avgKcal}`} label="avg kcal" />
          <StatTile value={`${overview.avgSteps}`} label="avg steps" />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <StatTile value={`${overview.workouts}`} label="workouts" />
          <StatTile value={`${overview.meals}`} label="meals logged" />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Macros (daily avg)" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile value={`${overview.avgProt} g`} label="Protein" />
          <StatTile value={`${overview.avgCarb} g`} label="Carbs" />
          <StatTile value={`${overview.avgFat} g`} label="Fat" />
        </View>
      </Card>

      <Card>
        <SectionHeader
          title="AI weekly report"
          right={
            <View style={{ flexDirection: "row" }}>
              <Pill label="Generate" icon="flash-outline" onPress={generate} />
              <Pill label="Share" icon="share-outline" onPress={shareReport} />
            </View>
          }
        />
        <Text style={{ color: theme.colors.text, lineHeight: 20 }}>
          {report
            ? report
            : "Tap Generate to create a concise report. We’ll use your recent stats and goals."}
        </Text>
      </Card>
    </ScrollView>
  );
}