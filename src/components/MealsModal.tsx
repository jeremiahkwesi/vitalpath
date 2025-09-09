import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useActivity } from "../context/ActivityContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";
import Select from "../ui/components/Select";

type Props = { visible: boolean; onClose: () => void };

export default function MealsModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();
  const { todayActivity, addMeal, removeMeal } = useActivity();
  const [form, setForm] = useState({
    name: "",
    type: "lunch" as "breakfast" | "lunch" | "dinner" | "snack",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sodium: "",
    potassium: "",
    vitaminC: "",
    calcium: "",
    iron: "",
  });

  const totals = useMemo(() => {
    return {
      calories: todayActivity?.totalCalories || 0,
      protein: todayActivity?.macros.protein || 0,
      carbs: todayActivity?.macros.carbs || 0,
      fat: todayActivity?.macros.fat || 0,
    };
  }, [todayActivity]);

  const resetForm = () =>
    setForm({
      name: "",
      type: "lunch",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      fiber: "",
      sodium: "",
      potassium: "",
      vitaminC: "",
      calcium: "",
      iron: "",
    });

  const toNum = (s: string) => {
    const n = Number(String(s).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  const onAdd = async () => {
    const calories = parseInt(form.calories || "0", 10);

    if (!form.name || !Number.isFinite(calories) || calories <= 0) {
      toast.error("Enter a name and valid calories");
      return;
    }

    await addMeal({
      name: form.name,
      type: form.type,
      calories,
      macros: {
        protein: Number(parseFloat(form.protein || "0").toFixed(0)),
        carbs: Number(parseFloat(form.carbs || "0").toFixed(0)),
        fat: Number(parseFloat(form.fat || "0").toFixed(0)),
      },
      micros: {
        ...(toNum(form.fiber) != null ? { fiber: toNum(form.fiber)! } : {}),
        ...(toNum(form.sodium) != null ? { sodium: toNum(form.sodium)! } : {}),
        ...(toNum(form.potassium) != null ? { potassium: toNum(form.potassium)! } : {}),
        ...(toNum(form.vitaminC) != null ? { vitaminC: toNum(form.vitaminC)! } : {}),
        ...(toNum(form.calcium) != null ? { calcium: toNum(form.calcium)! } : {}),
        ...(toNum(form.iron) != null ? { iron: toNum(form.iron)! } : {}),
      },
    });

    resetForm();
    h.impact("light");
    toast.success("Meal logged");
  };

  const onDelete = async (id: string) => {
    await removeMeal(id);
    h.impact("light");
    toast.info("Deleted meal");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Meals Today
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: theme.colors.text }}>
                Calories: {Math.round(totals.calories)} kcal
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                P {Math.round(totals.protein)}g • C {Math.round(totals.carbs)}g •
                F {Math.round(totals.fat)}g
              </Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(todayActivity?.meals || []).map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.mealItem,
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mealName, { color: theme.colors.text }]}>{m.name}</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                      {m.type} • {m.calories} kcal • P {m.macros.protein}g, C{" "}
                      {m.macros.carbs}g, F {m.macros.fat}g
                    </Text>
                    {!!m.micros && Object.keys(m.micros).length > 0 && (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                        Micros:{" "}
                        {Object.entries(m.micros)
                          .slice(0, 6)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => onDelete(m.id)}>
                    <Text style={{ color: "#FF6B6B", fontFamily: fonts.semiBold }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.section, { color: theme.colors.text }]}>Add Meal</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder="Name (e.g., Chicken salad)"
                placeholderTextColor={theme.colors.textMuted}
                value={form.name}
                onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
              />
              <View style={styles.row}>
                <Select
                  label="Meal type"
                  value={form.type}
                  items={[
                    { label: "Breakfast", value: "breakfast" },
                    { label: "Lunch", value: "lunch" },
                    { label: "Dinner", value: "dinner" },
                    { label: "Snack", value: "snack" },
                  ]}
                  onChange={(v) => setForm((s) => ({ ...s, type: v as any }))}
                />
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                  ]}
                  placeholder="Calories"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.calories}
                  onChangeText={(t) => setForm((s) => ({ ...s, calories: t }))}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                  ]}
                  placeholder="Protein (g)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={form.protein}
                  onChangeText={(t) => setForm((s) => ({ ...s, protein: t }))}
                />
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                  ]}
                  placeholder="Carbs (g)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={form.carbs}
                  onChangeText={(t) => setForm((s) => ({ ...s, carbs: t }))}
                />
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                  ]}
                  placeholder="Fat (g)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                  value={form.fat}
                  onChangeText={(t) => setForm((s) => ({ ...s, fat: t }))}
                />
              </View>

              <Text style={[styles.section, { color: theme.colors.text }]}>Micros (optional)</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Fiber (g)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.fiber}
                  onChangeText={(t) => setForm((s) => ({ ...s, fiber: t }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Sodium (mg)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.sodium}
                  onChangeText={(t) => setForm((s) => ({ ...s, sodium: t }))}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Potassium (mg)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.potassium}
                  onChangeText={(t) => setForm((s) => ({ ...s, potassium: t }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Vitamin C (mg)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.vitaminC}
                  onChangeText={(t) => setForm((s) => ({ ...s, vitaminC: t }))}
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Calcium (mg)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.calcium}
                  onChangeText={(t) => setForm((s) => ({ ...s, calcium: t }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Iron (mg)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  value={form.iron}
                  onChangeText={(t) => setForm((s) => ({ ...s, iron: t }))}
                />
              </View>

              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onAdd}
              >
                <Text style={styles.addBtnText}>Add Meal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88%", padding: 16, borderTopWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, alignItems: "center" },
  title: { fontSize: 18, fontFamily: fonts.semiBold },
  mealItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  mealName: { fontSize: 16, fontFamily: fonts.semiBold },
  section: { fontFamily: fonts.semiBold, marginBottom: 8 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontFamily: fonts.regular },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  addBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 14 },
});