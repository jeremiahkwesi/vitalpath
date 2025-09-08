// app/MealsDiaryScreen.tsx
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useActivity } from "../src/context/ActivityContext";

export default function MealsDiaryScreen() {
  const { theme } = useTheme();
  const { todayActivity, updateMeal, removeMeal } = useActivity();

  const [editing, setEditing] = useState<{ id: string; calories: string; protein: string; carbs: string; fat: string } | null>(null);

  const meals = useMemo(() => todayActivity?.meals || [], [todayActivity]);

  const startEdit = (m: any) => {
    setEditing({
      id: m.id,
      calories: String(m.calories || 0),
      protein: String(m.macros?.protein || 0),
      carbs: String(m.macros?.carbs || 0),
      fat: String(m.macros?.fat || 0),
    });
  };

  const save = async () => {
    if (!editing) return;
    const c = parseInt(editing.calories || "0", 10);
    const p = parseInt(editing.protein || "0", 10);
    const cb = parseInt(editing.carbs || "0", 10);
    const f = parseInt(editing.fat || "0", 10);
    await updateMeal(editing.id, { calories: c, macros: { protein: p, carbs: cb, fat: f } });
    setEditing(null);
  };

  const del = (id: string) => {
    Alert.alert("Delete meal", "Remove this meal from today?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeMeal(id) },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={[styles.header, { color: theme.colors.text }]}>Today’s Meals</Text>

      {meals.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted }}>No meals yet.</Text>
      ) : (
        meals.map((m: any) => (
          <View key={m.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{m.name}</Text>
            <Text style={{ color: theme.colors.textMuted, marginBottom: 6 }}>
              {m.type} • {m.calories} kcal • P{m.macros?.protein} C{m.macros?.carbs} F{m.macros?.fat}
            </Text>

            {editing && editing.id === m.id ? (
              <>
                <Row label="Calories">
                  <TextInput style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="numeric" value={editing.calories} onChangeText={(t) => setEditing((s) => s && { ...s, calories: t })} />
                </Row>
                <Row label="Protein">
                  <TextInput style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="numeric" value={editing.protein} onChangeText={(t) => setEditing((s) => s && { ...s, protein: t })} />
                </Row>
                <Row label="Carbs">
                  <TextInput style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="numeric" value={editing.carbs} onChangeText={(t) => setEditing((s) => s && { ...s, carbs: t })} />
                </Row>
                <Row label="Fat">
                  <TextInput style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]} keyboardType="numeric" value={editing.fat} onChangeText={(t) => setEditing((s) => s && { ...s, fat: t })} />
                </Row>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={save} style={[styles.smallBtn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                    <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={[styles.smallBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => startEdit(m)} style={[styles.smallBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => del(m.id)} style={[styles.smallBtn, { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" }]}>
                  <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular, marginTop: 4 },
  smallBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});