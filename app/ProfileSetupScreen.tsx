// app/ProfileSetupScreen.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { httpsCallable } from "firebase/functions";
import { doc, setDoc } from "firebase/firestore";
import { useRoute } from "@react-navigation/native";

import { useAuth } from "../src/context/AuthContext";
import { fonts } from "../src/constants/fonts";
import { db, functions } from "../src/config/firebase";
import { useTheme } from "../src/ui/ThemeProvider";
import Card from "../src/ui/components/Card";
import Select from "../src/ui/components/Select";

const GOALS = [
  { label: "Maintain Weight", value: "maintain" },
  { label: "Lose Weight", value: "lose_weight" },
  { label: "Gain Weight", value: "gain_weight" },
  { label: "Gain Muscle", value: "gain_muscle" },
  { label: "Lose Fat", value: "lose_fat" },
] as const;

const ACTIVITIES = ["sedentary", "light", "moderate", "active", "very_active"] as const;

const BODY_TYPES = [
  { label: "Ectomorph (lean, hard to gain)", value: "ectomorph" },
  { label: "Mesomorph (athletic)", value: "mesomorph" },
  { label: "Endomorph (easier to gain)", value: "endomorph" },
  { label: "Other/Not sure", value: "other" },
] as const;

type GoalType = "lose_weight" | "gain_weight" | "maintain" | "gain_muscle" | "lose_fat";
type GenderType = "male" | "female";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type BodyType = "ectomorph" | "mesomorph" | "endomorph" | "other";

const activityFactorMap: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function adjustByBodyType(baseCalories: number, goal: GoalType, bodyType: BodyType): number {
  if (bodyType === "ectomorph" && (goal === "gain_weight" || goal === "gain_muscle")) {
    return Math.round(baseCalories * 1.07);
  }
  if (bodyType === "endomorph" && (goal === "lose_weight" || goal === "lose_fat")) {
    return Math.round(baseCalories * 0.93);
  }
  return Math.round(baseCalories);
}

function estimateCaloriesAndMacros(
  weight: number,
  height: number,
  age: number,
  gender: GenderType,
  goal: GoalType,
  activityLevel: ActivityLevel,
  bodyType: BodyType
) {
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * (height * 100) - 5 * age + 5
      : 10 * weight + 6.25 * (height * 100) - 5 * age - 161;

  const activityFactor = activityFactorMap[activityLevel] ?? 1.55;
  let calories = bmr * activityFactor;

  switch (goal) {
    case "lose_weight":
    case "lose_fat":
      calories *= 0.8;
      break;
    case "gain_weight":
    case "gain_muscle":
      calories *= 1.2;
      break;
    default:
      break;
  }

  calories = adjustByBodyType(calories, goal, bodyType);

  let proteinRatio = 0.25;
  let carbRatio = 0.45;
  let fatRatio = 0.3;

  if (goal === "gain_muscle" || goal === "lose_fat") {
    proteinRatio = 0.35;
    carbRatio = 0.35;
    fatRatio = 0.3;
  } else if (goal === "lose_weight") {
    proteinRatio = 0.3;
    carbRatio = 0.35;
    fatRatio = 0.35;
  }

  if (bodyType === "ectomorph") {
    carbRatio += 0.05;
    fatRatio -= 0.05;
  } else if (bodyType === "endomorph") {
    proteinRatio += 0.05;
    carbRatio -= 0.05;
  }

  const protein = (calories * proteinRatio) / 4;
  const carbs = (calories * carbRatio) / 4;
  const fat = (calories * fatRatio) / 9;

  return {
    calories: Math.round(calories),
    macros: {
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    },
  };
}

export default function ProfileSetupScreen() {
  const route = useRoute<any>();
  const initialStepParam = route.params?.initialStep as number | undefined;

  const { theme } = useTheme();
  const { updateUserProfile, user, userProfile } = useAuth();

  const [name, setName] = useState(userProfile?.name || "");
  const [age, setAge] = useState(userProfile?.age != null && userProfile.age > 0 ? String(userProfile.age) : "");
  const [weight, setWeight] = useState(userProfile?.weight ? String(userProfile.weight) : "");
  const [height, setHeight] = useState(userProfile?.height ? String(userProfile.height) : "");
  const [gender, setGender] = useState<GenderType>(userProfile?.gender || "male");
  const [goal, setGoal] = useState<GoalType>(userProfile?.goal || "maintain");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(userProfile?.activityLevel || "moderate");
  const [bodyType, setBodyType] = useState<BodyType>(userProfile?.bodyType || "other");
  const [country, setCountry] = useState(userProfile?.country || "");
  const [timelineWeeks, setTimelineWeeks] = useState(userProfile?.targetTimelineWeeks || 12);
  const [dietaryPreferences, setDietaryPreferences] = useState((userProfile?.dietaryPreferences || []).join(", "));
  const [allergies, setAllergies] = useState((userProfile?.allergies || []).join(", "));
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof initialStepParam === "number") {
      setStep(Math.max(0, Math.min(4, initialStepParam)));
    }
  }, [initialStepParam]);

  const recommendedTimelines = useMemo(() => {
    const base = [6, 8, 12, 16, 20, 24, 36, 52];
    if (goal === "lose_weight" || goal === "lose_fat") return base;
    if (goal === "gain_weight" || goal === "gain_muscle") return base.slice(1);
    return [4, 6, 8, 12, 16, 20, 24];
  }, [goal]);

  const preview = useMemo(() => {
    const a = Number(age);
    const w = Number(weight);
    const h = Number(height);
    if (!a || !w || !h) return null;
    return estimateCaloriesAndMacros(w, h, a, gender, goal, activityLevel, bodyType);
  }, [age, weight, height, gender, goal, activityLevel, bodyType]);

  const canNext = () => {
    if (step === 0) return !!name && !!age && !!gender && !!country;
    if (step === 1) return !!weight && !!height && !!bodyType;
    if (step === 2) return !!goal && !!activityLevel && !!timelineWeeks;
    if (step === 3) return true;
    return true;
  };

  const next = () => {
    if (!canNext()) {
      Alert.alert("Missing info", "Please complete the required fields.");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleSave = async () => {
    if (!name || !age || !weight || !height) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    const ageN = parseInt(age, 10);
    const weightN = parseFloat(weight);
    const heightN = parseFloat(height);
    if (isNaN(ageN) || isNaN(weightN) || isNaN(heightN)) {
      Alert.alert("Error", "Please enter valid numbers for age/weight/height");
      return;
    }
    if (heightN <= 0.5 || heightN > 2.5) {
      Alert.alert("Invalid height", "Enter height in meters (e.g., 1.75).");
      return;
    }
    if (weightN <= 20 || weightN > 400) {
      Alert.alert("Invalid weight", "Enter weight in kg (20 - 400).");
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        uid: user!.uid,
        name,
        email: user!.email!,
        age: ageN,
        weight: weightN,
        height: heightN,
        gender,
        goal,
        activityLevel,
        bodyType,
        targetTimelineWeeks: timelineWeeks,
        country: country.trim(),
        dietaryPreferences: dietaryPreferences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allergies: allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        createdAt: new Date(),
      });

      const curate = httpsCallable(functions, "curateInitialPlan");
      const resp: any = await curate({
        profile: {
          name,
          age: ageN,
          weight: weightN,
          height: heightN,
          gender,
          goal,
          activityLevel,
          bodyType,
          targetTimelineWeeks: timelineWeeks,
          country: country.trim(),
          dietaryPreferences: dietaryPreferences
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          allergies: allergies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });

      const plan = resp?.data?.plan;
      if (plan && user?.uid) {
        await setDoc(
          doc(db, "users", user.uid, "plans", "current"),
          { ...plan, userId: user.uid, createdAt: Date.now() },
          { merge: true }
        );
      }

      Alert.alert("Profile Saved", "Your AI plan is ready in Planner/History.");
    } catch (error) {
      Alert.alert("Saved", "Profile saved. AI plan generation failed; you can retry later.");
    } finally {
      setLoading(false);
    }
  };

  const StepDots = () => (
    <View style={styles.dots}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i <= step ? theme.colors.primary : theme.colors.border },
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
          <Text style={[styles.title, { color: theme.colors.text }]}>Complete Your Profile</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Help us personalize your AI plan (workouts + meals)
          </Text>

          <StepDots />

          {step === 0 && (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Basics</Text>
              <LabeledInput label="Name *" value={name} onChangeText={setName} placeholder="Enter your name" />
              <LabeledInput label="Age *" value={age} onChangeText={setAge} placeholder="Enter your age" keyboardType="numeric" />
              <Select
                label="Gender *"
                value={gender}
                items={[
                  { label: "Male", value: "male" },
                  { label: "Female", value: "female" },
                ]}
                onChange={(v) => setGender(v)}
              />
              <LabeledInput label="Country *" value={country} onChangeText={setCountry} placeholder="e.g., Ghana" />
            </Card>
          )}

          {step === 1 && (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Body</Text>
              <LabeledInput
                label="Weight (kg) *"
                value={weight}
                onChangeText={setWeight}
                placeholder="Enter your weight"
                keyboardType="decimal-pad"
              />
              <LabeledInput
                label="Height (m) *"
                value={height}
                onChangeText={setHeight}
                placeholder="Enter your height (e.g., 1.75)"
                keyboardType="decimal-pad"
              />
              <Select
                label="Body Type *"
                value={bodyType}
                items={BODY_TYPES.map((b) => ({ label: b.label, value: b.value }))}
                onChange={(v) => setBodyType(v)}
              />
            </Card>
          )}

          {step === 2 && (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Goals</Text>
              <Select
                label="Primary Goal"
                value={goal}
                items={GOALS.map((g) => ({ label: g.label, value: g.value }))}
                onChange={(v) => setGoal(v)}
              />
              <Select
                label="Activity Level"
                value={activityLevel}
                items={ACTIVITIES.map((a) => ({
                  label: a.replace("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()),
                  value: a as ActivityLevel,
                }))}
                onChange={(v) => setActivityLevel(v)}
              />
              <Select
                label="Realistic Timeline (weeks)"
                value={timelineWeeks}
                items={recommendedTimelines.map((w) => ({ label: String(w), value: w }))}
                onChange={(v) => setTimelineWeeks(Number(v))}
              />
            </Card>
          )}

          {step === 3 && (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferences (optional)</Text>
              <LabeledTextArea
                label="Dietary Preferences"
                value={dietaryPreferences}
                onChangeText={setDietaryPreferences}
                placeholder="Comma-separated (e.g., halal, vegetarian, kosher)"
              />
              <LabeledTextArea
                label="Allergies"
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Comma-separated (e.g., peanuts, shellfish)"
              />
            </Card>
          )}

          {step === 4 && (
            <Card style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Review & Preview</Text>
              {!preview ? (
                <Text style={{ color: theme.colors.textMuted }}>
                  Enter age, weight, and height to preview targets.
                </Text>
              ) : (
                <>
                  <Text style={{ color: theme.colors.text }}>
                    Estimated daily calories: {preview.calories} kcal
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
                    Macros: P {preview.macros.protein}g • C {preview.macros.carbs}g • F {preview.macros.fat}g
                  </Text>
                </>
              )}
              <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
                These targets will save to your profile (you can edit later).
              </Text>
            </Card>
          )}

          <View style={styles.footerRow}>
            {step > 0 ? (
              <TouchableOpacity
                onPress={back}
                style={[styles.footerBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
              >
                <Text style={[styles.footerBtnText, { color: theme.colors.text }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {step < 4 ? (
              <TouchableOpacity
                onPress={next}
                style={[styles.footerBtn, { backgroundColor: theme.colors.primary }]}
                disabled={!canNext()}
              >
                <Text style={[styles.footerBtnText, { color: "#fff" }]}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={[styles.footerBtn, { backgroundColor: theme.colors.primary }, loading && { opacity: 0.7 }]}
              >
                <Text style={[styles.footerBtnText, { color: "#fff" }]}>
                  {loading ? "Saving…" : "Complete Setup"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LabeledInput({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
        placeholderTextColor={theme.colors.textMuted}
        {...props}
      />
    </View>
  );
}

function LabeledTextArea({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        multiline
        style={[styles.textArea, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
        placeholderTextColor={theme.colors.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold, textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, textAlign: "center", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 8 },
  label: { fontSize: 14, fontFamily: fonts.semiBold, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 16, fontFamily: fonts.regular },
  textArea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 16, fontFamily: fonts.regular, minHeight: 90, textAlignVertical: "top" },
  dots: { flexDirection: "row", alignSelf: "center", gap: 6, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  footerBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  footerBtnText: { fontFamily: fonts.semiBold },
});