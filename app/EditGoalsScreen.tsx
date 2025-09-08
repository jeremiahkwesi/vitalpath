// app/EditGoalsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import Select from "../src/ui/components/Select";
import { getUnits } from "../src/utils/userSettings";

export default function EditGoalsScreen() {
  const { theme } = useTheme();
  const { user, userProfile, updateUserProfile } = useAuth();

  const [goal, setGoal] = useState(userProfile?.goal || "maintain");
  const [targetWeeks, setTargetWeeks] = useState(
    userProfile?.targetTimelineWeeks || 12
  );
  const [goalWeight, setGoalWeight] = useState<string>(
    userProfile?.weight ? String(userProfile.weight) : ""
  );
  const [height, setHeight] = useState<string>(
    userProfile?.height ? String(userProfile.height) : ""
  );
  const [allergies, setAllergies] = useState<string>(
    (userProfile?.allergies || []).join(", ")
  );
  const [conditions, setConditions] = useState<string>(
    (userProfile?.healthConditions || []).join(", ")
  );
  const [units, setUnits] = useState<{ weight: "kg" | "lb"; distance: string }>(
    { weight: "kg", distance: "km" }
  );

  useEffect(() => {
    (async () => {
      if (user?.uid) setUnits(await getUnits(user.uid));
    })();
  }, [user?.uid]);

  useEffect(() => {
    if (!userProfile) return;
    setGoal(userProfile.goal || "maintain");
    setTargetWeeks(userProfile.targetTimelineWeeks || 12);
    setGoalWeight(userProfile.weight ? String(userProfile.weight) : "");
    setHeight(userProfile.height ? String(userProfile.height) : "");
    setAllergies((userProfile.allergies || []).join(", "));
    setConditions((userProfile.healthConditions || []).join(", "));
  }, [userProfile]);

  const parseNumber = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;

  const hasChanges = useMemo(() => {
    return true; // keep simple; we allow save anytime
  }, [goal, targetWeeks, goalWeight, height, allergies, conditions]);

  const save = async () => {
    try {
      let weightKg = parseNumber(goalWeight);
      if (units.weight === "lb") weightKg = lbToKg(weightKg);

      let heightM = parseNumber(height);
      if (heightM > 3 && heightM <= 300)
        heightM = Math.round((heightM / 100) * 100) / 100;

      const allergiesArr = allergies
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const condsArr = conditions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await updateUserProfile({
        goal: goal as any,
        targetTimelineWeeks: Math.max(1, parseInt(String(targetWeeks), 10)),
        weight: weightKg,
        height: heightM,
        allergies: allergiesArr,
        healthConditions: condsArr,
      });
      Alert.alert("Saved", "Goals updated.");
    } catch {
      Alert.alert("Error", "Failed to save goals.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Edit Goals</Text>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Select
          label="Body goal"
          value={goal}
          items={[
            { label: "Maintain", value: "maintain" },
            { label: "Lose weight", value: "lose_weight" },
            { label: "Lose fat", value: "lose_fat" },
            { label: "Gain weight", value: "gain_weight" },
            { label: "Gain muscle", value: "gain_muscle" },
          ]}
          onChange={(v) => setGoal(v as any)}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Target timeline (weeks)
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
          value={String(targetWeeks)}
          onChangeText={(t) =>
            setTargetWeeks(Math.max(1, parseInt(t || "1", 10)))
          }
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Goal weight ({units.weight})
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
          value={goalWeight}
          onChangeText={setGoalWeight}
          placeholder={units.weight === "lb" ? "e.g., 160" : "e.g., 72.5"}
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Height (m or cm)
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
          value={height}
          onChangeText={setHeight}
          placeholder="e.g., 1.75 or 175"
          placeholderTextColor={theme.colors.textMuted}
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
          value={allergies}
          onChangeText={setAllergies}
          placeholder="e.g., peanuts, lactose"
          placeholderTextColor={theme.colors.textMuted}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Health conditions (comma-separated)
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
          value={conditions}
          onChangeText={setConditions}
          placeholder="e.g., hypertension, diabetes"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      <TouchableOpacity
        onPress={save}
        disabled={!hasChanges}
        style={[
          styles.apply,
          {
            backgroundColor: theme.colors.primary,
            opacity: !hasChanges ? 0.7 : 1,
          },
        ]}
      >
        <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
          Save Goals
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