// app/ProgramsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  SectionList,
  ListRenderItemInfo,
  Switch,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useNavigation } from "@react-navigation/native";
import {
  searchExercises,
  Exercise,
  groupByPrimaryMuscle,
  getHowToSteps,
  appendExerciseToRoutineDraft,
} from "../src/services/workoutsDb";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";
import { useAuth } from "../src/context/AuthContext";
import {
  getExerciseFavorites,
  toggleExerciseFavorite,
} from "../src/utils/exerciseFavorites";
import { Ionicons } from "@expo/vector-icons";

export default function ProgramsScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const toast = useToast();
  const h = useHaptics();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Exercise[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favNames, setFavNames] = useState<string[]>([]);

  const uid = user?.uid || null;

  useEffect(() => {
    (async () => {
      const favs = await getExerciseFavorites(uid);
      setFavNames(favs.map((f) => f.name.toLowerCase()));
    })();
  }, [uid]);

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
        const data = await searchExercises(q, { limit: 120 });
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

  const filtered = useMemo(() => {
    if (!favoritesOnly) return results;
    if (!favNames.length) return [];
    return results.filter((e) => favNames.includes(e.name.toLowerCase()));
  }, [results, favoritesOnly, favNames]);

  const sections = useMemo(() => groupByPrimaryMuscle(filtered), [filtered]);

  const addToBuilder = useCallback(
    async (e: Exercise) => {
      await appendExerciseToRoutineDraft(uid, e);
      h.impact("light");
      toast.success(`${e.name} added to Builder`);
      nav.navigate("RoutineBuilder", { addExercise: { id: e.id, name: e.name } });
    },
    [h, nav, toast, uid]
  );

  const onToggleFav = useCallback(
    async (e: Exercise) => {
      const nowFav = await toggleExerciseFavorite(uid, { name: e.name, id: e.id });
      const next = await getExerciseFavorites(uid);
      setFavNames(next.map((f) => f.name.toLowerCase()));
      toast.info(nowFav ? "Added to favorites" : "Removed from favorites");
    },
    [toast, uid]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Exercise>) => {
      const muscles = [...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])];
      const steps = getHowToSteps(item).slice(0, 3);
      const fav = favNames.includes(item.name.toLowerCase());
      return (
        <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
              {muscles.length ? muscles.join(", ") : "Target: General / Bodyweight"}
            </Text>
            {steps.length > 0 && (
              <View style={{ marginTop: 4 }}>
                {steps.map((s, i) => (
                  <Text key={i} style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                    {i + 1}. {s}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <View style={{ gap: 6, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => onToggleFav(item)}
              accessibilityLabel="Toggle favorite"
            >
              <Ionicons name={fav ? "star" : "star-outline"} size={20} color={fav ? "#F4C20D" : theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.colors.primary }]}
              onPress={() => addToBuilder(item)}
            >
              <Text style={styles.btnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [addToBuilder, onToggleFav, favNames, theme.colors.border, theme.colors.primary, theme.colors.text, theme.colors.textMuted]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Browse Exercises</Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Grouped by target muscle. Star to favorite. Add to Builder.
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, flex: 1 },
          ]}
          placeholder="Search (e.g., bench, squat, plank)"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus={Platform.OS !== "web"}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: theme.colors.text }}>Favorites</Text>
          <Switch value={favoritesOnly} onValueChange={setFavoritesOnly} />
        </View>
      </View>

      {loading ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>Searching…</Text>
      ) : sections.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          {query ? "No matches." : "Try “bench press”, “squat”, “plank”…"}
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionHeader, { color: theme.colors.textMuted }]}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
  sectionHeader: { fontFamily: fonts.semiBold, marginTop: 12, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  name: { fontSize: 16, fontFamily: fonts.semiBold },
  btn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", minWidth: 80 },
  btnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
});