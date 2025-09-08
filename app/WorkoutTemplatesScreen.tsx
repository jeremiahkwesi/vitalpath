// app/WorkoutTemplatesScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { generateWorkoutRoutineLocal } from "../src/services/aiPlans";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/context/AuthContext";
import { useNavigation } from "@react-navigation/native";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

async function setRoutineDraft(
  uid: string | null,
  name: string,
  items: { name: string; day: Day; sets: { reps?: string; restSec: number; type: "normal" | "timed" }[]; groupId?: string }[]
) {
  const key = uid ? `routine:draft:${uid}` : "routine:draft:anon";
  await AsyncStorage.setItem(key, JSON.stringify({ name, items }));
}

function Card({
  title,
  subtitle,
  onPress,
  color,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  color: string;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <View style={{ width: 6, backgroundColor: color, borderRadius: 6, marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={{ color: theme.colors.textMuted }}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function WorkoutTemplatesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const apply = async (config: {
    daysPerWeek: number;
    goal: "hypertrophy" | "strength" | "fat_loss" | "general";
    focus: "full_body" | "upper_lower" | "ppl" | "emphasis";
  }) => {
    if (busy) return;
    setBusy(true);
    try {
      const draft = await generateWorkoutRoutineLocal({
        daysPerWeek: config.daysPerWeek,
        goal: config.goal,
        experience: "intermediate",
        sessionLengthMin: 60,
        equipment: ["Barbell", "Dumbbell", "Bodyweight"],
        focus: config.focus,
      });
      await setRoutineDraft(user?.uid || null, draft.name, draft.items as any);
      nav.navigate("RoutineBuilder");
    } catch (e: any) {
      Alert.alert("Template", e?.message || "Failed to apply template.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={[styles.header, { color: theme.colors.text }]}>Templates</Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Pick a ready plan. You can tweak it in the Builder.
      </Text>

      <Card
        title="Hypertrophy • Upper/Lower (4 days)"
        subtitle="Balanced muscle growth with warm-ups, supersets, finisher"
        color="#7E57C2"
        onPress={() => apply({ daysPerWeek: 4, goal: "hypertrophy", focus: "upper_lower" })}
      />
      <Card
        title="Strength • Full Body (3 days)"
        subtitle="More rest on main lifts, core finisher"
        color="#2962FF"
        onPress={() => apply({ daysPerWeek: 3, goal: "strength", focus: "full_body" })}
      />
      <Card
        title="Fat Loss • PPL (5 days)"
        subtitle="Higher density, conditioning finishers"
        color="#F4511E"
        onPress={() => apply({ daysPerWeek: 5, goal: "fat_loss", focus: "ppl" })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
});