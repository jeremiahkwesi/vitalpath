// app/ProgramsScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../src/constants/fonts";
import { useTheme } from "../src/ui/ThemeProvider";
import Segmented from "../src/ui/components/Segmented";
import Card from "../src/ui/components/Card";
import WorkoutsSearchModal from "../src/components/WorkoutsSearchModal";
import { useActivity } from "../src/context/ActivityContext";
import PlanModal from "../src/components/PlanModal";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

export default function ProgramsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();
  const { addWorkout } = useActivity();

  const [location, setLocation] = useState<"home" | "gym">("home");
  const [days, setDays] = useState<string>("3");
  const [level, setLevel] = useState<"beg" | "int" | "adv">("beg");

  const [showSearch, setShowSearch] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const addRoutine = async (name: string, duration: number, calories: number) => {
    await addWorkout({
      name,
      type: "strength",
      duration,
      caloriesBurned: calories,
    });
    h.impact("light");
    toast.success(`${name} logged (${duration}m / ${calories} kcal)`);
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.appBg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Programs & Workouts
          </Text>
          <TouchableOpacity
            onPress={() => setShowPlan(true)}
            style={[styles.planBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.planBtnText}>Your AI Plan</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Explore routines or browse exercises. Generate a weekly plan with AI.
        </Text>

        {/* Filters */}
        <Card style={{ marginTop: 12, marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Filters
          </Text>
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Location
              </Text>
              <Segmented
                items={[
                  { label: "Home", value: "home" },
                  { label: "Gym", value: "gym" },
                ]}
                value={location}
                onChange={(v) => setLocation(v as "home" | "gym")}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Days/week
              </Text>
              <Segmented
                items={[
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                  { label: "4", value: "4" },
                  { label: "5", value: "5" },
                ]}
                value={days}
                onChange={setDays}
              />
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              Experience
            </Text>
            <Segmented
              items={[
                { label: "Beginner", value: "beg" },
                { label: "Intermediate", value: "int" },
                { label: "Advanced", value: "adv" },
              ]}
              value={level}
              onChange={(v) => setLevel(v as any)}
            />
          </View>
        </Card>

        {/* Quick routines */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Routines
          </Text>

          <RoutineRow
            name="Full Body A"
            details="Goblet Squat, Push-Ups, Bent-Over Row, Plank"
            duration="45 min"
            cals="300 kcal"
            onAdd={() => addRoutine("Full Body A", 45, 300)}
            textColor={theme.colors.text}
            muted={theme.colors.textMuted}
          />
          <RoutineRow
            name="Full Body B"
            details="Split Squat, Incline Push-Up, Lat Pulldown, Hollow Hold"
            duration="45 min"
            cals="300 kcal"
            onAdd={() => addRoutine("Full Body B", 45, 300)}
            textColor={theme.colors.text}
            muted={theme.colors.textMuted}
          />
          <RoutineRow
            name="Upper / Lower Split"
            details="Upper: Bench, Row, Press • Lower: Squat, RDL, Lunges"
            duration="60 min"
            cals="350 kcal"
            onAdd={() => addRoutine("Upper/Lower Split", 60, 350)}
            textColor={theme.colors.text}
            muted={theme.colors.textMuted}
          />
          <RoutineRow
            name="Push / Pull / Legs"
            details="Push: Bench, OHP • Pull: Row, Pulldown • Legs: Squat, RDL"
            duration="60 min"
            cals="380 kcal"
            onAdd={() => addRoutine("Push/Pull/Legs", 60, 380)}
            textColor={theme.colors.text}
            muted={theme.colors.textMuted}
          />
        </Card>

        {/* Explore exercises */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Explore Exercises
            </Text>
            <TouchableOpacity onPress={() => setShowSearch(true)}>
              <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>
                Browse
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: theme.colors.textMuted }}>
            Search by name (bench, squat, plank) or equipment.
          </Text>
        </Card>

        {/* Tips */}
        <Text style={[styles.tip, { color: theme.colors.textMuted }]}>
          Tip: For AI workouts tailored to {location}, {days}×/week,{" "}
          {level === "beg" ? "beginner" : level === "int" ? "intermediate" : "advanced"} —
          use “Your AI Plan” above to generate a structured week.
        </Text>
      </ScrollView>

      <WorkoutsSearchModal visible={showSearch} onClose={() => setShowSearch(false)} />
      <PlanModal visible={showPlan} onClose={() => setShowPlan(false)} weekStartDate={new Date()} />
    </>
  );
}

function RoutineRow({
  name,
  details,
  duration,
  cals,
  onAdd,
  textColor,
  muted,
}: {
  name: string;
  details: string;
  duration: string;
  cals: string;
  onAdd: () => void;
  textColor: string;
  muted: string;
}) {
  return (
    <View style={styles.routineRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.routineName, { color: textColor }]}>{name}</Text>
        <Text style={{ color: muted, marginTop: 2 }}>{details}</Text>
        <Text style={{ color: muted, marginTop: 2 }}>
          {duration} • {cals}
        </Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: fonts.bold },
  subtitle: { fontFamily: fonts.regular, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 8 },
  filterRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  planBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  planBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  routineRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  routineName: { fontFamily: fonts.semiBold, fontSize: 14 },
  addBtn: { backgroundColor: "#007AFF", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  addBtnText: { color: "#fff", fontFamily: fonts.semiBold },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tip: { fontFamily: fonts.regular, fontSize: 12, marginTop: 10 },
});