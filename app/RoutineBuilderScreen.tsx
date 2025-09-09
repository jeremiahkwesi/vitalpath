import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/context/AuthContext";
import { saveRoutine } from "../src/services/routines";
import Select from "../src/ui/components/Select";
import { generateWorkoutRoutineLocal } from "../src/services/aiPlans";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
const DAYS: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SET_TYPES = [
  { label: "Normal", value: "normal" },
  { label: "Superset", value: "superset" },
  { label: "Drop set", value: "dropset" },
  { label: "Pyramid", value: "pyramid" },
  { label: "AMRAP", value: "amrap" },
  { label: "Timed", value: "timed" },
] as const;

type DraftSet = {
  reps?: string;
  restSec: number;
  type: (typeof SET_TYPES)[number]["value"];
};
type DraftItem = {
  externalId?: string;
  name: string;
  day: Day;
  groupId?: string;
  sets: DraftSet[];
};

export default function RoutineBuilderScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const [name, setName] = useState("My Workout");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<Day>(
    DAYS[new Date().getDay()] || "Mon"
  );

  const [showAI, setShowAI] = useState(false);
  const [aiDays, setAIDays] = useState("3");
  const [aiGoal, setAIGoal] = useState("hypertrophy");
  const [aiLevel, setAILevel] = useState("beginner");
  const [aiSession, setAISession] = useState("60");
  const [aiEquip, setAIEquip] = useState<string[]>([
    "Barbell",
    "Dumbbell",
    "Bodyweight",
  ]);
  const [aiFocus, setAIFocus] = useState("full_body");
  const [busy, setBusy] = useState(false);

  const draftKey = user?.uid
    ? `routine:draft:${user.uid}`
    : "routine:draft:anon";

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.name) setName(parsed.name);
          if (Array.isArray(parsed.items)) setItems(parsed.items);
        }
      } catch {}
    })();
  }, [draftKey]);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(draftKey);
          if (!active || !raw) return;
          const parsed = JSON.parse(raw);
          if (parsed.name) setName(parsed.name);
          if (Array.isArray(parsed.items)) setItems(parsed.items);
        } catch {}
      })();
      return () => {
        active = false;
      };
    }, [draftKey])
  );

  useFocusEffect(
    React.useCallback(() => {
      const ex = route.params?.addExercise as
        | { id?: string; name: string }
        | undefined;
      if (ex && ex.name) {
        setItems((s) => [
          ...s,
          {
            externalId: ex.id ? String(ex.id) : undefined,
            name: ex.name,
            day: selectedDay,
            sets: [{ reps: "8-12", restSec: 90, type: "normal" }],
          },
        ]);
        navigation.setParams({ addExercise: undefined });
      }
      if (route.params?.openAI) {
        setShowAI(true);
        navigation.setParams({ openAI: undefined });
      }
      return () => {};
    }, [route.params?.addExercise, route.params?.openAI, navigation, selectedDay])
  );

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(draftKey, JSON.stringify({ name, items }));
      } catch {}
    })();
  }, [name, items, draftKey]);

  const addExercise = () => navigation.navigate("Programs");

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((s) => {
      const next = [...s];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  const removeItem = (idx: number) =>
    setItems((s) => {
      const next = [...s];
      next.splice(idx, 1);
      return next;
    });
  const duplicateItem = (idx: number) =>
    setItems((s) => {
      const next = [...s];
      const dup = JSON.parse(JSON.stringify(next[idx])) as DraftItem;
      dup.groupId = next[idx]?.groupId;
      next.splice(idx + 1, 0, dup);
      return next;
    });

  const addSet = (idx: number) =>
    setItems((s) => {
      const next = [...s];
      next[idx].sets = [
        ...next[idx].sets,
        { reps: "8-12", restSec: 90, type: "normal" },
      ];
      return next;
    });
  const updateSet = (idx: number, sIdx: number, patch: Partial<DraftSet>) =>
    setItems((s) => {
      const next = [...s];
      const sets = [...next[idx].sets];
      sets[sIdx] = { ...sets[sIdx], ...patch };
      next[idx].sets = sets;
      return next;
    });
  const removeSet = (idx: number, sIdx: number) =>
    setItems((s) => {
      const next = [...s];
      const sets = [...next[idx].sets];
      sets.splice(sIdx, 1);
      next[idx].sets = sets;
      return next;
    });

  const clearAll = () => {
    Alert.alert("Clear workout", "Remove all exercises?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => setItems([]),
      },
    ]);
  };

  const onSave = async () => {
    if (!user?.uid)
      return Alert.alert("Sign in", "Please sign in to save workouts.");
    if (!name.trim()) return Alert.alert("Name", "Enter a workout name.");
    if (!items.length)
      return Alert.alert("Empty", "Add at least one exercise.");
    setBusy(true);
    try {
      await saveRoutine(user.uid, {
        name: name.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: items.map((it) => ({
          externalId: it.externalId,
          name: it.name,
          day: it.day,
          groupId: it.groupId,
          sets: it.sets.map((s) => ({
            reps: s.reps,
            restSec: Math.max(0, Number(s.restSec || 0)),
            type: s.type,
          })),
        })),
      });
      await AsyncStorage.removeItem(draftKey);
      Alert.alert("Saved", "Workout saved.");
    } catch {
      Alert.alert("Error", "Failed to save workout.");
    } finally {
      setBusy(false);
    }
  };

  const startSession = (day?: Day) => {
    if (!items.length)
      return Alert.alert("Empty", "Add at least one exercise.");
    const perDay = day ? items.filter((i) => i.day === day) : items;
    if (!perDay.length)
      return Alert.alert("No items", `No exercises for ${day || selectedDay}.`);
    navigation.navigate("WorkoutSession", { workout: { name, items: perDay } });
  };

  const generateAI = async () => {
    setBusy(true);
    try {
      const draft = await generateWorkoutRoutineLocal({
        daysPerWeek: Math.max(2, Math.min(6, parseInt(aiDays, 10) || 3)),
        goal: aiGoal as any,
        experience: aiLevel as any,
        sessionLengthMin: Math.max(
          30,
          Math.min(120, parseInt(aiSession, 10) || 60)
        ),
        equipment: aiEquip,
        focus: aiFocus as any,
      });
      setItems(
        draft.items.map((d: any) => ({
          name: d.name,
          day: d.day as Day,
          groupId: d.groupId,
          sets: d.sets.map((s: any) => ({
            reps: s.reps,
            restSec: s.restSec,
            type: s.type,
          })),
        }))
      );
      setName(draft.name || "My Workout");
      setShowAI(false);
    } catch (e: any) {
      Alert.alert("AI Builder", e?.message || "Failed to generate routine.");
    } finally {
      setBusy(false);
    }
  };
  const isSelected = (val: string) => aiEquip.includes(val);
  const toggleEquip = (val: string) =>
    setAIEquip((s) =>
      isSelected(val) ? s.filter((v) => v !== val) : [...s, val]
    );

  const dayGroups = useMemo(() => {
    const map = new Map<Day, DraftItem[]>();
    for (const d of DAYS) map.set(d, []);
    for (const it of items) {
      const arr = map.get(it.day) || [];
      arr.push(it);
      map.set(it.day, arr);
    }
    return DAYS.map((d) => ({ day: d, items: map.get(d) || [] }));
  }, [items]);

  const selectedList = useMemo(
    () => dayGroups.find((g) => g.day === selectedDay)?.items || [],
    [dayGroups, selectedDay]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.appBg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Workout Builder
        </Text>

        {/* Day tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 8 }}
        >
          {DAYS.map((d) => {
            const active = selectedDay === d;
            const count =
              dayGroups.find((g) => g.day === d)?.items.length || 0;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDay(d)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: active
                    ? theme.colors.primary
                    : theme.colors.surface2,
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : theme.colors.text,
                    fontFamily: fonts.semiBold,
                  }}
                >
                  {d} {count ? `(${count})` : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Header / controls */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Workout name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Upper/Lower Split"
            placeholderTextColor={theme.colors.textMuted}
          />

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <TouchableOpacity
              onPress={addExercise}
              style={[
                styles.btn,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text
                style={{ color: "#fff", fontFamily: fonts.semiBold }}
              >
                Add exercise
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAI(true)}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
              >
                Generate with AI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => startSession(selectedDay)}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
              >
                Start {selectedDay}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              disabled={busy}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  opacity: busy ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
              >
                {busy ? "Saving..." : "Save routine"}
              </Text>
            </TouchableOpacity>
            {!!items.length && (
              <TouchableOpacity
                onPress={clearAll}
                style={[styles.btn, { backgroundColor: "#FF6B6B" }]}
              >
                <Text
                  style={{ color: "#fff", fontFamily: fonts.semiBold }}
                >
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Items for selected day */}
        {!selectedList.length ? (
          <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
            No exercises for {selectedDay}. Use “Add exercise” or
            “Generate with AI”.
          </Text>
        ) : (
          selectedList.map((it) => {
            const globalIdx = items.indexOf(it);
            return (
              <View
                key={`${it.name}-${globalIdx}-${it.day}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.exercise, { color: theme.colors.text }]}
                >
                  {it.name} {it.groupId ? `• Group ${it.groupId}` : ""}
                </Text>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Select
                      label="Training day"
                      value={it.day}
                      items={DAYS.map((d) => ({ label: d, value: d }))}
                      onChange={(v) =>
                        updateItem(globalIdx, { day: v as Day })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Select
                      label="Default set type"
                      value={it.sets[0]?.type || "normal"}
                      items={[...SET_TYPES]}
                      onChange={(v) =>
                        updateItem(globalIdx, {
                          sets: it.sets.map((s) => ({ ...s, type: v as any })),
                        })
                      }
                    />
                  </View>
                </View>

                <Text
                  style={[styles.setsTitle, { color: theme.colors.text }]}
                >
                  Sets
                </Text>
                {it.sets.map((s, sIdx) => (
                  <View
                    key={`set-${sIdx}`}
                    style={[
                      styles.setRow,
                      { borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.small,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Reps
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          },
                        ]}
                        value={s.reps ?? ""}
                        onChangeText={(t) =>
                          updateSet(globalIdx, sIdx, { reps: t })
                        }
                        placeholder="e.g., 8-12 or 10"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.small,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Rest (sec)
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: theme.colors.surface2,
                            borderColor: theme.colors.border,
                            color: theme.colors.text,
                          },
                        ]}
                        value={String(s.restSec)}
                        onChangeText={(t) =>
                          updateSet(globalIdx, sIdx, {
                            restSec: Math.max(
                              0,
                              parseInt(t || "0", 10)
                            ),
                          })
                        }
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Select
                        label="Set type"
                        value={s.type}
                        items={[...SET_TYPES]}
                        onChange={(v) =>
                          updateSet(globalIdx, sIdx, { type: v as any })
                        }
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeSet(globalIdx, sIdx)}
                      style={[
                        styles.smallBtn,
                        {
                          backgroundColor: theme.colors.surface2,
                          borderColor: theme.colors.border,
                          alignSelf: "flex-end",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontFamily: fonts.semiBold,
                        }}
                      >
                        Remove set
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => addSet(globalIdx)}
                    style={[
                      styles.addSetBtn,
                      {
                        backgroundColor: theme.colors.surface2,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: fonts.semiBold,
                      }}
                    >
                      + Add set
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => duplicateItem(globalIdx)}
                    style={[
                      styles.addSetBtn,
                      {
                        backgroundColor: theme.colors.surface2,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: fonts.semiBold,
                      }}
                    >
                      Duplicate exercise
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeItem(globalIdx)}
                    style={[
                      styles.removeBtn,
                      {
                        backgroundColor: theme.colors.surface2,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: fonts.semiBold,
                      }}
                    >
                      Remove exercise
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* AI Modal */}
        <Modal visible={showAI} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.35)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                padding: 16,
                maxHeight: "88%",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  AI Routine Builder
                </Text>
                <TouchableOpacity onPress={() => setShowAI(false)}>
                  <Text
                    style={{
                      color: theme.colors.primary,
                      fontFamily: fonts.semiBold,
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Select
                  label="Goal"
                  value={aiGoal}
                  items={[
                    { label: "Hypertrophy", value: "hypertrophy" },
                    { label: "Strength", value: "strength" },
                    { label: "Fat loss", value: "fat_loss" },
                    { label: "General fitness", value: "general" },
                  ]}
                  onChange={(v) => setAIGoal(v as string)}
                />
                <Select
                  label="Experience"
                  value={aiLevel}
                  items={[
                    { label: "Beginner", value: "beginner" },
                    { label: "Intermediate", value: "intermediate" },
                    { label: "Advanced", value: "advanced" },
                  ]}
                  onChange={(v) => setAILevel(v as string)}
                />
                <Select
                  label="Days per week"
                  value={aiDays}
                  items={[
                    { label: "3", value: "3" },
                    { label: "4", value: "4" },
                    { label: "5", value: "5" },
                    { label: "6", value: "6" },
                  ]}
                  onChange={(v) => setAIDays(v as string)}
                />
                <Select
                  label="Focus"
                  value={aiFocus}
                  items={[
                    { label: "Full body", value: "full_body" },
                    { label: "Upper / Lower", value: "upper_lower" },
                    { label: "Push / Pull / Legs", value: "ppl" },
                    { label: "Body-part emphasis", value: "emphasis" },
                  ]}
                  onChange={(v) => setAIFocus(v as string)}
                />
                <Text
                  style={[styles.small, { color: theme.colors.textMuted }]}
                >
                  Session length (minutes)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={aiSession}
                  onChangeText={setAISession}
                  keyboardType="numeric"
                />
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: fonts.semiBold,
                    marginTop: 8,
                  }}
                >
                  Available equipment
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  {[
                    "Barbell",
                    "Dumbbell",
                    "Machines",
                    "Kettlebell",
                    "Bands",
                    "Bodyweight",
                  ].map((e) => {
                    const active = isSelected(e);
                    return (
                      <TouchableOpacity
                        key={e}
                        onPress={() => toggleEquip(e)}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          backgroundColor: active
                            ? theme.colors.primary
                            : theme.colors.surface2,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? "#fff" : theme.colors.text,
                            fontFamily: fonts.semiBold,
                          }}
                        >
                          {e}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={generateAI}
                  disabled={busy}
                  style={[
                    styles.apply,
                    {
                      backgroundColor: theme.colors.primary,
                      marginTop: 12,
                      opacity: busy ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{ color: "#fff", fontFamily: fonts.semiBold }}
                  >
                    {busy ? "Generating…" : "Generate Routine"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
  },
  exercise: { fontFamily: fonts.semiBold, fontSize: 14, marginBottom: 6 },
  setsTitle: { fontFamily: fonts.semiBold, marginTop: 8, marginBottom: 6 },
  small: { fontFamily: fonts.regular, fontSize: 12 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  smallBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addSetBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  removeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  apply: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  setRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
});