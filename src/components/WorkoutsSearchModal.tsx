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
  SectionList,
  ListRenderItemInfo,
  FlatList,
} from "react-native";
import {
  searchExercises,
  Exercise,
  groupByPrimaryMuscle,
  getHowToSteps,
  addCustomExercise,
  appendExerciseToRoutineDraft,
  ALL_MUSCLE_GROUPS,
} from "../services/workoutsDb";
import { useAuth } from "../context/AuthContext";
import { useActivity } from "../context/ActivityContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";
import {
  getExerciseFavorites,
  toggleExerciseFavorite,
} from "../utils/exerciseFavorites";
import { Ionicons } from "@expo/vector-icons";

type Props = { visible: boolean; onClose: () => void };

const ROW_HEIGHT = 64;

export default function WorkoutsSearchModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();
  const { user } = useAuth();
  const { addWorkout } = useActivity();

  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Exercise[]>([]);
  const [favNames, setFavNames] = useState<string[]>([]);

  const uid = user?.uid || null;

  // Reset when opened
  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setSelectedGroup("All");
    setResults([]);
  }, [visible]);

  useEffect(() => {
    (async () => {
      const favs = await getExerciseFavorites(uid);
      setFavNames(favs.map((f) => f.name.toLowerCase()));
    })();
  }, [uid]);

  // Query-based search (overrides group)
  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = query.trim();
      if (!q) {
        // If no query, do not override group-driven results
        return;
      }
      setLoading(true);
      try {
        const data = await searchExercises(q, { limit: 200 });
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
  }, [query]);

  // Group-based browse (Hevy style). Only fires if there is no query.
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (query.trim()) return; // query overrides
      if (selectedGroup === "All") {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        // Use group name as query to pull matching exercises
        const data = await searchExercises(selectedGroup, { limit: 250 });
        if (active) setResults(data);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [selectedGroup, query]);

  const sections = useMemo(
    () => (query.trim() ? groupByPrimaryMuscle(results) : []),
    [query, results]
  );

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

  const saveToMy = useCallback(
    async (e: Exercise) => {
      if (!user?.uid) return toast.error("Sign in required");
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

  const addToBuilder = useCallback(
    async (e: Exercise) => {
      await appendExerciseToRoutineDraft(uid, e);
      h.impact("light");
      toast.success(`${e.name} added to Builder`);
      onClose();
    },
    [h, onClose, toast, uid]
  );

  const toggleFav = useCallback(
    async (e: Exercise) => {
      const nowFav = await toggleExerciseFavorite(uid, {
        name: e.name,
        id: e.id,
      });
      const next = await getExerciseFavorites(uid);
      setFavNames(next.map((f) => f.name.toLowerCase()));
      toast.info(nowFav ? "Added to favorites" : "Removed from favorites");
    },
    [toast, uid]
  );

  const renderRow = useCallback(
    (item: Exercise) => {
      const muscles = [
        ...(item.primaryMuscles || []),
        ...(item.secondaryMuscles || []),
      ];
      const steps = getHowToSteps(item).slice(0, 2);
      const fav = favNames.includes(item.name.toLowerCase());
      return (
        <View
          key={item.id}
          style={[styles.row, { borderBottomColor: theme.colors.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.name, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <Text
              style={{ color: theme.colors.textMuted, fontSize: 12 }}
              numberOfLines={2}
            >
              {muscles.length
                ? muscles.join(", ")
                : "Target: General / Bodyweight"}
            </Text>
            {steps.length > 0 && (
              <Text
                style={{ color: theme.colors.textMuted, fontSize: 12 }}
                numberOfLines={2}
              >
                {steps.map((s, i) => `${i + 1}. ${s}`).join("  ")}
              </Text>
            )}
          </View>
          <View style={{ gap: 6, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => toggleFav(item)}
              accessibilityLabel="Toggle favorite"
            >
              <Ionicons
                name={fav ? "star" : "star-outline"}
                size={20}
                color={fav ? "#F4C20D" : theme.colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
              onPress={() => quickAdd(item)}
            >
              <Text style={styles.btnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#455A64" }]}
              onPress={() => addToBuilder(item)}
            >
              <Text style={styles.btnText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#7E57C2" }]}
              onPress={() => saveToMy(item)}
            >
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      addToBuilder,
      favNames,
      quickAdd,
      saveToMy,
      theme.colors.border,
      theme.colors.primary,
      theme.colors.text,
      theme.colors.textMuted,
      toggleFav,
    ]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Exercise>) => renderRow(item),
    [renderRow]
  );

  const GroupChip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: theme.colors.border,
          backgroundColor: active ? theme.colors.primary : theme.colors.surface2,
        },
      ]}
    >
      <Text
        style={{
          color: active ? "#fff" : theme.colors.text,
          fontFamily: fonts.semiBold,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.link, { color: theme.colors.primary }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          {/* Query input */}
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
          />

          {/* Hevy-like muscle group chips */}
          <FlatList
            data={["All", ...ALL_MUSCLE_GROUPS]}
            horizontal
            keyExtractor={(g) => g}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
            renderItem={({ item: g }) => (
              <GroupChip
                label={g}
                active={selectedGroup === g && !query.trim()}
                onPress={() => {
                  setSelectedGroup(g);
                  // Clear previous results if switching group without query
                  if (!query.trim()) setResults([]);
                }}
              />
            )}
            style={{ marginBottom: 6 }}
          />

          {loading ? (
            <Text style={{ color: theme.colors.textMuted }}>Searching…</Text>
          ) : query.trim() ? (
            // Query mode: show grouped sections
            sections.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted }}>
                Try “bench press”, “squat”, “plank”…
              </Text>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={({ section }) => (
                  <Text
                    style={[
                      styles.sectionHeader,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {section.title}
                  </Text>
                )}
                stickySectionHeadersEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                style={{ maxHeight: "70%" }}
              />
            )
          ) : selectedGroup !== "All" ? (
            // Group-only mode: show a clean, flat list for that muscle group
            results.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted }}>
                No exercises found for {selectedGroup}.
              </Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(i) => i.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                style={{ maxHeight: "70%" }}
              />
            )
          ) : (
            // Nothing selected and no query
            <Text style={{ color: theme.colors.textMuted }}>
              Select a muscle group or type to search.
            </Text>
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
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontFamily: fonts.regular },
  sectionHeader: { fontFamily: fonts.semiBold, marginTop: 12, marginBottom: 6 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 1, gap: 10, minHeight: ROW_HEIGHT },
  name: { fontSize: 16, fontFamily: fonts.semiBold },
  btn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 80 },
  btnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
});