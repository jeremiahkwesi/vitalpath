// app/MealPlannerScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { generateMealPlanLocal } from "../src/services/aiPlans";
import { applyPlanWeekToPlanner } from "../src/utils/mealPlanner";

function startOfWeek(d = new Date()): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MealPlannerScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();

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

  const weekStart = useMemo(() => startOfWeek(new Date()), []);

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
      Alert.alert("Meal Planner", "Week plan applied to your planner.");
    } catch (e: any) {
      Alert.alert("Meal Planner", e?.message || "Failed to create plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        AI Meal Planner
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Generates a 7-day meal plan and applies it to your planner.
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
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
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["3", "4", "5"] as const).map((m) => {
            const active = mealsPerDay === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMealsPerDay(m)}
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surface2,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : theme.colors.text,
                    fontFamily: fonts.semiBold,
                  }}
                >
                  {m}
                </Text>
              </TouchableOpacity>
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
      </View>

      <TouchableOpacity
        onPress={generateWeek}
        disabled={busy}
        style={[
          styles.apply,
          { backgroundColor: theme.colors.primary, opacity: busy ? 0.7 : 1 },
        ]}
      >
        <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
          {busy ? "Working…" : "Generate 7-day plan"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
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
});