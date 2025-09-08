// app/WorkoutsHomeScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

function Tile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.tile,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.tileText, { color: theme.colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function WorkoutsHomeScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.appBg }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Workouts</Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 12 }}>
        Build routines, browse exercises, run sessions, and track PBs.
      </Text>

      <View style={styles.grid}>
        <Tile icon="barbell-outline" label="Browse Exercises" color="#FF6B6B" onPress={() => nav.navigate("Programs")} />
        <Tile icon="list-outline" label="My Routines" color="#00C853" onPress={() => nav.navigate("Routines")} />
        <Tile icon="construct-outline" label="Workout Builder" color="#2962FF" onPress={() => nav.navigate("RoutineBuilder")} />
        <Tile icon="sparkles-outline" label="AI Routine" color="#7E57C2" onPress={() => nav.navigate("RoutineBuilder", { openAI: true as any })} />
        <Tile icon="podium-outline" label="Stats" color="#F4511E" onPress={() => nav.navigate("StrengthStats")} />
        <Tile icon="albums-outline" label="Templates" color="#0097A7" onPress={() => nav.navigate("WorkoutTemplates")} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.section, { color: theme.colors.text }]}>Tips</Text>
        <Text style={{ color: theme.colors.textMuted }}>
          - Use AI Routine to generate a full plan by goal/level/equipment.{"\n"}
          - Save favorites from Browse for quick access.{"\n"}
          - Check Stats to see PBs (weight, 1RM) and volume trends.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "48%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  tileText: { fontFamily: fonts.semiBold },
  card: { marginTop: 16, borderRadius: 12, borderWidth: 1, padding: 12 },
  section: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 6 },
});