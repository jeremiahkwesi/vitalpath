import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { applyPlanWeekToPlanner } from "../services/planner";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";
import { Card, SectionHeader } from "../ui/components/UKit";

type AIPlan = {
  targetCalories: number;
  macros: { protein: number; carbs: number; fat: number };
  micros?: {
    fiber?: number;
    sodium?: number;
    potassium?: number;
    vitaminC?: number;
    calcium?: number;
    iron?: number;
  };
  adjustedTimelineWeeks: number;
  weeklyPlan: {
    workouts: {
      day: string;
      location?: "home" | "gym";
      focus?: string;
      duration?: number;
      exercises?: {
        name: string;
        sets: number;
        reps: string;
        restSec: number;
        equipment?: string[];
        alt?: string;
      }[];
      blocks?: { name: string; type: string; duration: number }[];
    }[];
    meals: {
      day: string;
      items: {
        name: string;
        serving?: string;
        grams?: number;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        components?: { name: string; grams: number }[];
      }[];
    }[];
  };
  countryFoods?: string[];
  notes?: string;
};

export default function PlanModal({
  visible,
  onClose,
  weekStartDate,
}: {
  visible: boolean;
  onClose: () => void;
  weekStartDate: Date;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const { user, userProfile } = useAuth();
  const [plan, setPlan] = useState<AIPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const uid = user?.uid || "";

  const loadPlan = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const ref = doc(db, "users", uid, "plans", "current");
      const snap = await getDoc(ref);
      setPlan(snap.exists() ? (snap.data() as AIPlan) : null);
    } catch {
      setPlan(null);
      toast.error("Failed to load plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const regenerate = async () => {
    if (!uid || !userProfile) return;
    setLoading(true);
    try {
      const curate = httpsCallable(functions, "curateInitialPlan");
      const resp: any = await curate({
        profile: {
          name: userProfile.name,
          age: userProfile.age,
          weight: userProfile.weight,
          height: userProfile.height,
          gender: userProfile.gender,
          goal: userProfile.goal,
          activityLevel: userProfile.activityLevel,
          bodyType: userProfile.bodyType || "other",
          targetTimelineWeeks: userProfile.targetTimelineWeeks || 12,
          country: userProfile.country || "",
          dietaryPreferences: userProfile.dietaryPreferences || [],
          allergies: userProfile.allergies || [],
        },
      });
      const p = resp?.data?.plan;
      if (p) {
        setPlan(p);
        await setDoc(
          doc(db, "users", uid, "plans", "current"),
          { ...p, userId: uid, updatedAt: Date.now() },
          { merge: true }
        );
        h.impact("light");
        toast.success("Plan regenerated");
      } else {
        toast.error("Could not regenerate plan");
      }
    } catch {
      toast.error("Failed to regenerate plan");
    } finally {
      setLoading(false);
    }
  };

  const applyToPlanner = async () => {
    if (!uid || !plan) return;
    setApplying(true);
    try {
      await applyPlanWeekToPlanner(uid, weekStartDate, plan as any);
      h.success();
      toast.success("Applied to planner");
      onClose();
    } catch {
      toast.error("Failed to apply plan");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Your AI Plan
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={regenerate} disabled={loading}>
                <Text
                  style={[
                    styles.link,
                    { color: theme.colors.primary },
                    loading && { opacity: 0.7 },
                  ]}
                >
                  {loading ? "Working…" : "Regenerate"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.link, { color: theme.colors.text }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!plan ? (
            <Text style={{ color: theme.colors.textMuted }}>
              {loading ? "Loading plan…" : "No plan yet. Tap Regenerate."}
            </Text>
          ) : (
            <ScrollView
              style={{ maxHeight: "80%" }}
              showsVerticalScrollIndicator={false}
            >
              <Card>
                <SectionHeader title="Targets" />
                <Text style={[styles.line, { color: theme.colors.text }]}>
                  Calories: {Math.round(plan.targetCalories)} kcal
                </Text>
                <Text style={[styles.line, { color: theme.colors.text }]}>
                  Macros: P {Math.round(plan.macros.protein)}g • C{" "}
                  {Math.round(plan.macros.carbs)}g • F{" "}
                  {Math.round(plan.macros.fat)}g
                </Text>
                {!!plan.micros && (
                  <Text
                    style={{ color: theme.colors.textMuted, marginTop: 4 }}
                  >
                    Key micros (daily): fiber {plan.micros.fiber ?? 0}g, sodium{" "}
                    {plan.micros.sodium ?? 0}mg, K{" "}
                    {plan.micros.potassium ?? 0}mg, vit C{" "}
                    {plan.micros.vitaminC ?? 0}mg, Ca{" "}
                    {plan.micros.calcium ?? 0}mg, Fe{" "}
                    {plan.micros.iron ?? 0}mg
                  </Text>
                )}
                <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
                  Timeline: {plan.adjustedTimelineWeeks} weeks
                </Text>
              </Card>

              <Card>
                <SectionHeader title="Weekly Workouts (example)" />
                {plan.weeklyPlan.workouts.map((d, i) => (
                  <View key={`w-${i}`} style={{ marginBottom: 8 }}>
                    <Text
                      style={[styles.dayLabel, { color: theme.colors.text }]}
                    >
                      {d.day}
                      {!!d.location && ` • ${d.location}`}
                      {!!d.focus && ` • ${d.focus}`}
                      {!!d.duration && ` • ${d.duration} min`}
                    </Text>
                    {Array.isArray(d.exercises) && d.exercises.length > 0 ? (
                      d.exercises.map((ex, j) => (
                        <Text
                          key={`we-${j}`}
                          style={{ color: theme.colors.textMuted }}
                        >
                          • {ex.name} — {ex.sets} × {ex.reps}, rest {ex.restSec}
                          s
                          {ex.equipment?.length
                            ? ` (${ex.equipment.join(", ")})`
                            : ""}
                          {ex.alt ? ` • Alt: ${ex.alt}` : ""}
                        </Text>
                      ))
                    ) : (
                      (d.blocks || []).map((b, j) => (
                        <Text
                          key={`wb-${j}`}
                          style={{ color: theme.colors.textMuted }}
                        >
                          • {b.name} ({b.type}) — {b.duration} min
                        </Text>
                      ))
                    )}
                  </View>
                ))}
              </Card>

              <Card>
                <SectionHeader title="Weekly Meals (example)" />
                {plan.weeklyPlan.meals.map((d, i) => (
                  <View key={`m-${i}`} style={{ marginBottom: 8 }}>
                    <Text
                      style={[styles.dayLabel, { color: theme.colors.text }]}
                    >
                      {d.day}
                    </Text>
                    {d.items.map((m, j) => (
                      <View key={`mi-${j}`} style={{ marginBottom: 4 }}>
                        <Text style={{ color: theme.colors.text }}>
                          • {m.name}
                          {m.grams != null ? ` — ${m.grams} g` : ""}
                          {m.serving ? ` (${m.serving})` : ""}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted }}>
                          {Math.round(m.calories)} kcal (P{" "}
                          {Math.round(m.protein)} C {Math.round(m.carbs)} F{" "}
                          {Math.round(m.fat)})
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </Card>

              {!!plan.countryFoods?.length && (
                <Card>
                  <SectionHeader title="Common foods" />
                  <Text style={{ color: theme.colors.textMuted }}>
                    {plan.countryFoods.slice(0, 12).join(" • ")}
                  </Text>
                </Card>
              )}

              {!!plan.notes && (
                <Card>
                  <SectionHeader title="Notes" />
                  <Text style={{ color: theme.colors.textMuted }}>
                    {plan.notes}
                  </Text>
                </Card>
              )}

              <TouchableOpacity
                style={[
                  styles.applyBtn,
                  { backgroundColor: theme.colors.primary },
                  applying && { opacity: 0.7 },
                ]}
                onPress={applyToPlanner}
                disabled={applying}
              >
                <Text style={styles.applyText}>
                  {applying ? "Applying…" : "Apply this plan to Planner"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  link: { fontFamily: fonts.semiBold },
  dayLabel: { fontFamily: fonts.semiBold },
  line: { fontFamily: fonts.regular },
  applyBtn: {
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginTop: 4,
  },
  applyText: { color: "#fff", fontFamily: fonts.semiBold },
});