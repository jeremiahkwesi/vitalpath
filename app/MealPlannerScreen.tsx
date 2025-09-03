// app/MealPlannerScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { fonts } from "../src/constants/fonts";
import { useTheme } from "../src/ui/ThemeProvider";
import Card from "../src/ui/components/Card";
import PlanModal from "../src/components/PlanModal";
import {
  getPlanner,
  setPlannedMeal,
  clearDay,
  PlannedMeal,
  MealSlot,
} from "../src/utils/mealPlanner";
import { useNavigation } from "@react-navigation/native";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

const slots: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

function startOfWeek(d = new Date()) {
  const day = d.getDay();
  const offset = day;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatISO(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function MealPlannerScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const toast = useToast();
  const h = useHaptics();

  const { user } = useAuth();
  const { addMeal } = useActivity();

  const [store, setStore] = useState<Record<string, any>>({});
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [showPlan, setShowPlan] = useState(false);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const load = async () => {
    if (!user?.uid) return;
    const s = await getPlanner(user.uid);
    setStore(s);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, weekStart]);

  async function updatePlannedMeal(
    dateStr: string,
    slot: MealSlot,
    patch: Partial<PlannedMeal>
  ) {
    if (!user?.uid) return;
    const existing: PlannedMeal | undefined =
      store[dateStr]?.meals?.find((m: PlannedMeal) => m.slot === slot);

    const nextCalories =
      patch.calories != null ? patch.calories : existing?.calories || 0;

    // Auto-split macros whenever calories are updated/missing
    const autoProtein =
      Math.round(((patch.calories ?? existing?.calories ?? 0) * 0.25) / 4) || 0;
    const autoCarbs =
      Math.round(((patch.calories ?? existing?.calories ?? 0) * 0.5) / 4) || 0;
    const autoFat =
      Math.round(((patch.calories ?? existing?.calories ?? 0) * 0.25) / 9) || 0;

    const meal: PlannedMeal = {
      name:
        patch.name ??
        existing?.name ??
        `${slot[0].toUpperCase() + slot.slice(1)} meal`,
      calories: nextCalories,
      protein:
        patch.protein != null
          ? patch.protein
          : existing?.protein ?? autoProtein,
      carbs:
        patch.carbs != null ? patch.carbs : existing?.carbs ?? autoCarbs,
      fat: patch.fat != null ? patch.fat : existing?.fat ?? autoFat,
      slot,
      grams: patch.grams != null ? patch.grams : existing?.grams,
      components:
        patch.components != null ? patch.components : existing?.components,
    };

    await setPlannedMeal(user.uid, dateStr, meal);
    await load();
  }

  const copyToToday = async (dateStr: string) => {
    if (!user?.uid) return;
    const day = store[dateStr];
    if (!day || !day.meals?.length) {
      toast.info("Nothing planned for this day");
      return;
    }
    for (const m of day.meals) {
      await addMeal({
        name: m.name,
        calories: m.calories,
        macros: { protein: m.protein, carbs: m.carbs, fat: m.fat },
        micros: {},
        type: m.slot,
      });
    }
    h.impact("light");
    toast.success(`Copied ${day.meals.length} meal(s) to today`);
  };

  const clearThisDay = async (dateStr: string) => {
    if (!user?.uid) return;
    await clearDay(user.uid, dateStr);
    await load();
    h.impact("light");
    toast.info("Cleared this day");
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.appBg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Weekly Meal Planner
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: theme.colors.textMuted, maxWidth: 280 },
              ]}
            >
              Plan meals with portions in grams. Apply your AI plan to prefill.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowPlan(true)}
              style={[
                styles.planBtn,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text style={styles.planBtnText}>View AI Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => nav.navigate("History")}
              style={[
                styles.historyBtn,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.historyBtnText,
                  { color: theme.colors.text },
                ]}
              >
                History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Week nav */}
        <Card style={{ marginVertical: 12, paddingVertical: 8 }}>
          <View style={styles.weekRow}>
            <TouchableOpacity
              style={[
                styles.navBtn,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
              ]}
              onPress={() =>
                setWeekStart(
                  (s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7)
                )
              }
            >
              <Text style={[styles.navText, { color: theme.colors.primary }]}>
                ◀ Prev
              </Text>
            </TouchableOpacity>
            <Text style={[styles.weekLabel, { color: theme.colors.text }]}>
              {days[0].toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {days[6].toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Text>
            <TouchableOpacity
              style={[
                styles.navBtn,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
              ]}
              onPress={() =>
                setWeekStart(
                  (s) => new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7)
                )
              }
            >
              <Text style={[styles.navText, { color: theme.colors.primary }]}>
                Next ▶
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Days */}
        {days.map((d) => {
          const dateStr = formatISO(d);
          const planned = store[dateStr]?.meals || [];
          return (
            <Card key={dateStr} style={{ marginBottom: 12 }}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayTitle, { color: theme.colors.text }]}>
                  {d.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.copyBtn,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => copyToToday(dateStr)}
                  >
                    <Text style={styles.copyText}>Copy to Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.clearBtn,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => clearThisDay(dateStr)}
                  >
                    <Text style={[styles.clearText, { color: theme.colors.text }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {slots.map((slot) => {
                const found = planned.find((m: PlannedMeal) => m.slot === slot);
                const components = found?.components || [];
                return (
                  <View key={slot} style={styles.slotRow}>
                    <Text
                      style={[
                        styles.slotLabel,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {capitalize(slot)}
                    </Text>
                    <View style={styles.slotRight}>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          },
                        ]}
                        placeholder="Meal name"
                        placeholderTextColor={theme.colors.textMuted}
                        defaultValue={found?.name}
                        onEndEditing={(e) =>
                          updatePlannedMeal(dateStr, slot, {
                            name: e.nativeEvent.text || found?.name || "",
                          })
                        }
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            width: 90,
                            textAlign: "right",
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          },
                        ]}
                        keyboardType="numeric"
                        placeholder="kcal"
                        placeholderTextColor={theme.colors.textMuted}
                        defaultValue={found ? String(found.calories) : ""}
                        onEndEditing={(e) =>
                          updatePlannedMeal(dateStr, slot, {
                            calories: parseInt(e.nativeEvent.text || "0", 10),
                          })
                        }
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            width: 90,
                            textAlign: "right",
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          },
                        ]}
                        keyboardType="numeric"
                        placeholder="g"
                        placeholderTextColor={theme.colors.textMuted}
                        defaultValue={
                          found?.grams != null ? String(found.grams) : ""
                        }
                        onEndEditing={(e) =>
                          updatePlannedMeal(dateStr, slot, {
                            grams: Math.max(
                              0,
                              parseInt(e.nativeEvent.text || "0", 10)
                            ),
                          })
                        }
                      />
                    </View>

                    {!!components.length && (
                      <Text
                        style={[
                          styles.components,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Components:{" "}
                        {components
                          .map((c) => `${c.name} ${c.grams}g`)
                          .join(" • ")}
                      </Text>
                    )}
                  </View>
                );
              })}
            </Card>
          );
        })}

        <Text
          style={[
            styles.tip,
            { color: theme.colors.textMuted, marginTop: 8 },
          ]}
        >
          Calories auto-split to macros. Use Search/Favorites to log actual meals.
        </Text>
      </ScrollView>

      <PlanModal
        visible={showPlan}
        onClose={() => setShowPlan(false)}
        weekStartDate={weekStart}
      />
    </>
  );
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontFamily: fonts.bold },
  subtitle: { fontFamily: fonts.regular, marginTop: 4 },
  planBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  planBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyBtnText: { fontFamily: fonts.semiBold, fontSize: 12 },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  navText: { fontFamily: fonts.semiBold },
  weekLabel: { fontFamily: fonts.semiBold },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayTitle: { fontFamily: fonts.semiBold },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  copyText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearText: { fontFamily: fonts.semiBold, fontSize: 12 },
  slotRow: { flexDirection: "column", gap: 8, marginBottom: 10 },
  slotLabel: { width: 80, fontFamily: fonts.semiBold, fontSize: 12 },
  slotRight: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  components: { fontFamily: fonts.regular, fontSize: 12, marginLeft: 80 },
  tip: { fontFamily: fonts.regular, fontSize: 12 },
});