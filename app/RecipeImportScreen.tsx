// app/RecipeImportScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { importRecipeFromUrl } from "../src/utils/recipeImport";
import { addRecipe } from "../src/services/recipes";

export default function RecipeImportScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [res, setRes] = useState<{
    name: string;
    servings: number;
    steps: string[];
    ingredients: string[];
    totals: { calories: number; protein: number; carbs: number; fat: number };
  } | null>(null);

  const runFromUrl = async () => {
    if (!url.trim()) return;
    setImporting(true);
    try {
      const r = await importRecipeFromUrl(url.trim());
      setRes(r);
    } catch (e: any) {
      Alert.alert("Import", e?.message || "Failed to import.");
    } finally {
      setImporting(false);
    }
  };

  const runFromPaste = async () => {
    if (!paste.trim()) return;
    setImporting(true);
    try {
      const data = JSON.parse(paste.trim());
      const node = Array.isArray(data)
        ? data.find(
            (n) =>
              n?.["@type"] === "Recipe" ||
              (Array.isArray(n?.["@type"]) &&
                n?.["@type"].includes("Recipe"))
          ) || data[0]
        : data;
      if (!node) throw new Error("Invalid JSON-LD content.");
      // Minimal wrapper reusing parser’s logic
      const name = String(node.name || "Imported Recipe").trim();
      const servingsRaw = node.recipeYield || node.yield || 1;
      const servings = Array.isArray(servingsRaw)
        ? Number(servingsRaw[0]) || 1
        : Number(String(servingsRaw).match(/(\d+)/)?.[1] || 1);
      const ingredients: string[] = (node.recipeIngredient || node.ingredients || []).map(
        (s: any) => String(s).trim()
      );
      const instr = node.recipeInstructions || [];
      const steps = (Array.isArray(instr) ? instr : [instr])
        .map((x: any) => (typeof x === "string" ? x : x?.text || ""))
        .map((s: string) => s.trim())
        .filter(Boolean);
      const nutrition = node.nutrition || {};
      const toNum = (v: any) => Number(String(v).match(/(\d+(\.\d+)?)/)?.[1] || 0);
      const totals = {
        calories: toNum(nutrition.calories),
        protein: toNum(nutrition.proteinContent),
        carbs: toNum(nutrition.carbohydrateContent),
        fat: toNum(nutrition.fatContent),
      };
      setRes({ name, servings, ingredients, steps, totals });
    } catch (e: any) {
      Alert.alert("Import", e?.message || "Failed to parse JSON.");
    } finally {
      setImporting(false);
    }
  };

  const save = async () => {
    if (!user?.uid || !res) return;
    try {
      // Ingredients: we store one "Imported totals" ingredient so totals are correct
      const ingredients = [
        {
          name: "Imported totals",
          quantity: `${res.servings} servings`,
          calories: res.totals.calories,
          protein: res.totals.protein,
          carbs: res.totals.carbs,
          fat: res.totals.fat,
        },
        ...res.ingredients.map((n) => ({
          name: n,
          quantity: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        })),
      ];
      await addRecipe(user.uid, {
        name: res.name,
        servings: Math.max(1, res.servings || 1),
        ingredients,
        steps: res.steps || [],
        tags: ["imported"],
      } as any);
      Alert.alert("Saved", "Recipe imported.");
      setRes(null);
      setUrl("");
      setPaste("");
    } catch {
      Alert.alert("Save", "Failed to save recipe.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        Import Recipe
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Paste a recipe URL (JSON‑LD) from popular cooking sites or paste
        JSON‑LD content directly.
      </Text>

      <Text style={[styles.label, { color: theme.colors.text }]}>URL</Text>
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
          placeholder="https://example.com/recipe"
          placeholderTextColor={theme.colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={runFromUrl}
          style={[
            styles.btn,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
          ]}
          disabled={importing}
        >
          <Text style={styles.btnTextLight}>
            {importing ? "Importing…" : "Import"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: theme.colors.text, marginTop: 8 }]}>
        Or paste JSON‑LD
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            height: 140,
            textAlignVertical: "top",
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.border,
            color: theme.colors.text,
          },
        ]}
        multiline
        placeholder='{"@context":"https://schema.org","@type":"Recipe", ...}'
        placeholderTextColor={theme.colors.textMuted}
        value={paste}
        onChangeText={setPaste}
      />
      <TouchableOpacity
        onPress={runFromPaste}
        style={[
          styles.btn,
          {
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.border,
          },
        ]}
        disabled={importing}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: fonts.semiBold,
          }}
        >
          Parse pasted JSON
        </Text>
      </TouchableOpacity>

      {!!res && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {res.name}
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginBottom: 6 }}>
            Servings: {res.servings}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Totals: {res.totals.calories} kcal • P{res.totals.protein} C
            {res.totals.carbs} F{res.totals.fat}
          </Text>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: fonts.semiBold,
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            Ingredients ({res.ingredients.length})
          </Text>
          {res.ingredients.slice(0, 10).map((n, i) => (
            <Text key={i} style={{ color: theme.colors.textMuted }}>
              • {n}
            </Text>
          ))}
          {res.ingredients.length > 10 && (
            <Text style={{ color: theme.colors.textMuted }}>
              + {res.ingredients.length - 10} more…
            </Text>
          )}
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: fonts.semiBold,
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            Steps
          </Text>
          {res.steps.slice(0, 5).map((s, i) => (
            <Text key={i} style={{ color: theme.colors.textMuted }}>
              {i + 1}. {s}
            </Text>
          ))}
          <TouchableOpacity
            onPress={save}
            style={[
              styles.btn,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
                marginTop: 10,
              },
            ]}
          >
            <Text style={styles.btnTextLight}>Save as recipe</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  label: { fontFamily: fonts.semiBold, marginTop: 8, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center" },
  btnTextLight: { color: "#fff", fontFamily: fonts.semiBold },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
});