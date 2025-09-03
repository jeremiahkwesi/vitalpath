// app/SettingsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/ui/ThemeProvider";
import Card from "../src/ui/components/Card";
import Segmented from "../src/ui/components/Segmented";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  scheduleDailyWaterReminders,
  scheduleDailyMealReminders,
  cancelAllReminders,
} from "../src/utils/notifications";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

export default function SettingsScreen() {
  const { theme, setScheme, scheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const h = useHaptics();

  const [waterEnabled, setWaterEnabled] = useState(false);
  const [mealsEnabled, setMealsEnabled] = useState(false);

  const [stepGoal, setStepGoal] = useState<string>("8000");
  const [waterGoal, setWaterGoal] = useState<string>("2000");

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const w = await AsyncStorage.getItem(`settings:water:${user.uid}`);
      const m = await AsyncStorage.getItem(`settings:meals:${user.uid}`);
      const sg = await AsyncStorage.getItem(`settings:goal:steps:${user.uid}`);
      const wg = await AsyncStorage.getItem(`settings:goal:water:${user.uid}`);
      setWaterEnabled(w === "1");
      setMealsEnabled(m === "1");
      setStepGoal(sg || "8000");
      setWaterGoal(wg || "2000");
    })();
  }, [user?.uid]);

  const toggleWater = async (val: boolean) => {
    setWaterEnabled(val);
    if (!user?.uid) return;
    if (val) {
      try {
        await scheduleDailyWaterReminders();
        await AsyncStorage.setItem(`settings:water:${user.uid}`, "1");
        h.impact("light");
        toast.success("Water reminders on");
      } catch {
        toast.error("Could not enable water reminders");
      }
    } else {
      await AsyncStorage.setItem(`settings:water:${user.uid}`, "0");
      h.impact("light");
      toast.info("Water reminders off");
    }
  };

  const toggleMeals = async (val: boolean) => {
    setMealsEnabled(val);
    if (!user?.uid) return;
    if (val) {
      try {
        await scheduleDailyMealReminders([
          { hour: 8, minute: 0, label: "Breakfast" },
          { hour: 13, minute: 0, label: "Lunch" },
          { hour: 19, minute: 0, label: "Dinner" },
        ]);
        await AsyncStorage.setItem(`settings:meals:${user.uid}`, "1");
        h.impact("light");
        toast.success("Meal reminders on");
      } catch {
        toast.error("Could not enable meal reminders");
      }
    } else {
      await AsyncStorage.setItem(`settings:meals:${user.uid}`, "0");
      h.impact("light");
      toast.info("Meal reminders off");
    }
  };

  const disableAllReminders = async () => {
    try {
      await cancelAllReminders();
    } catch {}
    setWaterEnabled(false);
    setMealsEnabled(false);
    if (user?.uid) {
      await AsyncStorage.setItem(`settings:water:${user.uid}`, "0");
      await AsyncStorage.setItem(`settings:meals:${user.uid}`, "0");
    }
    h.impact("light");
    toast.info("All reminders disabled");
  };

  const saveGoals = async () => {
    if (!user?.uid) return;
    const sg = Math.max(0, parseInt(stepGoal || "0", 10));
    const wg = Math.max(0, parseInt(waterGoal || "0", 10));
    await AsyncStorage.setItem(`settings:goal:steps:${user.uid}`, String(sg));
    await AsyncStorage.setItem(`settings:goal:water:${user.uid}`, String(wg));
    h.impact("light");
    toast.success("Goals saved");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}>
      {/* Appearance */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Appearance
        </Text>
        <Segmented
          items={[
            { label: "System", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          value={scheme}
          onChange={(v) => setScheme(v as any)}
        />
      </Card>

      {/* Goals */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Daily Goals
        </Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Steps goal
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
            value={stepGoal}
            onChangeText={setStepGoal}
            placeholder="e.g., 8000"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Steps goal"
          />
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Water goal (ml)
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
            value={waterGoal}
            onChangeText={setWaterGoal}
            placeholder="e.g., 2000"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Water goal in milliliters"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={saveGoals}
        >
          <Text style={styles.buttonText}>Save goals</Text>
        </TouchableOpacity>
      </Card>

      {/* Notifications */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Reminders
        </Text>

        <Row
          icon="water-outline"
          label="Water reminders"
          right={
            <Switch
              value={waterEnabled}
              onValueChange={toggleWater}
              trackColor={{ true: theme.colors.primary }}
              accessibilityLabel="Toggle water reminders"
            />
          }
        />

        <Row
          icon="restaurant-outline"
          label="Meal reminders"
          right={
            <Switch
              value={mealsEnabled}
              onValueChange={toggleMeals}
              trackColor={{ true: theme.colors.primary }}
              accessibilityLabel="Toggle meal reminders"
            />
          }
        />

        <TouchableOpacity
          onPress={disableAllReminders}
          style={[
            styles.button,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
          accessibilityLabel="Disable all reminders"
        >
          <Ionicons
            name="notifications-off-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            Disable all reminders
          </Text>
        </TouchableOpacity>

        {Platform.OS === "web" && (
          <Text style={{ color: theme.colors.textMuted, marginTop: 8, fontSize: 12 }}>
            Note: Push notifications are limited on web.
          </Text>
        )}
      </Card>

      {/* About */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          About
        </Text>
        <Row
          icon="information-circle-outline"
          label="Version"
          right={
            <Text style={{ color: theme.colors.textMuted }} accessibilityLabel="App version">
              1.0.0
            </Text>
          }
        />
        <Row
          icon="shield-checkmark-outline"
          label="Privacy & Terms"
          right={<Ionicons name="open-outline" size={16} color={theme.colors.textMuted} />}
        />
      </Card>
    </View>
  );
}

function Row({
  icon,
  label,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
      ]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  rowLabel: { fontFamily: fonts.semiBold },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  buttonText: { fontFamily: fonts.semiBold },
  label: { fontFamily: fonts.semiBold, minWidth: 110 },
  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
});