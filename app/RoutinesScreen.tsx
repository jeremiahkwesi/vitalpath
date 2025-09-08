// app/RoutinesScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { listRoutines, deleteRoutine } from "../src/services/routines";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export default function RoutinesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const todayDay = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date().getDay()
  ] || "Mon") as Day;

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

  const startToday = (routine: any) => {
    const dayItems = (routine.items || []).filter((i: any) => i.day === todayDay);
    if (!dayItems.length) {
      Alert.alert("No exercises today", `This routine has no exercises for ${todayDay}. Edit it in Builder.`);
      return;
    }
    nav.navigate("WorkoutSession", { workout: { name: routine.name, items: routine.items } });
  };

  const remove = async (id: string) => {
    if (!user?.uid) return;
    Alert.alert("Delete routine", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteRoutine(user.uid, id);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>My Routines</Text>
      {!items.length ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          No routines yet. Create one in the Builder.
        </Text>
      ) : (
        items.map((r) => {
          const days = new Set((r.items || []).map((i: any) => i.day));
          return (
            <View key={r.id} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.name, { color: theme.colors.text }]}>{r.name}</Text>
              <Text style={{ color: theme.colors.textMuted, marginBottom: 6 }}>
                Days: {[...days].join(", ") || "—"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => startToday(r)} style={[styles.btn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Start Today</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openInBuilder(r)} style={[styles.btn, { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border }]}>
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Open in Builder</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(r.id)} style={[styles.btn, { backgroundColor: "#FF6B6B" }]}>
                  <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 20, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  name: { fontFamily: fonts.semiBold, fontSize: 16 },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
});