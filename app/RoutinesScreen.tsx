import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { listRoutines, deleteRoutine } from "../src/services/routines";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
const DAYS: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RoutinesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const todayDay = (DAYS[new Date().getDay()] || "Mon") as Day;

  const load = async () => {
    if (!user?.uid) return;
    const r = await listRoutines(user.uid);
    setItems(r);
  };
  useEffect(() => {
    load();
  }, [user?.uid]);

  const openInBuilder = async (routine: any) => {
    if (!user?.uid) return;
    await AsyncStorage.setItem(
      `routine:draft:${user.uid}`,
      JSON.stringify({ name: routine.name, items: routine.items || [] })
    );
    nav.navigate("RoutineBuilder");
  };

  const openDetails = (routine: any) => {
    nav.navigate("PlanDetails", { routine });
  };

  const startDay = (routine: any, day: Day) => {
    const dayItems = (routine.items || []).filter((i: any) => i.day === day);
    if (!dayItems.length) {
      Alert.alert(
        "No exercises",
        `This plan has no exercises for ${day}. Edit it in Builder.`
      );
      return;
    }
    nav.navigate("WorkoutSession", {
      workout: { name: `${routine.name} — ${day}`, items: dayItems },
    });
  };

  const startToday = (routine: any) => startDay(routine, todayDay);

  const remove = async (id: string) => {
    if (!user?.uid) return;
    Alert.alert("Delete routine", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteRoutine(user.uid!, id);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="My workout plans"
        subtitle="Open details, start a day, or edit in the builder"
      />

      {!items.length ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          No workout plans yet. Create one in the Builder or use Templates.
        </Text>
      ) : (
        items.map((r) => {
          const days = new Set((r.items || []).map((i: any) => i.day));
          return (
            <Card key={r.id}>
              <TouchableOpacity onPress={() => openDetails(r)}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.textMuted, marginBottom: 6 }}>
                Days: {[...days].join(", ") || "—"}
              </Text>
              <View
                style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
              >
                <TouchableOpacity
                  onPress={() => startToday(r)}
                  style={[
                    styles.btn,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={{ color: "#fff", fontFamily: fonts.semiBold }}
                  >
                    Start Today ({todayDay})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openInBuilder(r)}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
                  >
                    Open in Builder
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => remove(r.id)}
                  style={[styles.btn, { backgroundColor: "#FF6B6B" }]}
                >
                  <Text
                    style={{ color: "#fff", fontFamily: fonts.semiBold }}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                {DAYS.map((d) => {
                  const enabled = (r.items || []).some((it: any) => it.day === d);
                  return (
                    <Pill
                      key={`${r.id}-${d}`}
                      label={d}
                      selected={enabled}
                      onPress={() => (enabled ? startDay(r, d) : undefined)}
                    />
                  );
                })}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 4 },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
});