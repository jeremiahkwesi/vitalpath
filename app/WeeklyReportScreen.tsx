// app/WeeklyReportScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWeeklyReportNarrativeAI } from "../src/services/healthAI";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

type Day = {
  date: string;
  calories: number;
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
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState("");

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const keys = await AsyncStorage.getAllKeys();
        const my = keys.filter((k) => k.startsWith(`activity:${user.uid}:`));
        const kv = await AsyncStorage.multiGet(my);
        const map: Record<string, any> = {};
        for (const [k, v] of kv) {
          if (!v) continue;
          const data = JSON.parse(v);
          map[data.date] = data;
        }
        const list = lastNDates(7).map((d) => {
          const x = map[d] || {};
          return {
            date: d,
            calories: Number(x.totalCalories || 0),
            protein: Number(x.macros?.protein || 0),
            carbs: Number(x.macros?.carbs || 0),
            fat: Number(x.macros?.fat || 0),
            steps: Number(x.steps || 0),
            workouts: Array.isArray(x.workouts) ? x.workouts.length : 0,
            meals: Array.isArray(x.meals) ? x.meals.length : 0,
          };
        });
        setDays(list);
      } catch {}
    })();
  }, [user?.uid]);

  const totals = useMemo(() => {
    const sum = (k: keyof Day) => days.reduce((a, d) => a + (d[k] as any), 0);
    return {
      calories: sum("calories"),
      protein: sum("protein"),
      carbs: sum("carbs"),
      fat: sum("fat"),
      steps: sum("steps"),
      workouts: sum("workouts"),
      meals: sum("meals"),
    };
  }, [days]);

  const averages = useMemo(() => {
    const n = Math.max(1, days.length);
    const r: any = {};
    for (const k of ["calories", "protein", "carbs", "fat", "steps"] as const) {
      r[k] = Math.round((totals as any)[k] / n);
    }
    return r as {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      steps: number;
    };
  }, [days, totals]);

  const generate = async () => {
    setLoading(true);
    try {
      const text = await getWeeklyReportNarrativeAI(
        {
          days,
          totals,
          averages,
        },
        userProfile || undefined
      );
      setNarrative(text);
    } catch (e: any) {
      Alert.alert("AI", e?.message || "Failed to generate.");
    } finally {
      setLoading(false);
    }
  };

  const toHTML = () => {
    const rows = days
      .map(
        (d) =>
          `<tr><td>${d.date}</td><td>${d.calories}</td><td>P${d.protein}</td><td>C${d.carbs}</td><td>F${d.fat}</td><td>${d.steps}</td><td>${d.workouts}</td><td>${d.meals}</td></tr>`
      )
      .join("");
    const css = `
      body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen; padding: 16px;}
      h1{font-size: 20px;}
      table{width: 100%; border-collapse: collapse; margin-top: 10px;}
      th, td{border: 1px solid #ddd; padding: 6px; font-size: 12px;}
      th{background:#f4f4f4;}
      .section{margin-top:16px;}
    `;
    return `
      <html><head><style>${css}</style></head><body>
        <h1>Weekly Report</h1>
        <div class="section">
          <strong>Totals:</strong>
          <div>Calories: ${totals.calories} | Protein: ${totals.protein} | Carbs: ${totals.carbs} | Fat: ${totals.fat}</div>
          <div>Steps: ${totals.steps} | Workouts: ${totals.workouts} | Meals: ${totals.meals}</div>
          <strong>Averages:</strong>
          <div>Calories: ${averages.calories} | Protein: ${averages.protein} | Carbs: ${averages.carbs} | Fat: ${averages.fat} | Steps: ${averages.steps}</div>
        </div>
        <div class="section">
          <strong>AI Summary</strong>
          <div>${(narrative || "").replace(/\n/g, "<br/>")}</div>
        </div>
        <div class="section">
          <table>
            <thead><tr><th>Date</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Steps</th><th>WOs</th><th>Meals</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </body></html>
    `;
  };

  const exportPDF = async () => {
    try {
      const html = toHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Export", "Report generated. On web, check the dev console for URI.");
        console.log("PDF URI:", uri);
      }
    } catch (e: any) {
      Alert.alert("Export", e?.message || "Failed to export.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>AI Weekly Report</Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Generate a weekly summary with AI narrative and export as PDF.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sub, { color: theme.colors.text }]}>Summary</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Totals — kcal {totals.calories} • P{totals.protein} C{totals.carbs} F{totals.fat} • Steps {totals.steps} • WOs {totals.workouts} • Meals {totals.meals}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Averages — kcal {averages.calories} • P{averages.protein} C{averages.carbs} F{averages.fat} • Steps {averages.steps}
        </Text>
        <TouchableOpacity onPress={generate} style={[styles.btn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, marginTop: 8 }]} disabled={loading}>
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>{loading ? "Generating…" : "Generate AI summary"}</Text>
        </TouchableOpacity>
      </View>

      {!!narrative && (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.sub, { color: theme.colors.text }]}>AI Narrative</Text>
          <Text style={{ color: theme.colors.text }}>{narrative}</Text>
          <TouchableOpacity onPress={exportPDF} style={[styles.btn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, marginTop: 8 }]}>
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Export PDF</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  sub: { fontFamily: fonts.semiBold, marginBottom: 6 },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
});