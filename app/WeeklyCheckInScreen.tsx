// app/WeeklyCheckInScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { addWeight, listWeights, weeklyAvg } from "../src/utils/weight";
import { suggestCalorieAdjustment } from "../src/utils/checkin";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function WeeklyCheckInScreen() {
  const { theme } = useTheme();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [today, setToday] = useState<string>(todayISO());
  const [kg, setKg] = useState<string>("");
  const [history, setHistory] = useState<{ date: string; kg: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user?.uid) return;
    const w = await listWeights(user.uid);
    setHistory(w);
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  const onSave = async () => {
    if (!user?.uid) return;
    const n = parseFloat(kg);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert("Weight", "Enter a valid weight in kg.");
      return;
    }
    setBusy(true);
    try {
      await addWeight(user.uid, today, Math.round(n * 10) / 10);
      setKg("");
      setToday(todayISO());
      await load();
    } catch {
      Alert.alert("Save", "Failed to save weight.");
    } finally {
      setBusy(false);
    }
  };

  const avg1 = useMemo(() => weeklyAvg(history, 1), [history]);
  const avg2 = useMemo(() => weeklyAvg(history, 2), [history]);

  const plan = useMemo(() => {
    if (!userProfile) return null;
    return suggestCalorieAdjustment(userProfile, history);
  }, [userProfile, history]);

  const apply = async () => {
    if (!plan || !userProfile) return;
    try {
      await updateUserProfile({ dailyCalories: plan.newTarget });
      Alert.alert("Updated", `Daily calories set to ${plan.newTarget} kcal.`);
    } catch {
      Alert.alert("Update", "Failed to update daily calories.");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.header, { color: theme.colors.text }]}>Weekly Check‑in</Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Log weight (kg), review trend, and update daily calories automatically.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sub, { color: theme.colors.text }]}>Log</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
          placeholder="Weight (kg)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          value={kg}
          onChangeText={setKg}
        />
        <TouchableOpacity onPress={onSave} disabled={busy} style={[styles.btn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, opacity: busy ? 0.7 : 1 }]}>
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>{busy ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sub, { color: theme.colors.text }]}>Trend</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          1‑week avg: {avg1 != null ? `${avg1} kg` : "—"} • 2‑week avg: {avg2 != null ? `${avg2} kg` : "—"}
        </Text>
        <View style={{ marginTop: 6 }}>
          {history.slice(-10).map((h) => (
            <Text key={h.date} style={{ color: theme.colors.textMuted }}>
              {h.date}: {h.kg} kg
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sub, { color: theme.colors.text }]}>Adjustment</Text>
        {!plan ? (
          <Text style={{ color: theme.colors.textMuted }}>Not enough data yet (log weights for at least a week).</Text>
        ) : (
          <>
            <Text style={{ color: theme.colors.text }}>{plan.reason}</Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Suggested: {plan.delta > 0 ? "+" : ""}
              {plan.delta} kcal/day → New target {plan.newTarget} kcal/day
            </Text>
            <TouchableOpacity onPress={apply} style={[styles.btn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, marginTop: 8 }]}>
              <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Apply new target</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  sub: { fontFamily: fonts.semiBold, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular, marginBottom: 8 },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
});