import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FoodItem } from "../src/services/foodDb";
import { useActivity } from "../src/context/ActivityContext";
import { Ionicons } from "@expo/vector-icons";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

function parseServingGrams(serving: string): number | null {
  const m = String(serving || "").match(/(\d+(\.\d+)?)\s*g/i);
  return m ? Math.round(parseFloat(m[1])) : null;
}

export default function FoodAddScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { addMeal } = useActivity();

  const food = route.params?.food as FoodItem;
  const [mode, setMode] = useState<"grams" | "servings">(
    parseServingGrams(food?.serving || "") ? "servings" : "grams"
  );
  const [grams, setGrams] = useState<string>(() => {
    const g = parseServingGrams(food?.serving || "") || 100;
    return String(g);
  });
  const [servings, setServings] = useState<string>("1");
  const [mealType, setMealType] = useState<MealType>("lunch");

  // Optional micros
  const [microFiber, setMicroFiber] = useState<string>("");
  const [microSodium, setMicroSodium] = useState<string>("");
  const [microPotassium, setMicroPotassium] = useState<string>("");
  const [microVitaminC, setMicroVitaminC] = useState<string>("");
  const [microCalcium, setMicroCalcium] = useState<string>("");
  const [microIron, setMicroIron] = useState<string>("");

  const scaled = useMemo(() => {
    let factor = 1;
    const gBase = parseServingGrams(food?.serving || "") || 100;
    if (mode === "grams") {
      const g = Math.max(1, parseInt(grams || "0", 10));
      factor = g / gBase;
    } else {
      const s = Math.max(0.25, parseFloat(servings || "1"));
      factor = s;
    }
    return {
      calories: Math.round((food?.calories || 0) * factor),
      protein: Math.round((food?.protein || 0) * factor),
      carbs: Math.round((food?.carbs || 0) * factor),
      fat: Math.round((food?.fat || 0) * factor),
      grams: Math.round(
        (parseServingGrams(food?.serving || "") || 100) * factor
      ),
    };
  }, [food, mode, grams, servings]);

  const toNum = (s: string) => {
    const n = Number(String(s).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  const save = async () => {
    await addMeal({
      name: food.name,
      type: mealType,
      calories: scaled.calories,
      macros: {
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
      },
      micros: {
        ...(toNum(microFiber) != null ? { fiber: toNum(microFiber)! } : {}),
        ...(toNum(microSodium) != null ? { sodium: toNum(microSodium)! } : {}),
        ...(toNum(microPotassium) != null
          ? { potassium: toNum(microPotassium)! }
          : {}),
        ...(toNum(microVitaminC) != null
          ? { vitaminC: toNum(microVitaminC)! }
          : {}),
        ...(toNum(microCalcium) != null ? { calcium: toNum(microCalcium)! } : {}),
        ...(toNum(microIron) != null ? { iron: toNum(microIron)! } : {}),
      },
    });
    nav.goBack();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionHeader
        title="Add food"
        subtitle="Adjust portion and select meal"
      />
      <Card>
        <Text
          style={[styles.header, { color: theme.colors.text }]}
          numberOfLines={3}
        >
          {food?.name}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>{food?.serving}</Text>
      </Card>

      <Card>
        <SectionHeader title="Measurement" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pill
            label="Servings"
            selected={mode === "servings"}
            onPress={() => setMode("servings")}
          />
          <Pill
            label="Grams"
            selected={mode === "grams"}
            onPress={() => setMode("grams")}
          />
        </View>

        {mode === "servings" ? (
          <Stepper
            label="Servings"
            value={servings}
            setValue={setServings}
            step={0.25}
            min={0.25}
            keyboardType="decimal-pad"
          />
        ) : (
          <Stepper
            label="Grams"
            value={grams}
            setValue={setGrams}
            step={10}
            min={10}
            keyboardType="numeric"
          />
        )}
      </Card>

      <Card>
        <SectionHeader title="Add to" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(
            (m) => (
              <Pill
                key={m}
                label={m[0].toUpperCase() + m.slice(1)}
                selected={mealType === m}
                onPress={() => setMealType(m)}
              />
            )
          )}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Nutrition" />
        <Text style={{ color: theme.colors.text }}>
          {scaled.calories} kcal • P{scaled.protein} C{scaled.carbs} F
          {scaled.fat} • {scaled.grams} g
        </Text>

        <Text
          style={[styles.sub2, { color: theme.colors.text, marginTop: 8 }]}
        >
          Micros (optional)
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
            placeholder="Fiber (g)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microFiber}
            onChangeText={setMicroFiber}
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
            placeholder="Sodium (mg)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microSodium}
            onChangeText={setMicroSodium}
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
            placeholder="Potassium (mg)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microPotassium}
            onChangeText={setMicroPotassium}
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
            placeholder="Vitamin C (mg)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microVitaminC}
            onChangeText={setMicroVitaminC}
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
            placeholder="Calcium (mg)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microCalcium}
            onChangeText={setMicroCalcium}
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
            placeholder="Iron (mg)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={microIron}
            onChangeText={setMicroIron}
          />
        </View>
      </Card>

      <TouchableOpacity
        onPress={save}
        style={[
          styles.btn,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          },
        ]}
      >
        <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
          Add to diary
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Stepper({
  label,
  value,
  setValue,
  step,
  min,
  keyboardType,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  step: number;
  min: number;
  keyboardType: "numeric" | "decimal-pad";
}) {
  const { theme } = useTheme();
  const num = Number(value || "0");
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => {
            const next = Math.max(min, (num || 0) - step);
            setValue(String(next));
          }}
          style={[
            styles.roundBtn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="remove" size={18} color={theme.colors.text} />
        </TouchableOpacity>
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
          keyboardType={keyboardType}
          value={value}
          onChangeText={setValue}
        />
        <TouchableOpacity
          onPress={() => {
            const next = (num || 0) + step;
            setValue(String(next));
          }}
          style={[
            styles.roundBtn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 20, marginBottom: 4 },
  sub2: { fontFamily: fonts.semiBold },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
    marginTop: 6,
  },
  btn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  roundBtn: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});