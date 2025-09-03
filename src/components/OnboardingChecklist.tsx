// src/components/OnboardingChecklist.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Card from "../ui/components/Card";
import { useTheme } from "../ui/ThemeProvider";
import { fonts } from "../constants/fonts";

export default function OnboardingChecklist({
  uid,
  dateISO,
  userProfile,
  todayActivity,
  onAddMeal,
  onAddWorkout,
  onAddWater,
  onEnableReminders,
  onGoProfile,
}: {
  uid: string;
  dateISO: string;
  userProfile: any;
  todayActivity: any;
  onAddMeal: () => void;
  onAddWorkout: () => void;
  onAddWater: () => void;
  onEnableReminders: () => void;
  onGoProfile: () => void;
}) {
  const { theme } = useTheme();

  const tasks = useMemo(() => {
    const out: { label: string; done: boolean; action?: () => void }[] = [];
    out.push({
      label: "Complete your profile",
      done: !!userProfile?.name && !!userProfile?.height && !!userProfile?.weight,
      action: onGoProfile,
    });
    out.push({
      label: "Log your first meal",
      done: (todayActivity?.meals?.length || 0) > 0,
      action: onAddMeal,
    });
    out.push({
      label: "Log water",
      done: (todayActivity?.waterIntake || 0) > 0,
      action: onAddWater,
    });
    out.push({
      label: "Do a workout",
      done: (todayActivity?.workouts?.length || 0) > 0,
      action: onAddWorkout,
    });
    out.push({
      label: "Enable reminders",
      done: false,
      action: onEnableReminders,
    });
    return out;
  }, [userProfile, todayActivity, onAddMeal, onAddWater, onAddWorkout, onEnableReminders, onGoProfile]);

  const pending = tasks.filter((t) => !t.done);
  if (pending.length === 0) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Quick Start Checklist
      </Text>
      {tasks.map((t, idx) => (
        <View key={`${t.label}-${idx}`} style={styles.item}>
          <View
            style={[
              styles.dot,
              { backgroundColor: t.done ? theme.colors.primary : theme.colors.border },
            ]}
          />
          <Text
            style={[
              styles.label,
              { color: t.done ? theme.colors.textMuted : theme.colors.text },
            ]}
          >
            {t.label}
          </Text>
          {!t.done && t.action && (
            <TouchableOpacity
              onPress={t.action}
              style={[
                styles.btn,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
              ]}
            >
              <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                Do it
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontFamily: fonts.semiBold, flex: 1 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
});