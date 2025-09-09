import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
const DAYS: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PlanDetailsScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const routine = route.params?.routine as {
    id?: string;
    name: string;
    items: Array<{
      name: string;
      day: Day;
      groupId?: string;
      sets: Array<{ reps?: string; restSec: number; type: string }>;
    }>;
  };

  const [day, setDay] = useState<Day>(DAYS[new Date().getDay()] || "Mon");

  const perDay = useMemo(
    () => (routine?.items || []).filter((i) => i.day === day),
    [routine?.items, day]
  );

  const start = () => {
    if (!perDay.length) return;
    nav.navigate("WorkoutSession", {
      workout: { name: `${routine.name} — ${day}`, items: perDay },
    });
  };

  if (!routine) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.appBg,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>No plan found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title={routine.name}
        subtitle="Select a day to preview and start"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {DAYS.map((d) => {
          const has = (routine.items || []).some((it) => it.day === d);
          return (
            <Pill
              key={d}
              label={d}
              selected={day === d}
              onPress={() => setDay(d)}
            />
          );
        })}
      </ScrollView>

      {!perDay.length ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>
          No exercises for {day}.
        </Text>
      ) : (
        <Card>
          {perDay.map((it, idx) => (
            <View key={`${it.name}-${idx}`} style={{ marginBottom: 10 }}>
              <Text style={[styles.exercise, { color: theme.colors.text }]}>
                {it.name} {it.groupId ? `• Group ${it.groupId}` : ""}
              </Text>
              {(it.sets || []).map((s, i) => (
                <Text
                  key={i}
                  style={{
                    color: theme.colors.textMuted,
                    fontFamily: fonts.regular,
                  }}
                >
                  • {s.type.toUpperCase()} — {s.reps || "—"} reps · rest{" "}
                  {s.restSec}s
                </Text>
              ))}
            </View>
          ))}
        </Card>
      )}

      <TouchableOpacity
        onPress={start}
        style={[
          styles.btn,
          { backgroundColor: theme.colors.primary, marginTop: 10 },
        ]}
      >
        <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
          Start {day}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  exercise: { fontFamily: fonts.semiBold, marginBottom: 4 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
});