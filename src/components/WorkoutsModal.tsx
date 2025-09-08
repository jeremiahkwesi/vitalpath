// src/components/WorkoutsModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useActivity } from "../context/ActivityContext";
import { fonts } from "../constants/fonts";
import { useTheme } from "../ui/ThemeProvider";
import WorkoutsSearchModal from "./WorkoutsSearchModal";
import { useToast } from "../ui/components/Toast";
import { useHaptics } from "../ui/hooks/useHaptics";

type Props = { visible: boolean; onClose: () => void };

export default function WorkoutsModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const { todayActivity, addWorkout, removeWorkout } = useActivity();
  const [showSearch, setShowSearch] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "cardio" as "cardio" | "strength" | "flexibility" | "sports" | "other",
    duration: "",
    caloriesBurned: "",
  });

  const totalWorkouts = useMemo(
    () => (todayActivity?.workouts || []).length,
    [todayActivity]
  );

  const resetForm = () =>
    setForm({ name: "", type: "cardio", duration: "", caloriesBurned: "" });

  const onAdd = async () => {
    const duration = parseInt(form.duration || "0", 10);
    const calories = parseInt(form.caloriesBurned || "0", 10);

    if (!form.name || !Number.isFinite(duration) || !Number.isFinite(calories)) {
      toast.error("Enter a name, duration, and calories");
      return;
    }

    await addWorkout({
      name: form.name,
      type: form.type,
      duration,
      caloriesBurned: calories,
    });

    resetForm();
    h.impact("light");
    toast.success("Workout logged");
  };

  const onDelete = async (id: string) => {
    await removeWorkout(id);
    h.impact("light");
    toast.info("Deleted workout");
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Workouts Today ({totalWorkouts})
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => setShowSearch(true)}>
                <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>Browse</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {(todayActivity?.workouts || []).map((w) => (
              <View key={w.id} style={[styles.workoutItem, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.workoutName, { color: theme.colors.text }]}>{w.name}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                    {w.type} • {w.duration} min • {w.caloriesBurned} kcal
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onDelete(w.id)}>
                  <Text style={{ color: "#FF6B6B", fontFamily: fonts.semiBold }}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.section, { color: theme.colors.text }]}>Add Workout</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Name (e.g., Running)"
              placeholderTextColor={theme.colors.textMuted}
              value={form.name}
              onChangeText={(t) => setForm((s) => ({ ...s, name: t }))}
            />
            <View style={styles.row}>
              <View style={[styles.pickerContainer, { borderColor: theme.colors.border }]}>
                <Picker
                  selectedValue={form.type}
                  onValueChange={(v) => setForm((s) => ({ ...s, type: v as any }))}
                  style={[styles.picker, { color: theme.colors.text }]}
                >
                  <Picker.Item label="Cardio" value="cardio" />
                  <Picker.Item label="Strength" value="strength" />
                  <Picker.Item label="Flexibility" value="flexibility" />
                  <Picker.Item label="Sports" value="sports" />
                  <Picker.Item label="Other" value="other" />
                </Picker>
              </View>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Duration (min)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={form.duration}
                onChangeText={(t) => setForm((s) => ({ ...s, duration: t }))}
              />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Calories (kcal)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={form.caloriesBurned}
                onChangeText={(t) => setForm((s) => ({ ...s, caloriesBurned: t }))}
              />
            </View>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.colors.primary }]} onPress={onAdd}>
              <Text style={styles.addBtnText}>Add Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <WorkoutsSearchModal visible={showSearch} onClose={() => setShowSearch(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88%", padding: 16, borderTopWidth: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, alignItems: "center" },
  title: { fontSize: 18, fontFamily: fonts.semiBold },
  workoutItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  workoutName: { fontSize: 16, fontFamily: fonts.semiBold },
  section: { fontFamily: fonts.semiBold, marginBottom: 8 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontFamily: fonts.regular },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  pickerContainer: { borderWidth: 1, borderRadius: 8 },
  picker: { height: 44, width: 140 },
  addBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  addBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 14 },
});