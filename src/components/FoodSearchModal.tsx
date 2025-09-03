// src/components/FoodSearchModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  FlatList,
  ListRenderItemInfo,
  ViewToken,
} from "react-native";
import { colors as baseColors } from "../constants/colors";
import { fonts } from "../constants/fonts";
import {
  searchFoods,
  FoodItem,
  addCustomFood,
} from "../services/foodDb";
import { useActivity } from "../context/ActivityContext";
import { useAuth } from "../context/AuthContext";
import { addFavorite } from "../utils/favorites";
import Segmented from "../ui/components/Segmented";
import { useTheme } from "../ui/ThemeProvider";
import { SkeletonRow } from "../ui/components/Skeleton";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";

type Props = { visible: boolean; onClose: () => void };
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const ROW_HEIGHT = 64;

export default function FoodSearchModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [grams, setGrams] = useState<number>(200);

  const { addMeal } = useActivity();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await searchFoods(q, { uid: user?.uid, limit: 50 });
        if (active) setResults(data);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, user?.uid]);

  const parseGramsFromServing = (s?: string | null): number | null => {
    if (!s) return null;
    const m = String(s).match(/(\d+(\.\d+)?)\s*g/i);
    return m ? Math.round(parseFloat(m[1])) : null;
  };

  const scale = useCallback(
    (f: Pick<FoodItem, "calories" | "protein" | "carbs" | "fat" | "serving">) => {
      const baseG = parseGramsFromServing(f.serving) ?? 100;
      const r = grams > 0 ? grams / baseG : 1;
      return {
        calories: Math.round((f.calories || 0) * r),
        protein: Math.round((f.protein || 0) * r),
        carbs: Math.round((f.carbs || 0) * r),
        fat: Math.round((f.fat || 0) * r),
      };
    },
    [grams]
  );

  const onAddFood = useCallback(
    async (f: FoodItem) => {
      const s = scale(f);
      await addMeal({
        name: f.name,
        type: mealType,
        calories: s.calories,
        macros: { protein: s.protein, carbs: s.carbs, fat: s.fat },
        micros: {},
      });
      h.impact("light");
      toast.success(`${f.name} (${grams} g) added to ${mealType}`);
    },
    [addMeal, grams, h, mealType, scale, toast]
  );

  const onSaveFav = useCallback(
    async (f: FoodItem) => {
      if (!user?.uid) return;
      const s = scale(f);
      await addFavorite(user.uid, {
        id: `${f.id}_${grams}g`,
        name: `${f.name} (${grams} g)`,
        calories: s.calories,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
        type: mealType,
      });
      h.impact("light");
      toast.info(`${f.name} saved to Favorites`);
    },
    [grams, h, mealType, scale, toast, user?.uid]
  );

  const onSaveMyFood = useCallback(
    async (f: FoodItem) => {
      if (!user?.uid) {
        toast.error("Sign in required to save foods");
        return;
      }
      await addCustomFood(user.uid, {
        name: f.name,
        brand: f.brand,
        serving: f.serving,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        barcode: f.barcode,
      });
      h.impact("light");
      toast.success(`${f.name} saved to My Foods`);
    },
    [h, toast, user?.uid]
  );

  const gramsChips = useMemo(() => [100, 150, 200, 250, 300, 400], []);

  const keyExtractor = useCallback((item: FoodItem) => item.id, []);
  const getItemLayout = useCallback(
    (_: FoodItem[] | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FoodItem>) => {
      const s = scale(item);
      return (
        <View
          style={[
            styles.rowItem,
            { borderBottomColor: theme.colors.border, height: ROW_HEIGHT },
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Food: ${item.name}. ${grams} grams equals ${s.calories} kilocalories.`}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.foodName, { color: theme.colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.foodMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {item.serving} (base) • {grams} g → {s.calories} kcal • P{s.protein} C{s.carbs} F{s.fat}
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={[styles.btn, { backgroundColor: theme.colors.primary }]}
            onPress={() => onAddFood(item)}
            accessibilityLabel={`Add ${item.name} to ${mealType}`}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={[styles.btn, { backgroundColor: "#FFA726" }]}
            onPress={() => onSaveFav(item)}
            accessibilityLabel={`Save ${item.name} to favorites`}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>★</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={[styles.btn, { backgroundColor: "#7E57C2" }]}
            onPress={() => onSaveMyFood(item)}
            accessibilityLabel={`Save ${item.name} to My Foods`}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [grams, mealType, onAddFood, onSaveFav, onSaveMyFood, scale, theme.colors.border, theme.colors.primary, theme.colors.text, theme.colors.textMuted]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Search Foods</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close food search">
              <Text style={[styles.close, { color: theme.colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
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

          <View style={styles.row}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="Search (e.g., chicken, rice, egg)"
              placeholderTextColor={theme.colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus={Platform.OS !== "web"}
              accessibilityLabel="Search foods"
              accessibilityHint="Type to search foods by name"
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Portion (g)</Text>
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
              accessibilityLabel="Portion in grams"
            />
            <FlatList
              data={gramsChips}
              keyExtractor={(g) => `g-${g}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item: g }) => (
                <TouchableOpacity
                  onPress={() => setGrams(g)}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Set portion to ${g} grams`}
                >
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>{g}g</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Results */}
          {loading ? (
            <View style={{ paddingVertical: 8 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : results.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontFamily: fonts.regular }}>
              Try searching common items (banana, yogurt, oats…)
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              initialNumToRender={12}
              windowSize={8}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              accessibilityLabel="Food search results"
              contentContainerStyle={{ paddingBottom: 8 }}
              style={{ maxHeight: "70%" }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
    padding: 16,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  title: { fontSize: 18, fontFamily: fonts.semiBold },
  close: { fontFamily: fonts.semiBold },
  controls: { marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  label: { fontFamily: fonts.semiBold },
  input: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
  gramInput: {
    width: 100,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    gap: 8,
    paddingVertical: 8,
    minHeight: ROW_HEIGHT,
  },
  foodName: { fontSize: 16, fontFamily: fonts.semiBold },
  foodMeta: { fontSize: 12, marginTop: 2 },
  btn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnText: {
    color: baseColors.white,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});