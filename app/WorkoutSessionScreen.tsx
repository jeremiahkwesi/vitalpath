// app/WorkoutSessionScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import * as Haptics from "expo-haptics";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useActivity } from "../src/context/ActivityContext";
import { searchExercises, getHowToSteps } from "../src/services/workoutsDb";
import { useAuth } from "../src/context/AuthContext";
import { getUnits } from "../src/utils/userSettings";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
type SetType =
  | "normal"
  | "superset"
  | "dropset"
  | "pyramid"
  | "amrap"
  | "timed";
type DraftSet = {
  reps?: string;
  restSec: number;
  type: SetType;
  weight?: number;
  done?: boolean;
  completedAt?: number;
};
type DraftItem = {
  externalId?: string;
  name: string;
  day: Day;
  groupId?: string;
  sets: DraftSet[];
};
type Workout = { name: string; items: DraftItem[] };

function parseRepsToInt(r?: string): number | null {
  if (!r) return null;
  const m = String(r).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function epley1RM(weight?: number, reps?: number | null): number | null {
  if (!weight || !reps || reps <= 0) return null;
  return Math.round(weight * (1 + reps / 30));
}
function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function WorkoutSessionScreen() {
  const { theme } = useTheme();
  const { addWorkoutSession, getLastLift } = useActivity();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const initial = route.params?.workout as Workout;

  const [items, setItems] = useState<DraftItem[]>(initial?.items || []);
  const [sessionName] = useState<string>(initial?.name || "Workout");
  const [startedAt] = useState<number>(Date.now());

  const [unitsLabel, setUnitsLabel] = useState<"kg" | "lb">("kg");

  // per-exercise timers
  const [restTimers, setRestTimers] = useState<Record<string, number>>({});
  const timerRefs = useRef<Record<string, any>>({});

  // last lift hints
  const [lastHints, setLastHints] = useState<
    Record<string, { weight?: number; reps?: string } | null>
  >({});

  // info modal
  const [infoFor, setInfoFor] = useState<{
    name: string;
    steps: string[];
    meta: string;
  } | null>(null);

  const todayDay = useMemo(() => {
    const idx = new Date().getDay();
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx] as Day;
  }, []);

  const todays = useMemo(
    () => (items || []).filter((i) => i.day === todayDay),
    [items, todayDay]
  );
  const displayList = todays.length ? todays : items;

  useEffect(() => {
    let active = true;
    (async () => {
      // load units
      try {
        if (user?.uid) {
          const u = await getUnits(user.uid);
          if (active) setUnitsLabel(u.weight);
        }
      } catch {}
      // last lift hints
      const names = Array.from(new Set(displayList.map((x) => x.name)));
      const pairs = await Promise.all(
        names.map(async (n) => [n, await getLastLift(n)] as const)
      );
      if (!active) return;
      const map: Record<string, any> = {};
      for (const [n, v] of pairs) map[n] = v;
      setLastHints(map);
    })();
    return () => {
      active = false;
    };
  }, [displayList, getLastLift, user?.uid]);

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach((t) => clearInterval(t));
      timerRefs.current = {};
    };
  }, []);

  const startExTimer = (key: string, sec: number) => {
    const s = Math.max(0, Math.round(sec || 0));
    if (timerRefs.current[key]) clearInterval(timerRefs.current[key]);
    setRestTimers((prev) => ({ ...prev, [key]: s }));
    timerRefs.current[key] = setInterval(() => {
      setRestTimers((prev) => {
        const cur = Math.max(0, (prev[key] ?? 0) - 1);
        const next = { ...prev, [key]: cur };
        if (cur <= 0) {
          clearInterval(timerRefs.current[key]);
          delete timerRefs.current[key];
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        }
        return next;
      });
    }, 1000);
  };
  const stopExTimer = (key: string) => {
    if (timerRefs.current[key]) {
      clearInterval(timerRefs.current[key]);
      delete timerRefs.current[key];
    }
    setRestTimers((p) => ({ ...p, [key]: 0 }));
  };

  const markSetDone = (exIdx: number, setIdx: number) => {
    setItems((prev) => {
      const next = prev.map((p) => ({
        ...p,
        sets: p.sets.map((s) => ({ ...s })),
      }));
      const list = todays.length
        ? next.filter((i) => i.day === todayDay)
        : next;
      const src = list[exIdx];
      if (!src) return prev;
      const globalIndex = next.findIndex((i) => i === src);
      if (globalIndex < 0) return prev;
      const targetSet = next[globalIndex].sets?.[setIdx];
      if (!targetSet) return prev;
      targetSet.done = true;
      targetSet.completedAt = Date.now();
      return next;
    });
    const key = String(exIdx);
    const rest =
      (displayList?.[exIdx]?.sets?.[setIdx]?.restSec as number) || 60;
    startExTimer(key, rest);
  };

  const updateSetWeight = (exIdx: number, setIdx: number, weight: number) => {
    setItems((prev) => {
      const clone = prev.map((p) => ({
        ...p,
        sets: p.sets.map((s) => ({ ...s })),
      }));
      const list = todays.length
        ? clone.filter((i) => i.day === todayDay)
        : clone;
      const src = list[exIdx];
      if (!src) return prev;
      const globalIndex = clone.findIndex((i) => i === src);
      if (globalIndex < 0) return prev;
      const v = Number(weight);
      clone[globalIndex].sets[setIdx].weight = Number.isFinite(v)
        ? v
        : undefined;
      return clone;
    });
  };

  const updateSetReps = (exIdx: number, setIdx: number, reps: string) => {
    setItems((prev) => {
      const clone = prev.map((p) => ({
        ...p,
        sets: p.sets.map((s) => ({ ...s })),
      }));
      const list = todays.length
        ? clone.filter((i) => i.day === todayDay)
        : clone;
      const src = list[exIdx];
      if (!src) return prev;
      const globalIndex = clone.findIndex((i) => i === src);
      if (globalIndex < 0) return prev;
      clone[globalIndex].sets[setIdx].reps = reps;
      return clone;
    });
  };

  const finishSession = async () => {
    try {
      const ended = Date.now();
      const durationMin = Math.max(
        1,
        Math.round((ended - startedAt) / 60000)
      );
      const calories = Math.round(durationMin * 6);

      const itemsForSave = (todays.length ? todays : items).map((ex) => ({
        exercise: ex.name,
        groupId: ex.groupId,
        sets: ex.sets.map((s) => ({
          reps: s.reps,
          weight: s.weight,
          restSec: s.restSec,
          type: s.type,
          completedAt: s.completedAt,
        })),
      }));

      await addWorkoutSession({
        name: sessionName,
        duration: durationMin,
        caloriesBurned: calories,
        type: "strength",
        startedAt,
        endedAt: ended,
        items: itemsForSave,
      });

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      nav.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert("Failed to save session.");
    }
  };

  const openInfo = async (name: string) => {
    try {
      const res = await searchExercises(name, { limit: 1 });
      const ex = res[0];
      const steps = ex ? getHowToSteps(ex) : [];
      const meta = ex
        ? `${ex.category || "General"} • ` +
          `${(ex.equipment || []).join(", ") || "Bodyweight"}`
        : "How to not available.";
      setInfoFor({ name, steps, meta });
    } catch {
      setInfoFor({ name, steps: [], meta: "How to not available." });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {sessionName}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Day: {todayDay}
      </Text>

      {!displayList.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          No exercises in this session.
        </Text>
      ) : (
        displayList.map((ex, exIdx) => {
          const key = String(exIdx);
          const rest = restTimers[key] ?? 0;
          const hint = lastHints[ex.name];
          return (
            <View
              key={`${ex.name}-${exIdx}`}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <TouchableOpacity
                  onPress={() => openInfo(ex.name)}
                  style={{ flexShrink: 1 }}
                >
                  <Text
                    style={[styles.exercise, { color: theme.colors.text }]}
                  >
                    {ex.name} {ex.groupId ? `• Group ${ex.groupId}` : ""}
                  </Text>
                </TouchableOpacity>
                {rest > 0 ? (
                  <TouchableOpacity
                    onPress={() => stopExTimer(key)}
                    style={[
                      styles.restBadge,
                      { backgroundColor: theme.colors.surface2 },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: fonts.semiBold,
                      }}
                    >
                      Rest {mmss(rest)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {!!hint && (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Last: {hint.weight != null ? `${hint.weight} ${unitsLabel}` : "—"}{" "}
                  {hint.reps ? `× ${hint.reps}` : ""}
                </Text>
              )}

              {ex.sets.map((s, setIdx) => {
                const repsNum = parseRepsToInt(s.reps);
                const est = epley1RM(s.weight, repsNum);
                return (
                  <View
                    key={`set-${setIdx}`}
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
                          updateSetReps(exIdx, setIdx, t)
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
                        Weight ({unitsLabel})
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
                        value={s.weight != null ? String(s.weight) : ""}
                        onChangeText={(t) =>
                          updateSetWeight(exIdx, setIdx, Number(t))
                        }
                        keyboardType="decimal-pad"
                        placeholder="optional"
                        placeholderTextColor={theme.colors.textMuted}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => markSetDone(exIdx, setIdx)}
                      style={[
                        styles.doneBtn,
                        {
                          backgroundColor: s.done
                            ? "#4CAF50"
                            : theme.colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: fonts.semiBold,
                        }}
                      >
                        {s.done ? "Done ✓" : "Done"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {ex.sets.some((s) => s.weight && parseRepsToInt(s.reps)) && (
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Est. 1RM (best set):{" "}
                  {(() => {
                    const best = ex.sets
                      .map((s) => epley1RM(s.weight, parseRepsToInt(s.reps)))
                      .filter(Boolean) as number[];
                    const val = best.length > 0 ? Math.max(...best) : null;
                    return val ? `${val} ${unitsLabel}` : "—";
                  })()}
                </Text>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity
        onPress={finishSession}
        style={[styles.finishBtn, { backgroundColor: theme.colors.primary }]}
      >
        <Text
          style={{
            color: "#fff",
            fontFamily: fonts.semiBold,
            fontSize: 16,
          }}
        >
          Finish Session
        </Text>
      </TouchableOpacity>

      {/* Info modal */}
      <Modal
        visible={!!infoFor}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoFor(null)}
      >
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
              maxHeight: "80%",
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
              <Text
                style={[styles.title, { color: theme.colors.text }]}
              >
                {infoFor?.name || "Exercise"}
              </Text>
              <TouchableOpacity onPress={() => setInfoFor(null)}>
                <Text
                  style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: theme.colors.textMuted,
                marginBottom: 8,
                fontFamily: fonts.medium,
              }}
            >
              {infoFor?.meta}
            </Text>
            <View style={{ gap: 6 }}>
              {(infoFor?.steps || []).length ? (
                infoFor?.steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: "row" }}>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        width: 20,
                        fontFamily: fonts.semiBold,
                      }}
                    >
                      {i + 1}.
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.text,
                        flex: 1,
                        fontFamily: fonts.regular,
                      }}
                    >
                      {s}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.colors.textMuted }}>
                  No instructions available.
                </Text>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 20 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  exercise: { fontFamily: fonts.semiBold, fontSize: 14, marginBottom: 6 },
  setRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
  },
  small: { fontFamily: fonts.regular, fontSize: 12 },
  doneBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  finishBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  restBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
});