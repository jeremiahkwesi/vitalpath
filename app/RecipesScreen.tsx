// app/RecipesScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import {
  Recipe,
  listRecipes,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  computeTotals,
} from "../src/services/recipes";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export default function RecipesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { addMeal } = useActivity();

  const [items, setItems] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [current, setCurrent] = useState<Recipe | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");

  const load = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const r = await listRecipes(user.uid);
      setItems(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  const openNew = () => {
    setCurrent({
      id: "",
      name: "",
      servings: 1,
      ingredients: [],
      steps: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    });
    setEditorOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setCurrent(JSON.parse(JSON.stringify(r)));
    setEditorOpen(true);
  };

  const save = async () => {
    if (!user?.uid || !current) return;
    const name = current.name.trim();
    if (!name) return Alert.alert("Name", "Enter a recipe name");
    const servings = Math.max(1, Math.round(Number(current.servings || 1)));
    const totals = computeTotals(current.ingredients || []);
    const payload = {
      name,
      servings,
      ingredients: current.ingredients || [],
      steps: current.steps || [],
      tags: current.tags || [],
    };
    try {
      if (current.id) {
        await updateRecipe(user.uid, current.id, payload);
      } else {
        const id = await addRecipe(user.uid, payload as any);
        current.id = id;
      }
      setEditorOpen(false);
      load();
    } catch {
      Alert.alert("Error", "Failed to save recipe");
    }
  };

  const remove = async (r: Recipe) => {
    if (!user?.uid) return;
    Alert.alert("Delete recipe", `Remove "${r.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteRecipe(user.uid!, r.id);
          load();
        },
      },
    ]);
  };

  const logOneServing = async (r: Recipe) => {
    if (!r?.servings || r.servings < 1) return;
    const per = {
      calories: Math.round(r.totals.calories / r.servings),
      protein: Math.round(r.totals.protein / r.servings),
      carbs: Math.round(r.totals.carbs / r.servings),
      fat: Math.round(r.totals.fat / r.servings),
    };
    await addMeal({
      name: `${r.name} (1 serving)`,
      type: mealType,
      calories: per.calories,
      macros: {
        protein: per.protein,
        carbs: per.carbs,
        fat: per.fat,
      },
      micros: {},
    });
    Alert.alert("Logged", `Added to ${mealType}`);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        My Recipes
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>
        Create multi-ingredient recipes with servings. Log per serving.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <TouchableOpacity
          onPress={openNew}
          style={[
            styles.btn,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.btnTextLight}>New recipe</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <MealTypePicker value={mealType} onChange={setMealType} />
      </View>

      {loading ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          Loading…
        </Text>
      ) : items.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          No recipes yet. Tap “New recipe” to create one.
        </Text>
      ) : (
        items.map((r) => (
          <View
            key={r.id}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {r.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Servings: {r.servings} • Totals: {r.totals.calories} kcal • P
              {r.totals.protein} C{r.totals.carbs} F{r.totals.fat}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => logOneServing(r)}
                style={[
                  styles.smallBtn,
                  { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.btnTextLight}>Log 1 serving</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openEdit(r)}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => remove(r)}
                style={[styles.smallBtn, { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" }]}
              >
                <Text style={styles.btnTextLight}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <RecipeEditorModal
        open={editorOpen}
        value={current}
        onChange={setCurrent}
        onClose={() => setEditorOpen(false)}
        onSave={save}
      />
    </ScrollView>
  );
}

function MealTypePicker({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (v: MealType) => void;
}) {
  const { theme } = useTheme();
  const opts: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {opts.map((m) => {
        const active = value === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => onChange(m)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: active ? theme.colors.primary : theme.colors.surface2,
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : theme.colors.text,
                fontFamily: fonts.semiBold,
                fontSize: 12,
              }}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RecipeEditorModal({
  open,
  value,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  value: Recipe | null;
  onChange: (r: Recipe | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { theme } = useTheme();
  if (!open || !value) return null;

  const totals = computeTotals(value.ingredients || []);
  const per = {
    calories: Math.round((totals.calories || 0) / Math.max(1, value.servings || 1)),
    protein: Math.round((totals.protein || 0) / Math.max(1, value.servings || 1)),
    carbs: Math.round((totals.carbs || 0) / Math.max(1, value.servings || 1)),
    fat: Math.round((totals.fat || 0) / Math.max(1, value.servings || 1)),
  };

  const addIng = () => {
    const ings = [...(value.ingredients || [])];
    ings.push({
      name: "",
      grams: undefined,
      quantity: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    onChange({ ...value, ingredients: ings });
  };

  const updateIng = (idx: number, patch: Partial<any>) => {
    const ings = [...(value.ingredients || [])];
    ings[idx] = { ...ings[idx], ...patch };
    onChange({ ...value, ingredients: ings });
  };

  const removeIng = (idx: number) => {
    const ings = [...(value.ingredients || [])];
    ings.splice(idx, 1);
    onChange({ ...value, ingredients: ings });
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalBody,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={[styles.header, { color: theme.colors.text }]}>
              {value.id ? "Edit Recipe" : "New Recipe"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={value.name}
              onChangeText={(t) => onChange({ ...value, name: t })}
            />
            <Text style={[styles.label, { color: theme.colors.text }]}>Servings</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
              value={String(value.servings || 1)}
              keyboardType="numeric"
              onChangeText={(t) =>
                onChange({ ...value, servings: Math.max(1, parseInt(t || "1", 10)) })
              }
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Ingredients</Text>
            {(value.ingredients || []).map((it, idx) => (
              <View
                key={idx}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 10,
                  padding: 8,
                  marginBottom: 8,
                }}
              >
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Name (e.g., Chicken breast)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={it.name}
                  onChangeText={(t) => updateIng(idx, { name: t })}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Grams"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={it.grams != null ? String(it.grams) : ""}
                    onChangeText={(t) => updateIng(idx, { grams: Math.max(0, parseInt(t || "0", 10)) })}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Quantity (e.g., 1 cup)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={it.quantity || ""}
                    onChangeText={(t) => updateIng(idx, { quantity: t })}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Calories"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={String(it.calories || 0)}
                    onChangeText={(t) => updateIng(idx, { calories: Math.max(0, parseInt(t || "0", 10)) })}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Protein (g)"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={String(it.protein || 0)}
                    onChangeText={(t) => updateIng(idx, { protein: Math.max(0, parseInt(t || "0", 10)) })}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Carbs (g)"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={String(it.carbs || 0)}
                    onChangeText={(t) => updateIng(idx, { carbs: Math.max(0, parseInt(t || "0", 10)) })}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Fat (g)"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={String(it.fat || 0)}
                    onChangeText={(t) => updateIng(idx, { fat: Math.max(0, parseInt(t || "0", 10)) })}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => removeIng(idx)}
                  style={[styles.smallBtn, { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" }]}
                >
                  <Text style={styles.btnTextLight}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={addIng}
              style={[styles.smallBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                + Add ingredient
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: theme.colors.text, marginTop: 8 }]}>Steps</Text>
            <TextInput
              style={[
                styles.input,
                {
                  height: 100,
                  textAlignVertical: "top",
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              multiline
              placeholder="Write instructions, one per line"
              placeholderTextColor={theme.colors.textMuted}
              value={(value.steps || []).join("\n")}
              onChangeText={(t) =>
                onChange({ ...value, steps: t.split("\n").map((s) => s.trim()).filter(Boolean) })
              }
            />

            <View
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 10,
                padding: 10,
                marginTop: 10,
              }}
            >
              <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold, marginBottom: 4 }}>
                Nutrition
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Total: {totals.calories} kcal • P{totals.protein} C{totals.carbs} F{totals.fat}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Per serving: {per.calories} kcal • P{per.protein} C{per.carbs} F{per.fat}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onSave}
              style={[styles.btn, { backgroundColor: theme.colors.primary, marginTop: 10, borderColor: theme.colors.primary }]}
            >
              <Text style={styles.btnTextLight}>Save</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  label: { fontFamily: fonts.semiBold, marginTop: 8, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular, marginBottom: 8 },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  smallBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start", marginTop: 6 },
  btnTextLight: { color: "#fff", fontFamily: fonts.semiBold },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalBody: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 16, maxHeight: "88%" },
});