// src/components/QuickEditMealModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { colors as baseColors } from "../constants/colors";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { useHaptics } from "../ui/hooks/useHaptics";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type QuickMeal = {
  name: string;
  serving?: string;
  grams?: number;
  components?: { name: string; grams: number }[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  type: MealType;
};

export default function QuickEditMealModal({
  visible,
  onClose,
  initial,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  initial: {
    name: string;
    serving?: string;
    grams?: number;
    components?: { name: string; grams: number }[];
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  onSave: (m: QuickMeal) => void;
}) {
  const { theme } = useTheme();
  const h = useHaptics();

  const [form, setForm] = useState<QuickMeal>({
    name: initial.name || "Meal",
    serving: initial.serving,
    grams: initial.grams,
    components: initial.components || [],
    calories: Math.round(initial.calories || 0),
    protein: Math.round(initial.protein || 0),
    carbs: Math.round(initial.carbs || 0),
    fat: Math.round(initial.fat || 0),
    type: "lunch",
  });

  useEffect(() => {
    if (!visible) return;
    setForm((s) => ({
      ...s,
      name: initial.name || "Meal",
      serving: initial.serving,
      grams: initial.grams,
      components: initial.components || [],
      calories: Math.round(initial.calories || 0),
      protein: Math.round(initial.protein || 0),
      carbs: Math.round(initial.carbs || 0),
      fat: Math.round(initial.fat || 0),
    }));
  }, [visible]);

  const gramsChips = useMemo(() => [100, 150, 200, 250, 300, 400], []);

  const update = (k: keyof QuickMeal, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  const updateComponent = (idx: number, key: "name" | "grams", v: any) => {
    setForm((s) => {
      const arr = [...(s.components || [])];
      const row = arr[idx] || { name: "", grams: 0 };
      arr[idx] = {
        ...row,
        [key]: key === "grams" ? Math.max(0, parseInt(String(v || "0"), 10)) : v,
      };
      return { ...s, components: arr };
    });
  };

  const addComponent = () =>
    setForm((s) => ({
      ...s,
      components: [...(s.components || []), { name: "", grams: 0 }],
    }));

  const removeComponent = (idx: number) =>
    setForm((s) => {
      const arr = [...(s.components || [])];
      arr.splice(idx, 1);
      return { ...s, components: arr };
    });

  const n = (t: string, def = 0) => {
    const x = Number(String(t).replace(/[^\d.]/g, ""));
    return Number.isFinite(x) ? x : def;
  };

  const save = () => {
    onSave({
      ...form,
      calories: Math.max(0, n(String(form.calories))),
      protein: Math.max(0, n(String(form.protein))),
      carbs: Math.max(0, n(String(form.carbs))),
      fat: Math.max(0, n(String(form.fat))),
      grams:
        form.grams != null
          ? Math.max(0, parseInt(String(form.grams) || "0", 10))
          : undefined,
    });
    h.impact("light");
  };

  const bumpGrams = (delta: number) => {
    setForm((s) => {
      const g = s.grams ?? 0;
      const next = Math.max(0, Math.min(1500, g + delta));
      return { ...s, grams: next };
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Quick Edit
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: "82%" }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={form.name}
              onChangeText={(t) => update("name", t)}
              placeholder="Meal name"
              placeholderTextColor={theme.colors.textMuted}
            />

            {!!form.serving && (
              <Text style={[styles.servingText, { color: theme.colors.textMuted }]}>
                Serving: {form.serving}
              </Text>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={form.grams != null ? String(form.grams) : ""}
                  onChangeText={(t) => update("grams", t)}
                  placeholder="Portion (g)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                onPress={() => bumpGrams(-10)}
                style={[
                  styles.bumpBtn,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  -10g
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => bumpGrams(+10)}
                style={[
                  styles.bumpBtn,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  +10g
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 8 }}
            >
              {gramsChips.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => update("grams", g)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
                  >
                    {g}g
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={String(form.calories)}
                onChangeText={(t) => update("calories", t)}
                placeholder="Calories"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={String(form.protein)}
                onChangeText={(t) => update("protein", t)}
                placeholder="Protein (g)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={String(form.carbs)}
                onChangeText={(t) => update("carbs", t)}
                placeholder="Carbs (g)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={String(form.fat)}
                onChangeText={(t) => update("fat", t)}
                placeholder="Fat (g)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View
              style={[
                styles.pickerWrap,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
              ]}
            >
              <Picker
                selectedValue={form.type}
                onValueChange={(v) => update("type", v as MealType)}
                style={[styles.picker, { color: theme.colors.text }]}
              >
                <Picker.Item label="Breakfast" value="breakfast" />
                <Picker.Item label="Lunch" value="lunch" />
                <Picker.Item label="Dinner" value="dinner" />
                <Picker.Item label="Snack" value="snack" />
              </Picker>
            </View>

            <View style={styles.componentsHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Components (optional)
              </Text>
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                ]}
                onPress={addComponent}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  + Add
                </Text>
              </TouchableOpacity>
            </View>

            {(form.components || []).map((c, idx) => (
              <View style={styles.compRow} key={`comp-${idx}`}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
                  ]}
                  value={c.name}
                  onChangeText={(t) => updateComponent(idx, "name", t)}
                  placeholder="Item name (e.g., banku)"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      width: 100,
                      textAlign: "right",
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={String(c.grams)}
                  onChangeText={(t) => updateComponent(idx, "grams", t)}
                  placeholder="g"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[
                    styles.removeBtn,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                  onPress={() => removeComponent(idx)}
                >
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
            onPress={save}
          >
            <Text style={styles.saveText}>Save Meal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, alignItems: "center" },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  servingText: { fontFamily: fonts.regular, marginBottom: 6, marginTop: -2 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  bumpBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pickerWrap: { borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  picker: { height: 44 },
  componentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 6,
  },
  sectionTitle: { fontFamily: fonts.semiBold, fontSize: 14 },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  compRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  removeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveBtn: { borderRadius: 10, padding: 12, alignItems: "center", marginTop: 8 },
  saveText: { color: "#fff", fontFamily: fonts.semiBold },
});