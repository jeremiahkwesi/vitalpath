import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { generateMealPlanLocal } from "../src/services/aiPlans";
import { applyPlanWeekToPlanner } from "../src/services/planner";
import { getPantryMealIdeasAI, PantryIdea } from "../src/services/healthAI";
import { listPantry } from "../src/services/pantry";
import Banner from "../src/components/Banner";
import {
  addItemToPlan,
  applyDayPlanToDiary,
  dateKey,
  DayPlan,
  getWeekPlan,
  MealType,
  newItemId,
  removeItemFromPlan,
  replaceMealItems,
  startOfWeek,
} from "../src/services/planner";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

type AddForm = { name: string; kcal?: string; p?: string; c?: string; f?: string };
const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function fmtRange(a: Date, b: Date) {
  const m = (d: Date) =>
    d.toLocaleString(undefined, { month: "short", day: "numeric" });
  return `${m(a)} — ${m(b)}`;
}

export default function MealPlannerScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();

  // AI planning params
  const [dailyCalories, setDailyCalories] = useState<string>(
    String(userProfile?.dailyCalories || 2200)
  );
  const [mealsPerDay, setMealsPerDay] = useState<"3" | "4" | "5">("3");
  const [dietPrefs, setDietPrefs] = useState<string>(
    (userProfile?.dietaryPreferences || []).join(", ")
  );
  const [allergies, setAllergies] = useState<string>(
    (userProfile?.allergies || []).join(", ")
  );
  const [busy, setBusy] = useState(false);
  const [busyPantry, setBusyPantry] = useState(false);

  // Manual planner week state
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const weekStart = useMemo(() => startOfWeek(anchorDate, 1), [anchorDate]);
  const weekDates = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const [weekPlans, setWeekPlans] = useState<Record<string, DayPlan>>({});
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [dayBusy, setDayBusy] = useState<string | null>(null);
  const [openAddKey, setOpenAddKey] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "",
    kcal: "",
    p: "",
    c: "",
    f: "",
  });

  const loadWeek = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingWeek(true);
    try {
      const data = await getWeekPlan(user.uid, weekStart);
      setWeekPlans(data);
    } catch {
      // ignore
    } finally {
      setLoadingWeek(false);
    }
  }, [user?.uid, weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  // Missing info banner (for better plans)
  const missingBits = useMemo(() => {
    const p = userProfile || ({} as any);
    const out: string[] = [];
    if (!p.height) out.push("height");
    if (!p.weight) out.push("weight");
    if (!p.country) out.push("country");
    if (!p.activityLevel) out.push("activity level");
    if (!p.fitnessGoal) out.push("fitness goal");
    return out;
  }, [userProfile]);

  // Helper: build a simple weekly plan from pantry ideas (heuristic)
  const buildWeekFromPantry = async (): Promise<any> => {
    const calories = Math.max(
      1200,
      Math.min(4500, parseInt(dailyCalories, 10) || 2200)
    );
    const mPerDay = (parseInt(mealsPerDay, 10) as 3 | 4 | 5) || 3;

    // Fetch pantry
    const pantry = user?.uid ? await listPantry(user.uid) : [];
    const pantryLite = pantry.map((x) => ({
      name: x.name,
      grams: x.grams,
      count: x.count,
    }));

    // Ask AI for ideas
    const ideas: PantryIdea[] = await getPantryMealIdeasAI(
      pantryLite,
      {
        caloriesRemaining: calories,
        macrosRemaining: {
          protein:
            userProfile?.macros?.protein || Math.round((calories * 0.3) / 4),
          carbs:
            userProfile?.macros?.carbs || Math.round((calories * 0.4) / 4),
          fat: userProfile?.macros?.fat || Math.round((calories * 0.3) / 9),
        },
        preferences: dietPrefs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      userProfile || undefined
    );

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    const week = dayNames.map((_, idx) => {
      const items = [];
      for (let i = 0; i < mPerDay; i++) {
        const pick = ideas[(idx + i) % Math.max(1, ideas.length)];
        const kcal = Math.round(
          pick.nutrition?.calories || calories / mPerDay
        );
        const p = Math.round(
          pick.nutrition?.protein || (calories * 0.3) / 4 / mPerDay
        );
        const c = Math.round(
          pick.nutrition?.carbs || (calories * 0.4) / 4 / mPerDay
        );
        const f = Math.round(
          pick.nutrition?.fat || (calories * 0.3) / 9 / mPerDay
        );
        items.push({
          name: pick.title,
          calories: kcal,
          protein: p,
          carbs: c,
          fat: f,
        });
      }
      return { items };
    });

    return { weeklyPlan: { meals: week } };
  };

  const generateWeek = async () => {
    if (!user?.uid) return Alert.alert("Sign in required");
    setBusy(true);
    try {
      const plan = await generateMealPlanLocal({
        dailyCalories: Math.max(
          1200,
          Math.min(4500, parseInt(dailyCalories, 10) || 2200)
        ),
        mealsPerDay: (parseInt(mealsPerDay, 10) as 3 | 4 | 5) || 3,
        preferences: dietPrefs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allergies: allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await applyPlanWeekToPlanner(user.uid, weekStart, plan as any);
      await loadWeek();
      Alert.alert("Meal Planner", "Week plan applied.");
    } catch (e: any) {
      Alert.alert("Meal Planner", e?.message || "Failed to create plan.");
    } finally {
      setBusy(false);
    }
  };

  const generateFromPantryWeek = async () => {
    if (!user?.uid) return Alert.alert("Sign in required");
    setBusyPantry(true);
    try {
      const plan = await buildWeekFromPantry();
      await applyPlanWeekToPlanner(user.uid, weekStart, plan as any);
      await loadWeek();
      Alert.alert("Meal Planner", "Pantry-based week plan applied.");
    } catch (e: any) {
      Alert.alert(
        "Meal Planner",
        e?.message || "Failed to create from pantry."
      );
    } finally {
      setBusyPantry(false);
    }
  };

  // Manual planner helpers
  const dayHeader = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const onAddItem = async (day: Date, meal: MealType, form: AddForm) => {
    if (!user?.uid) return;
    const name = form.name.trim();
    if (!name) {
      Alert.alert("Add item", "Please enter a name.");
      return;
    }
    const kcal = Math.max(0, Math.round(Number(form.kcal || "0") || 0));
    const protein = Math.max(0, Math.round(Number(form.p || "0") || 0));
    const carbs = Math.max(0, Math.round(Number(form.c || "0") || 0));
    const fat = Math.max(0, Math.round(Number(form.f || "0") || 0));
    const item = {
      id: newItemId(),
      name,
      source: "custom" as const,
      macros: { kcal, protein, carbs, fat },
    };
    const key = dateKey(day);
    try {
      await addItemToPlan(user.uid, key, meal, item);
      await loadWeek();
      setOpenAddKey(null);
      setAddForm({ name: "", kcal: "", p: "", c: "", f: "" });
    } catch {
      Alert.alert("Add item", "Failed to add item.");
    }
  };

  const onRemoveItem = async (day: Date, meal: MealType, itemId: string) => {
    if (!user?.uid) return;
    const key = dateKey(day);
    try {
      await removeItemFromPlan(user.uid, key, meal, itemId);
      await loadWeek();
    } catch {
      Alert.alert("Remove", "Failed to remove item.");
    }
  };

  const onApplyDay = async (day: Date) => {
    if (!user?.uid) return;
    setDayBusy(dateKey(day));
    try {
      await applyDayPlanToDiary(user.uid, dateKey(day));
      Alert.alert("Planner", "Applied to today's diary for that date.");
    } catch {
      Alert.alert("Planner", "Failed to apply to diary.");
    } finally {
      setDayBusy(null);
    }
  };

  const onFillDayFromPantry = async (day: Date, mPerDay: number) => {
    if (!user?.uid) return;
    setDayBusy(dateKey(day));
    try {
      const remaining =
        Math.max(
          1200,
          Math.min(
            4500,
            parseInt(dailyCalories, 10) || userProfile?.dailyCalories || 2200
          )
        ) || 2000;

      const pantry = await listPantry(user.uid);
      const pantryLite = pantry.map((x) => ({
        name: x.name,
        grams: x.grams,
        count: x.count,
      }));

      const ideas = await getPantryMealIdeasAI(
        pantryLite,
        {
          caloriesRemaining: remaining,
          macrosRemaining: {
            protein:
              userProfile?.macros?.protein ||
              Math.round((remaining * 0.3) / 4),
            carbs:
              userProfile?.macros?.carbs || Math.round((remaining * 0.4) / 4),
            fat:
              userProfile?.macros?.fat || Math.round((remaining * 0.3) / 9),
          },
        },
        userProfile || undefined
      );

      const chunks = MEALS.map((_, i) => {
        const pick = ideas[i % Math.max(1, ideas.length)] || null;
        return pick
          ? [
              {
                id: newItemId(),
                name: pick.title,
                source: "recipe" as const,
                macros: {
                  kcal:
                    pick.nutrition?.calories ||
                    Math.round(remaining / mPerDay),
                  protein:
                    pick.nutrition?.protein ||
                    Math.round((remaining * 0.3) / 4 / mPerDay),
                  carbs:
                    pick.nutrition?.carbs ||
                    Math.round((remaining * 0.4) / 4 / mPerDay),
                  fat:
                    pick.nutrition?.fat ||
                    Math.round((remaining * 0.3) / 9 / mPerDay),
                },
              },
            ]
          : [];
      });

      const key = dateKey(day);
      for (let i = 0; i < MEALS.length; i++) {
        await replaceMealItems(user.uid, key, MEALS[i], chunks[i]);
      }
      await loadWeek();
    } catch {
      Alert.alert("Planner", "Couldn't generate pantry-based ideas.");
    } finally {
      setDayBusy(null);
    }
  };

  const titleRange = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return fmtRange(weekStart, end);
  }, [weekStart]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="Meal Planner"
        subtitle="Create a 7‑day plan or plan manually"
      />

      {!!missingBits.length && (
        <Banner
          variant="info"
          title="Improve your plans"
          message={`Add ${missingBits
            .slice(0, 3)
            .join(", ")}${
            missingBits.length > 3 ? ` +${missingBits.length - 3} more` : ""
          } for more accurate planning.`}
          actionLabel="Complete profile"
          onAction={() =>
            Alert.alert(
              "Profile",
              "Open Profile → Complete Profile (Setup) to add missing details."
            )
          }
          style={{ marginBottom: 8 }}
        />
      )}

      {/* AI Planner */}
      <Card>
        <SectionHeader title="AI Planner" subtitle="Use preferences and goals" />
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Daily calories target
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          keyboardType="numeric"
          value={dailyCalories}
          onChangeText={setDailyCalories}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Meals per day
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["3", "4", "5"] as const).map((m) => {
            const active = mealsPerDay === m;
            return (
              <Pill
                key={m}
                label={`${m}`}
                selected={active}
                onPress={() => setMealsPerDay(m)}
              />
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.colors.text, marginTop: 8 }]}>
          Dietary preferences (comma-separated)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="e.g., high-protein, mediterranean"
          placeholderTextColor={theme.colors.textMuted}
          value={dietPrefs}
          onChangeText={setDietPrefs}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Allergies (comma-separated)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="e.g., peanuts, lactose"
          placeholderTextColor={theme.colors.textMuted}
          value={allergies}
          onChangeText={setAllergies}
        />

        <TouchableOpacity
          onPress={generateWeek}
          disabled={busy}
          style={[
            styles.apply,
            {
              backgroundColor: theme.colors.primary,
              opacity: busy ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
            {busy ? "Working…" : "Generate 7-day plan"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={generateFromPantryWeek}
          disabled={busyPantry}
          style={[
            styles.apply,
            {
              backgroundColor: "#7E57C2",
              opacity: busyPantry ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
            {busyPantry ? "Working…" : "Generate from Pantry (AI)"}
          </Text>
        </TouchableOpacity>
      </Card>

      {/* Manual Planner */}
      <Card>
        <SectionHeader
          title="Manual Planner"
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(anchorDate);
                  d.setDate(d.getDate() - 7);
                  setAnchorDate(d);
                }}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontFamily: fonts.semiBold,
                }}
              >
                {titleRange}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(anchorDate);
                  d.setDate(d.getDate() + 7);
                  setAnchorDate(d);
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>
          }
        />

        {loadingWeek ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          weekDates.map((d) => {
            const key = dateKey(d);
            const plan = weekPlans[key];
            return (
              <View
                key={key}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface2,
                  padding: 10,
                  marginTop: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: fonts.semiBold,
                    }}
                  >
                    {dayHeader(d)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() =>
                        onFillDayFromPantry(d, parseInt(mealsPerDay, 10) || 3)
                      }
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontFamily: fonts.semiBold,
                        }}
                      >
                        From Pantry (AI)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onApplyDay(d)}
                      disabled={dayBusy === key}
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                          opacity: dayBusy === key ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{ color: "#fff", fontFamily: fonts.semiBold }}
                      >
                        {dayBusy === key ? "Applying…" : "Apply to Diary"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginTop: 8, gap: 8 }}>
                  {MEALS.map((m) => {
                    const items = plan?.meals?.[m] || [];
                    const open = openAddKey === `${key}:${m}`;
                    return (
                      <View
                        key={`${key}-${m}`}
                        style={{
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.appBg,
                        }}
                      >
                        <View
                          style={{
                            padding: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontFamily: fonts.semiBold,
                              textTransform: "capitalize",
                            }}
                          >
                            {m}
                          </Text>
                          <TouchableOpacity
                            onPress={() =>
                              setOpenAddKey(open ? null : `${key}:${m}`)
                            }
                          >
                            <Ionicons
                              name={
                                open
                                  ? "remove-circle-outline"
                                  : "add-circle-outline"
                              }
                              size={22}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                        </View>

                        {!!items.length && (
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingBottom: 10,
                              gap: 6,
                            }}
                          >
                            {items.map((it) => (
                              <View
                                key={it.id}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: theme.colors.text,
                                      fontFamily: fonts.semiBold,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {it.name}
                                  </Text>
                                  {!!it.macros && (
                                    <Text
                                      style={{
                                        color: theme.colors.textMuted,
                                        fontSize: 12,
                                      }}
                                    >
                                      {[
                                        it.macros.kcal
                                          ? `${it.macros.kcal} kcal`
                                          : null,
                                        it.macros.protein
                                          ? `P ${it.macros.protein}g`
                                          : null,
                                        it.macros.carbs
                                          ? `C ${it.macros.carbs}g`
                                          : null,
                                        it.macros.fat
                                          ? `F ${it.macros.fat}g`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" • ")}
                                    </Text>
                                  )}
                                </View>
                                <TouchableOpacity
                                  onPress={() =>
                                    onRemoveItem(d, m, it.id as string)
                                  }
                                  style={{ padding: 6 }}
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={18}
                                    color={theme.colors.danger}
                                  />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        )}

                        {open && (
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingBottom: 10,
                              gap: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: theme.colors.textMuted,
                                fontSize: 12,
                              }}
                            >
                              Add custom item
                            </Text>
                            <TextInput
                              style={[
                                styles.input,
                                {
                                  backgroundColor: theme.colors.surface2,
                                  borderColor: theme.colors.border,
                                  color: theme.colors.text,
                                },
                              ]}
                              placeholder="Name (e.g., Greek yogurt + berries)"
                              placeholderTextColor={theme.colors.textMuted}
                              value={addForm.name}
                              onChangeText={(t) =>
                                setAddForm((s) => ({ ...s, name: t }))
                              }
                            />
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <SmallNumInput
                                label="kcal"
                                value={addForm.kcal}
                                onChange={(v) =>
                                  setAddForm((s) => ({ ...s, kcal: v }))
                                }
                              />
                              <SmallNumInput
                                label="P"
                                value={addForm.p}
                                onChange={(v) =>
                                  setAddForm((s) => ({ ...s, p: v }))
                                }
                              />
                              <SmallNumInput
                                label="C"
                                value={addForm.c}
                                onChange={(v) =>
                                  setAddForm((s) => ({ ...s, c: v }))
                                }
                              />
                              <SmallNumInput
                                label="F"
                                value={addForm.f}
                                onChange={(v) =>
                                  setAddForm((s) => ({ ...s, f: v }))
                                }
                              />
                            </View>
                            <TouchableOpacity
                              onPress={() => onAddItem(d, m, addForm)}
                              style={[
                                styles.apply,
                                {
                                  backgroundColor: theme.colors.primary,
                                  paddingVertical: 10,
                                },
                              ]}
                            >
                              <Text
                                style={{ color: "#fff", fontFamily: fonts.semiBold }}
                              >
                                Add
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

function SmallNumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: fonts.semiBold,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.border,
            color: theme.colors.text,
            paddingVertical: 8,
          },
        ]}
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  apply: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});