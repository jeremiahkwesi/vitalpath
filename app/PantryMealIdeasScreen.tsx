import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { listPantry } from "../src/services/pantry";
import { getPantryMealIdeasAI, PantryIdea } from "../src/services/healthAI";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export default function PantryMealIdeasScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const { todayActivity, addMeal } = useActivity();

  const [prefs, setPrefs] = useState(
    (userProfile?.dietaryPreferences || []).join(", ")
  );
  const [ideas, setIdeas] = useState<PantryIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [mealType, setMealType] = useState<MealType>("lunch");

  const [quickLog, setQuickLog] = useState<{ open: boolean; name: string }>(
    { open: false, name: "" }
  );
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const remaining = useMemo(() => {
    const consumed = todayActivity?.totalCalories || 0;
    const target = userProfile?.dailyCalories || 2000;
    const mr = Math.max(0, target - consumed);
    return {
      caloriesRemaining: mr,
      macrosRemaining: {
        protein: Math.max(
          0,
          (userProfile?.macros?.protein || 0) -
            (todayActivity?.macros.protein || 0)
        ),
        carbs: Math.max(
          0,
          (userProfile?.macros?.carbs || 0) - (todayActivity?.macros.carbs || 0)
        ),
        fat: Math.max(
          0,
          (userProfile?.macros?.fat || 0) - (todayActivity?.macros.fat || 0)
        ),
      },
    };
  }, [todayActivity, userProfile]);

  const generate = async () => {
    if (!user?.uid) {
      Alert.alert("Sign in required");
      return;
    }
    setLoading(true);
    try {
      const pantry = await listPantry(user.uid);
      const r = await getPantryMealIdeasAI(
        pantry.map((x) => ({ name: x.name, grams: x.grams, count: x.count })),
        {
          caloriesRemaining: remaining.caloriesRemaining,
          macrosRemaining: remaining.macrosRemaining,
          preferences: prefs
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        userProfile || undefined
      );
      setIdeas(r);
    } catch (e: any) {
      Alert.alert("AI", e?.message || "Failed to get ideas.");
    } finally {
      setLoading(false);
    }
  };

  const log = async () => {
    if (!quickLog.open) return;
    const calN = parseInt(cal || "0", 10);
    const pN = parseInt(p || "0", 10);
    const cN = parseInt(c || "0", 10);
    const fN = parseInt(f || "0", 10);
    if (!quickLog.name || calN <= 0) {
      Alert.alert("Log", "Enter at least name and calories.");
      return;
    }
    await addMeal({
      name: quickLog.name,
      type: mealType,
      calories: calN,
      macros: { protein: pN, carbs: cN, fat: fN },
      micros: {},
    });
    setQuickLog({ open: false, name: "" });
    setCal("");
    setP("");
    setC("");
    setF("");
    Alert.alert("Logged", "Added to your diary.");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="AI Pantry → Meals"
        subtitle="Use Pantry and remaining macros to generate ideas"
      />

      <Card>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          Dietary preferences (comma-separated)
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[
              styles.input,
              {
                flex: 1,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={prefs}
            onChangeText={setPrefs}
            placeholder="e.g., high-protein, low-sodium"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity
            onPress={generate}
            disabled={loading}
            style={[
              styles.btn,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
              {loading ? "Generating…" : "Generate"}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {ideas.map((idea, idx) => (
        <Card key={idx}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{idea.title}</Text>
          {!!(idea.description || []).length &&
            idea.description.map((d, i) => (
              <Text key={i} style={{ color: theme.colors.textMuted }}>
                • {d}
              </Text>
            ))}
          {!!idea.ingredients?.length && (
            <>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: fonts.semiBold,
                  marginTop: 6,
                }}
              >
                Ingredients
              </Text>
              {idea.ingredients.slice(0, 8).map((n, i) => (
                <Text key={i} style={{ color: theme.colors.textMuted }}>
                  - {n}
                </Text>
              ))}
              {idea.ingredients.length > 8 && (
                <Text style={{ color: theme.colors.textMuted }}>
                  + {idea.ingredients.length - 8} more…
                </Text>
              )}
            </>
          )}
          {!!idea.nutrition && (
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              ≈ {idea.nutrition.calories} kcal • P{idea.nutrition.protein} C
              {idea.nutrition.carbs} F{idea.nutrition.fat}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
            <MealTypePicker value={mealType} onChange={setMealType} />
            <TouchableOpacity
              onPress={() => {
                setQuickLog({ open: true, name: idea.title });
                if (idea.nutrition) {
                  setCal(String(Math.round(idea.nutrition.calories || 0)));
                  setP(String(Math.round(idea.nutrition.protein || 0)));
                  setC(String(Math.round(idea.nutrition.carbs || 0)));
                  setF(String(Math.round(idea.nutrition.fat || 0)));
                } else {
                  setCal("");
                  setP("");
                  setC("");
                  setF("");
                }
              }}
              style={[
                styles.smallBtn,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
              ]}
            >
              <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                Quick log
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      <Modal
        visible={quickLog.open}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickLog({ open: false, name: "" })}
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
              maxHeight: "88%",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.header, { color: theme.colors.text }]}>Quick log</Text>
              <TouchableOpacity onPress={() => setQuickLog({ open: false, name: "" })}>
                <Text style={{ color: theme.colors.primary, fontFamily: fonts.semiBold }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: theme.colors.text, marginBottom: 4 }}>{quickLog.name}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Calories"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={cal}
                onChangeText={setCal}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Protein"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={p}
                onChangeText={setP}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Carbs"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={c}
                onChangeText={setC}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder="Fat"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                value={f}
                onChangeText={setF}
              />
            </View>
            <TouchableOpacity
              onPress={log}
              style={[
                styles.btn,
                { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
              ]}
            >
              <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Add to diary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MealTypePicker({
  value,
  onChange,
}: {
  value: "breakfast" | "lunch" | "dinner" | "snack";
  onChange: (v: "breakfast" | "lunch" | "dinner" | "snack") => void;
}) {
  const { theme } = useTheme();
  const opts: ("breakfast" | "lunch" | "dinner" | "snack")[] = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
  ];
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {opts.map((m) => {
        const active = value === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => onChange(m)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: active ? theme.colors.primary : theme.colors.surface2,
            }}
          >
            <Text
              style={{
                color: active ? "#fff" : theme.colors.text,
                fontFamily: fonts.semiBold,
                fontSize: 12,
              }}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  label: { fontFamily: fonts.semiBold, marginTop: 8, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular, marginBottom: 8 },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  smallBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start", marginTop: 6 },
});