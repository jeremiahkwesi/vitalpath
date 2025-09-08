// app/DietaryScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useActivity } from "../src/context/ActivityContext";
import { useAuth } from "../src/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeNutritionAlerts } from "../src/utils/nutritionAlerts";
import { getHealthAssistantResponse } from "../src/services/healthAI";

type WeekRow = {
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

const ProgressBar = React.memo(
  ({
    label,
    value,
    max,
    color,
  }: {
    label: string;
    value: number;
    max: number;
    color: string;
  }) => {
    const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: fonts.medium, marginBottom: 4 }}>
          {label}: {Math.round(value)} / {Math.round(max)}
        </Text>
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { width: `${pct}%`, backgroundColor: color }]}
          />
        </View>
      </View>
    );
  }
);

const Metric = React.memo(
  ({
    icon,
    label,
    value,
    colorText,
    colorMuted,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    colorText: string;
    colorMuted: string;
  }) => (
    <View style={styles.metric}>
      <Ionicons name={icon} size={22} color={colorText} />
      <Text style={[styles.metricValue, { color: colorText }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colorMuted }]}>{label}</Text>
    </View>
  )
);

const QuickAction = React.memo(
  ({
    icon,
    label,
    color,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity onPress={onPress} style={styles.action}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  )
);

export default function DietaryScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const { user, userProfile } = useAuth();
  const { todayActivity, getTodayProgress, addWater, updateSteps } = useActivity();

  const progress = useMemo(() => getTodayProgress(), [getTodayProgress]);

  const targets = useMemo(
    () => ({
      calories: userProfile?.dailyCalories || 2000,
      protein: userProfile?.macros?.protein || 150,
      carbs: userProfile?.macros?.carbs || 225,
      fat: userProfile?.macros?.fat || 67,
    }),
    [userProfile?.dailyCalories, userProfile?.macros]
  );

  const stats = useMemo(
    () => ({
      steps: todayActivity?.steps || 0,
      water: todayActivity?.waterIntake || 0,
      workouts: (todayActivity?.workouts || []).length,
      meals: (todayActivity?.meals || []).length,
    }),
    [todayActivity]
  );

  const handleAddWater = useCallback((amount: number) => addWater(amount), [addWater]);
  const handleAddSteps = useCallback(
    (delta: number) => updateSteps((todayActivity?.steps || 0) + delta),
    [updateSteps, todayActivity?.steps]
  );

  const navActions = useMemo(
    () => ({
      logMeal: () =>
        nav.navigate("Plan", {
          screen: "FoodSearch",
          params: { origin: "home" },
        }),
      editMeals: () =>
        nav.navigate("Plan", { screen: "MealsDiary", params: { origin: "home" } }),
      scan: () => nav.navigate("Scan"),
      planWeek: () =>
        nav.navigate("Plan", { screen: "Planner", params: { origin: "home" } }),
      startWorkout: () =>
        nav.navigate("Workouts", { screen: "WorkoutsHome" }),
      library: () =>
        nav.navigate("Plan", { screen: "Library", params: { origin: "home" } }),
      recipes: () =>
        nav.navigate("Plan", { screen: "Recipes", params: { origin: "home" } }),
      pantry: () =>
        nav.navigate("Plan", { screen: "Pantry", params: { origin: "home" } }),
      checkin: () =>
        nav.navigate("Plan", {
          screen: "WeeklyCheckIn",
          params: { origin: "home" },
        }),
    }),
    [nav]
  );

  // 7-day summary & streak
  const [week, setWeek] = useState<WeekRow[]>([]);
  const [streak, setStreak] = useState<number>(0);

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
        const days = lastNDates(7);
        const list: WeekRow[] = days.map((d) => {
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
        setWeek(list);

        let s = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (r.workouts > 0 || r.meals > 0) s += 1;
          else break;
        }
        setStreak(s);
      } catch {
        // ignore local read errors
      }
    })();
  }, [user?.uid, todayActivity?.workouts, todayActivity?.meals]);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const weekAvgCalories = avg(week.map((w) => w.calories));
  const weekAvgSteps = avg(week.map((w) => w.steps));
  const weekWorkouts = week.reduce((a, b) => a + b.workouts, 0);

  // Dietician alerts
  const dietMsgs = computeNutritionAlerts(
    userProfile || null,
    todayActivity || null
  );

  const fallback: string[] = [];
  const calRemainingRaw = targets.calories - (todayActivity?.totalCalories || 0);
  if (calRemainingRaw < 0) {
    fallback.push(
      `You’re over today by ${Math.abs(calRemainingRaw)} kcal. Consider a short walk (10–15 min) or lighter dinner.`
    );
  } else if (calRemainingRaw > 200) {
    fallback.push(
      `You still have ${calRemainingRaw} kcal. Add a high-protein snack if hungry.`
    );
  }
  if ((todayActivity?.macros?.protein || 0) < targets.protein * 0.7) {
    fallback.push(`Protein behind target. Add lean protein at your next meal.`);
  }
  if (weekWorkouts < 3) {
    fallback.push(
      `Aim for 3+ workouts this week. Use AI Routine to plan quickly.`
    );
  }
  if (!fallback.length) fallback.push("Great work today. Keep the streak alive!");
  const tips = (dietMsgs.length ? dietMsgs : fallback).slice(0, 3);

  // AI Quick Coach
  const [showCoach, setShowCoach] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMsgs, setAiMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const buildContext = () => {
    const macros = todayActivity?.macros || { protein: 0, carbs: 0, fat: 0 };
    const todayStats = {
      caloriesConsumed: todayActivity?.totalCalories || 0,
      caloriesRemaining: Math.max(0, targets.calories - (todayActivity?.totalCalories || 0)),
      steps: todayActivity?.steps || 0,
      waterIntake: todayActivity?.waterIntake || 0,
      mealsCount: (todayActivity?.meals || []).length,
      workoutsCount: (todayActivity?.workouts || []).length,
      macros,
    };
    return {
      name: userProfile?.name || "",
      age: userProfile?.age || undefined,
      weight: userProfile?.weight || undefined,
      height: userProfile?.height || undefined,
      gender: userProfile?.gender || undefined,
      goal: userProfile?.goal || undefined,
      dailyCalories: userProfile?.dailyCalories || undefined,
      macros: userProfile?.macros || undefined,
      healthConditions: userProfile?.healthConditions || [],
      todayStats,
    };
  };

  const askAI = async (msg: string) => {
    const text = msg.trim();
    if (!text) return;
    setAiBusy(true);
    try {
      setAiMsgs((s) => [...s, { role: "user", content: text }]);
      const reply = await getHealthAssistantResponse(text, buildContext(), aiMsgs);
      setAiMsgs((s) => [...s, { role: "assistant", content: reply }]);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Today</Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Nutrition
        </Text>
        <ProgressBar
          label="Calories (kcal)"
          value={progress.caloriesConsumed}
          max={targets.calories}
          color={theme.colors.primary}
        />
        <View style={styles.macrosRow}>
          <View style={styles.macroItem}>
            <ProgressBar
              label="Protein (g)"
              value={todayActivity?.macros?.protein || 0}
              max={targets.protein}
              color="#6C5CE7"
            />
          </View>
          <View style={styles.macroItem}>
            <ProgressBar
              label="Carbs (g)"
              value={todayActivity?.macros?.carbs || 0}
              max={targets.carbs}
              color="#00C853"
            />
          </View>
          <View style={styles.macroItem}>
            <ProgressBar
              label="Fat (g)"
              value={todayActivity?.macros?.fat || 0}
              max={targets.fat}
              color="#FF6B6B"
            />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Activity
        </Text>
        <View style={styles.metricsRow}>
          <Metric
            icon="walk-outline"
            label="Steps"
            value={String(stats.steps)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="water-outline"
            label="Water (ml)"
            value={String(stats.water)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="barbell-outline"
            label="Workouts"
            value={String(stats.workouts)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="restaurant-outline"
            label="Meals"
            value={String(stats.meals)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.quickAddTitle, { color: theme.colors.text }]}>
            Quick add
          </Text>
          <View style={styles.chipRow}>
            <QuickChip label="+250 ml water" onPress={() => handleAddWater(250)} />
            <QuickChip label="+500 ml water" onPress={() => handleAddWater(500)} />
            <QuickChip label="+500 steps" onPress={() => handleAddSteps(500)} />
            <QuickChip label="+1000 steps" onPress={() => handleAddSteps(1000)} />
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          This week
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Avg kcal: {weekAvgCalories} (target {targets.calories}) • Workouts:{" "}
          {weekWorkouts} • Avg steps: {weekAvgSteps}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Streak: {streak} day{streak === 1 ? "" : "s"}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Your dietician
        </Text>
        {tips.map((t, i) => (
          <Text
            key={i}
            style={{
              color: theme.colors.textMuted,
              marginTop: i ? 6 : 0,
            }}
          >
            • {t}
          </Text>
        ))}
        <TouchableOpacity
          onPress={() => setShowCoach(true)}
          style={[
            styles.smallBtn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              marginTop: 10,
              alignSelf: "flex-start",
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            Ask AI coach
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Quick actions
        </Text>
        <View style={styles.actionsGrid}>
          <QuickAction
            icon="add-circle-outline"
            color={theme.colors.primary}
            label="Log meal"
            onPress={navActions.logMeal}
          />
          <QuickAction
            icon="create-outline"
            color="#8E24AA"
            label="Edit meals"
            onPress={navActions.editMeals}
          />
          <QuickAction
            icon="scan-outline"
            color="#FF9500"
            label="Scan"
            onPress={navActions.scan}
          />
          <QuickAction
            icon="calendar-outline"
            color="#00C853"
            label="Plan week"
            onPress={navActions.planWeek}
          />
          <QuickAction
            icon="play-circle-outline"
            color="#2962FF"
            label="Start workout"
            onPress={navActions.startWorkout}
          />
          <QuickAction
            icon="library-outline"
            color="#7E57C2"
            label="Library"
            onPress={navActions.library}
          />
          <QuickAction
            icon="book-outline"
            color="#0097A7"
            label="Recipes"
            onPress={navActions.recipes}
          />
          <QuickAction
            icon="cube-outline"
            color="#455A64"
            label="Pantry"
            onPress={navActions.pantry}
          />
          <QuickAction
            icon="analytics-outline"
            color="#D81B60"
            label="Check‑in"
            onPress={navActions.checkin}
          />
        </View>
      </View>

      {showCoach && (
        <AIQuickCoachModal
          visible={showCoach}
          onClose={() => setShowCoach(false)}
          busy={aiBusy}
          messages={aiMsgs}
          onSend={askAI}
          input={aiInput}
          setInput={setAiInput}
        />
      )}
    </ScrollView>
  );
}

const QuickChip = React.memo(
  ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { theme } = useTheme();
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.chip,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface2,
          },
        ]}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, { color: theme.colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  }
);

function AIQuickCoachModal({
  visible,
  onClose,
  busy,
  messages,
  onSend,
  input,
  setInput,
}: {
  visible: boolean;
  onClose: () => void;
  busy: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
  onSend: (m: string) => void;
  input: string;
  setInput: (s: string) => void;
}) {
  const { theme } = useTheme();
  return !visible ? null : (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: 16,
          maxHeight: "88%",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: fonts.semiBold,
              fontSize: 18,
            }}
          >
            AI Coach
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text
              style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}
            >
              Close
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ maxHeight: "72%" }}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              Ask anything: “What should I eat next to hit my macros?”, “Low‑sodium
              dinner ideas?”, “Pre‑workout snack?”
            </Text>
          ) : (
            messages.map((m, i) => (
              <View
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  backgroundColor:
                    m.role === "user"
                      ? theme.colors.primary
                      : theme.colors.surface2,
                  borderRadius: 12,
                  padding: 10,
                  marginVertical: 4,
                  maxWidth: "88%",
                }}
              >
                <Text
                  style={{
                    color: m.role === "user" ? "#fff" : theme.colors.text,
                    fontFamily: fonts.regular,
                  }}
                >
                  {m.content}
                </Text>
              </View>
            ))
          )}
          {busy && (
            <View
              style={{
                padding: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput
            style={[
              styles.inputField,
              {
                flex: 1,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Type a question…"
            placeholderTextColor={theme.colors.textMuted}
            editable={!busy}
          />
          <TouchableOpacity
            onPress={() => {
              if (busy) return;
              const msg = input.trim();
              if (!msg) return;
              setInput("");
              onSend(msg);
            }}
            style={[
              styles.smallBtn,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
            disabled={busy}
          >
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 8 },
  progressContainer: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  progressBar: { height: "100%" },
  macrosRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  macroItem: { flex: 1 },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  metric: { alignItems: "center", flex: 1 },
  metricValue: { fontFamily: fonts.semiBold, marginTop: 4 },
  metricLabel: { fontSize: 12 },
  quickAddTitle: { fontFamily: fonts.semiBold, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontFamily: fonts.semiBold },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  action: {
    width: "30%",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  actionLabel: { fontFamily: fonts.semiBold },
  smallBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputField: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
  },
});