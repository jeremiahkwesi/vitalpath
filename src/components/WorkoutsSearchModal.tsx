// src/components/WorkoutsSearchModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  FlatList,
  ListRenderItemInfo,
} from "react-native";
import {
  searchExercises,
  Exercise,
  addCustomExercise,
} from "../services/workoutsDb";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { SkeletonRow } from "../ui/components/Skeleton";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";

type Props = { visible: boolean; onClose: () => void };

const ROW_HEIGHT = 84;

export default function WorkoutsSearchModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Exercise[]>([]);
  const { user } = useAuth();
  const { addWorkout } = useActivity();

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
        const data = await searchExercises(q, { uid: user?.uid, limit: 50 });
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

  const quickAdd = useCallback(
    async (e: Exercise) => {
      await addWorkout({
        name: e.name,
        type: "strength",
        duration: 20,
        caloriesBurned: 100,
      });
      h.impact("light");
      toast.success(`${e.name} added (20m / 100 kcal)`);
    },
    [addWorkout, h, toast]
  );

  const saveToMyExercises = useCallback(
    async (e: Exercise) => {
      if (!user?.uid) {
        toast.error("Sign in required");
        return;
      }
      await addCustomExercise(user.uid, {
        name: e.name,
        category: e.category,
        equipment: e.equipment,
        primaryMuscles: e.primaryMuscles,
        secondaryMuscles: e.secondaryMuscles,
        description: e.description,
      });
      h.impact("light");
      toast.info(`${e.name} saved to My Exercises`);
    },
    [h, toast, user?.uid]
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);
  const getItemLayout = useCallback(
    (_: Exercise[] | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Exercise>) => (
      <View
        style={[
          styles.row,
          { borderBottomColor: theme.colors.border, minHeight: ROW_HEIGHT },
        ]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Exercise: ${item.name}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {item.category || "General"} • {(item.equipment || []).slice(0, 2).join(", ") || "Bodyweight"}
          </Text>
          {!!item.description && (
            <Text numberOfLines={2} style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {item.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={[styles.btn, { backgroundColor: theme.colors.primary }]}
          onPress={() => quickAdd(item)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name}`}
        >
          <Text style={styles.btnText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={[styles.btn, { backgroundColor: "#7E57C2" }]}
          onPress={() => saveToMyExercises(item)}
          accessibilityRole="button"
          accessibilityLabel={`Save ${item.name} to My Exercises`}
        >
          <Text style={styles.btnText}>Save</Text>
        </TouchableOpacity>
      </View>
    ),
    [quickAdd, saveToMyExercises, theme.colors.border, theme.colors.primary, theme.colors.text, theme.colors.textMuted]
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
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Search Exercises
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close exercises search">
              <Text style={[styles.link, { color: theme.colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="Search (e.g., bench, squat, plank)"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus={Platform.OS !== "web"}
            accessibilityLabel="Search exercises"
          />

          {loading ? (
            <View style={{ paddingVertical: 8 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : results.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              Try common exercises (bench press, squat, pull-up…)
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
              contentContainerStyle={{ paddingBottom: 8 }}
              style={{ maxHeight: "72%" }}
              accessibilityLabel="Exercises results"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88%", padding: 16, borderTopWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, alignItems: "center" },
  title: { fontSize: 18, fontFamily: fonts.semiBold },
  link: { fontFamily: fonts.semiBold },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontFamily: fonts.regular },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  name: { fontSize: 16, fontFamily: fonts.semiBold },
  btn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "center" },
  btnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
});