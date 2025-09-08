// app/DietaryScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
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

function Prog({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontFamily: fonts.medium, marginBottom: 4 }}>
        {label}: {Math.round(value)} / {Math.round(max)}
      </Text>
      <View
        style={{
          height: 10,
          borderRadius: 6,
          backgroundColor: "rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function Metric({
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
}) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Ionicons name={icon} size={22} color={colorText} />
      <Text
        style={{
          color: colorText,
          fontFamily: fonts.semiBold,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
      <Text style={{ color: colorMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: "30%",
        marginBottom: 12,
        alignItems: "center",
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={{ fontFamily: fonts.semiBold }}>{label}</Text>
    </TouchableOpacity>
  );
}

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

export default function DietaryScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const { user, userProfile } = useAuth();
  const { todayActivity, getTodayProgress, addWater, updateSteps } =
    useActivity();

  const [showCoach, setShowCoach] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMsgs, setAiMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const firstAI = useRef(true);

  const prog = useMemo(() => getTodayProgress(), [getTodayProgress]);

  const kcalTarget = userProfile?.dailyCalories || 2000;
  const pTarget = userProfile?.macros?.protein || 150;
  const cTarget = userProfile?.macros?.carbs || 225;
  const fTarget = userProfile?.macros?.fat || 67;

  const steps = todayActivity?.steps || 0;
  const water = todayActivity?.waterIntake || 0;
  const workouts = (todayActivity?.workouts || []).length;
  const meals = (todayActivity?.meals || []).length;

  // Build 7-day summary & streak
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
        for (const [k, v] of kv) {
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
      } catch {}
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
  const fallbackTips: string[] = [];
  if (prog.caloriesRemaining < 0) {
    fallbackTips.push(
      `You’re over today by ${Math.abs(
        prog.caloriesRemaining
      )} kcal. Consider a short walk (10–15 min) or lighter dinner.`
    );
  } else if (prog.caloriesRemaining > 200) {
    fallbackTips.push(
      `You still have ${prog.caloriesRemaining} kcal. Add a high-protein snack if hungry.`
    );
  }
  if ((todayActivity?.macros.protein || 0) < pTarget * 0.7) {
    fallbackTips.push(
      `Protein behind target. Add lean protein at your next meal.`
    );
  }
  if (weekWorkouts < 3) {
    fallbackTips.push(
      `Aim for 3+ workouts this week. Use AI Routine to plan quickly.`
    );
  }
  if (!fallbackTips.length)
    fallbackTips.push("Great work today. Keep the streak alive!");

  const tips = (dietMsgs.length ? dietMsgs : fallbackTips).slice(0, 3);

  // AI Quick Coach minimal
  const buildContext = () => {
    const macros = todayActivity?.macros || { protein: 0, carbs: 0, fat: 0 };
    const todayStats = {
      caloriesConsumed: todayActivity?.totalCalories || 0,
      caloriesRemaining: Math.max(
        0,
        (userProfile?.dailyCalories || 2000) - (todayActivity?.totalCalories || 0)
      ),
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
    if (!msg.trim()) return;
    setAiBusy(true);
    try {
      setAiMsgs((s) => [...s, { role: "user", content: msg }]);
      const reply = await getHealthAssistantResponse(
        msg,
        buildContext(),
        aiMsgs
      );
      setAiMsgs((s) => [...s, { role: "assistant", content: reply }]);
    } finally {
      setAiBusy(false);
    }
  };
  const openCoach = () => setShowCoach(true);

  // Quick controls
  const addWaterAmount = async (ml: number) => {
    await addWater(ml);
  };
  const addStepsAmount = async (n: number) => {
    await updateSteps((todayActivity?.steps || 0) + n);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Today</Text>

      {/* Nutrition */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.section, { color: theme.colors.text }]}>
          Nutrition
        </Text>
        <Prog
          label="Calories (kcal)"
          value={prog.caloriesConsumed}
          max={kcalTarget}
          color={theme.colors.primary}
        />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Prog
              label="Protein (g)"
              value={todayActivity?.macros?.protein || 0}
              max={pTarget}
              color="#6C5CE7"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Prog
              label="Carbs (g)"
              value={todayActivity?.macros?.carbs || 0}
              max={cTarget}
              color="#00C853"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Prog
              label="Fat (g)"
              value={todayActivity?.macros?.fat || 0}
              max={fTarget}
              color="#FF6B6B"
            />
          </View>
        </View>
      </View>

      {/* Activity + Quick controls */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.section, { color: theme.colors.text }]}>
          Activity
        </Text>
        <View style={styles.metricsRow}>
          <Metric
            icon="walk-outline"
            label="Steps"
            value={String(steps)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="water-outline"
            label="Water (ml)"
            value={String(water)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="barbell-outline"
            label="Workouts"
            value={String(workouts)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
          <Metric
            icon="restaurant-outline"
            label="Meals"
            value={String(meals)}
            colorText={theme.colors.text}
            colorMuted={theme.colors.textMuted}
          />
        </View>

        <View style={{ marginTop: 10, gap: 8 }}>
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            Quick add
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="+250 ml water" onPress={() => addWaterAmount(250)} />
            <Chip label="+500 ml water" onPress={() => addWaterAmount(500)} />
            <Chip label="+500 steps" onPress={() => addStepsAmount(500)} />
            <Chip label="+1000 steps" onPress={() => addStepsAmount(1000)} />
          </View>
        </View>
      </View>

      {/* This week */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.section, { color: theme.colors.text }]}>
          This week
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Avg kcal: {weekAvgCalories} (target {kcalTarget}) • Workouts:{" "}
          {weekWorkouts} • Avg steps: {weekAvgSteps}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Streak: {streak} day{streak === 1 ? "" : "s"}
        </Text>
      </View>

      {/* Dietician tips */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.section, { color: theme.colors.text }]}>
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
          onPress={openCoach}
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
          <Text
            style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
          >
            Ask AI coach
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.section, { color: theme.colors.text }]}>
          Quick actions
        </Text>
        <View style={styles.actions}>
          <Action
            icon="add-circle-outline"
            color={theme.colors.primary}
            label="Log meal"
            onPress={() =>
              nav.navigate("Plan", {
                screen: "FoodSearch",
                params: { origin: "home" },
              })
            }
          />
          <Action
            icon="create-outline"
            color="#8E24AA"
            label="Edit meals"
            onPress={() =>
              nav.navigate("Plan", {
                screen: "MealsDiary",
                params: { origin: "home" },
              })
            }
          />
          <Action
            icon="scan-outline"
            color="#FF9500"
            label="Scan"
            onPress={() => nav.navigate("Scan" as never)}
          />
          <Action
            icon="calendar-outline"
            color="#00C853"
            label="Plan week"
            onPress={() =>
              nav.navigate("Plan", { screen: "Planner", params: { origin: "home" } })
            }
          />
          <Action
            icon="play-circle-outline"
            color="#2962FF"
            label="Start workout"
            onPress={() =>
              nav.navigate("Workouts" as never, { screen: "WorkoutsHome" } as never)
            }
          />
          <Action
            icon="library-outline"
            color="#7E57C2"
            label="Library"
            onPress={() =>
              nav.navigate("Plan", {
                screen: "Library",
                params: { origin: "home" },
              })
            }
          />
          <Action
            icon="book-outline"
            color="#0097A7"
            label="Recipes"
            onPress={() =>
              nav.navigate("Plan", { screen: "Recipes", params: { origin: "home" } })
            }
          />
          <Action
            icon="cube-outline"
            color="#455A64"
            label="Pantry"
            onPress={() =>
              nav.navigate("Plan", { screen: "Pantry", params: { origin: "home" } })
            }
          />
          <Action
            icon="analytics-outline"
            color="#D81B60"
            label="Check‑in"
            onPress={() =>
              nav.navigate("Plan", {
                screen: "WeeklyCheckIn",
                params: { origin: "home" },
              })
            }
          />
        </View>
      </View>

      {/* AI Coach modal */}
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

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: theme.colors.surface2,
      }}
    >
      <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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
  return (
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
              Ask anything: “What should I eat next to hit my macros?”, “Low‑sodium dinner ideas?”, “Pre‑workout snack?”
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
              styles.input,
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
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
            disabled={busy}
          >
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  section: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 6 },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
  },
  smallBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});