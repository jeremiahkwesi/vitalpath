// app/LibraryScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../src/constants/fonts";
import Segmented from "../src/ui/components/Segmented";
import Card from "../src/ui/components/Card";
import { useTheme } from "../src/ui/ThemeProvider";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import {
  getCustomFoods,
  deleteCustomFood,
  FoodItem,
} from "../src/services/foodDb";
import {
  getCustomExercises,
  deleteCustomExercise,
  Exercise,
} from "../src/services/workoutsDb";
import { getFavorites } from "../src/utils/favorites";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

type TabKey = "favorites" | "foods" | "exercises";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export default function LibraryScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const { user } = useAuth();
  const { addMeal, addWorkout } = useActivity();

  const [tab, setTab] = useState<TabKey>("favorites");

  const [favorites, setFavorites] = useState<
    { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; type: MealType }[]
  >([]);
  const [myFoods, setMyFoods] = useState<FoodItem[]>([]);
  const [myExercises, setMyExercises] = useState<Exercise[]>([]);

  const [grams, setGrams] = useState<number>(200);
  const [mealType, setMealType] = useState<MealType>("lunch");

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const favs = await getFavorites(user.uid);
      setFavorites(favs || []);
    })();
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const foods = await getCustomFoods(user.uid);
      setMyFoods(foods || []);
      const exs = await getCustomExercises(user.uid);
      setMyExercises(exs || []);
    })();
  }, [user?.uid]);

  const scaleFromServing = (f: FoodItem) => {
    const m = String(f.serving || "").match(/(\d+(\.\d+)?)\s*g/i);
    const baseG = m ? Math.round(parseFloat(m[1])) : 100;
    const r = grams > 0 ? grams / baseG : 1;
    return {
      calories: Math.round((f.calories || 0) * r),
      protein: Math.round((f.protein || 0) * r),
      carbs: Math.round((f.carbs || 0) * r),
      fat: Math.round((f.fat || 0) * r),
    };
  };

  const gramChips = useMemo(() => [100, 150, 200, 250, 300, 400], []);

  const logFavorite = async (f: typeof favorites[number]) => {
    await addMeal({
      name: f.name,
      type: f.type,
      calories: f.calories,
      macros: { protein: f.protein, carbs: f.carbs, fat: f.fat },
      micros: {},
    });
    h.impact("light");
    toast.success(`${f.name} logged to ${f.type}`);
  };

  const logCustomFood = async (f: FoodItem) => {
    const s = scaleFromServing(f);
    await addMeal({
      name: f.name,
      type: mealType,
      calories: s.calories,
      macros: { protein: s.protein, carbs: s.carbs, fat: s.fat },
      micros: {},
    });
    h.impact("light");
    toast.success(`${f.name} (${grams} g) logged to ${mealType}`);
  };

  const removeCustomFood = async (f: FoodItem) => {
    if (!user?.uid) return;
    await deleteCustomFood(user.uid, f.id);
    setMyFoods((prev) => prev.filter((x) => x.id !== f.id));
    h.impact("light");
    toast.info("Custom food removed");
  };

  const logCustomExercise = async (e: Exercise) => {
    await addWorkout({
      name: e.name,
      type: "strength",
      duration: 30,
      caloriesBurned: 150,
    });
    h.impact("light");
    toast.success(`${e.name} (30m / 150 kcal) logged`);
  };

  const removeCustomExercise = async (e: Exercise) => {
    if (!user?.uid) return;
    await deleteCustomExercise(user.uid, e.id);
    setMyExercises((prev) => prev.filter((x) => x.id !== e.id));
    h.impact("light");
    toast.info("Exercise removed");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Library</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        Favorites, your custom foods, and your saved exercises.
      </Text>

      <View style={{ marginTop: 12 }}>
        <Segmented
          items={[
            { label: "Favorites", value: "favorites" },
            { label: "My Foods", value: "foods" },
            { label: "My Exercises", value: "exercises" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
        />
      </View>

      {tab === "favorites" && (
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Favorites
          </Text>
          {favorites.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              You haven’t saved any favorites yet.
            </Text>
          ) : (
            favorites.map((f) => (
              <View
                key={f.id}
                style={[
                  styles.itemRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>
                    {f.name}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>
                    {f.type} • {Math.round(f.calories)} kcal • P{f.protein} C{f.carbs} F{f.fat}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.logBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => logFavorite(f)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.logBtnText}>Log</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
      )}

      {tab === "foods" && (
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My Foods
          </Text>

          <View style={styles.controlsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Portion (g)
              </Text>
              <TextInput
                style={[
                  styles.gramInput,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={String(grams)}
                keyboardType="numeric"
                onChangeText={(t) => {
                  const v = Number(String(t).replace(/[^\d]/g, ""));
                  if (Number.isFinite(v) && v > 0) setGrams(Math.min(1500, v));
                }}
                placeholder="grams"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Meal type
              </Text>
              <Segmented
                items={[
                  { label: "Breakfast", value: "breakfast" },
                  { label: "Lunch", value: "lunch" },
                  { label: "Dinner", value: "dinner" },
                  { label: "Snack", value: "snack" },
                ]}
                value={mealType}
                onChange={(v) => setMealType(v as MealType)}
              />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
            {gramChips.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGrams(g)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  {g}g
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {myFoods.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              You haven’t added any custom foods yet.
            </Text>
          ) : (
            myFoods.map((f) => {
              const s = scaleFromServing(f);
              return (
                <View
                  key={f.id}
                  style={[
                    styles.itemRow,
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: theme.colors.text }]}>
                      {f.name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted }}>
                      Base: {f.serving} • {grams} g → {s.calories} kcal • P{s.protein} C{s.carbs} F{s.fat}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={() => logCustomFood(f)}
                  >
                    <Text style={styles.smallBtnText}>Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: "#FF6B6B" }]}
                    onPress={() =>
                      Alert.alert("Delete", "Remove this custom food?", [
                        { text: "Cancel" },
                        { text: "Delete", style: "destructive", onPress: () => removeCustomFood(f) },
                      ])
                    }
                  >
                    <Text style={styles.smallBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </Card>
      )}

      {tab === "exercises" && (
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My Exercises
          </Text>
          {myExercises.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              You haven’t saved any custom exercises yet.
            </Text>
          ) : (
            myExercises.map((e) => (
              <View
                key={e.id}
                style={[
                  styles.itemRow,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>
                    {e.name}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>
                    {e.category || "General"} • {(e.equipment || []).join(", ") || "Bodyweight"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => logCustomExercise(e)}
                >
                  <Text style={styles.smallBtnText}>Log</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: "#FF6B6B" }]}
                  onPress={() =>
                    Alert.alert("Delete", "Remove this custom exercise?", [
                      { text: "Cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => removeCustomExercise(e),
                      },
                    ])
                  }
                >
                  <Text style={styles.smallBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold },
  subtitle: { fontFamily: fonts.regular, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 8 },
  controlsRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 8 },
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  itemName: { fontSize: 16, fontFamily: fonts.semiBold },
  logBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  logBtnText: { color: "#fff", fontFamily: fonts.semiBold },
  smallBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  smallBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  gramInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
});