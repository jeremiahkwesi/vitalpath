// app/GroceryOptimizerScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { buildGroceryForRange, subtractPantry } from "../src/utils/grocery";
import { listPantry } from "../src/services/pantry";
import { estimateListCost } from "../src/utils/prices";
import { optimizeGroceryListAI } from "../src/services/healthAI";

function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function GroceryOptimizerScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();

  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [budget, setBudget] = useState<string>("50");
  const [usePantry, setUsePantry] = useState(true);

  const [need, setNeed] = useState<{ name: string; grams?: number }[]>([]);
  const [have, setHave] = useState<{ name: string; grams?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [ai, setAI] = useState("");

  const load = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const range = await buildGroceryForRange(user.uid, fmt(weekStart), 7);
      if (usePantry) {
        const p = await listPantry(user.uid);
        const sub = subtractPantry(range.items, p);
        setNeed(sub.need);
        setHave(sub.have);
      } else {
        setNeed(range.items);
        setHave([]);
      }
    } catch {
      Alert.alert("Optimizer", "Failed to load grocery data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, weekStart, usePantry]);

  const needCost = useMemo(() => estimateListCost(need), [need]);

  const runAI = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const budgetNum = parseFloat(budget || "0");
      const p = usePantry ? await listPantry(user.uid) : [];
      const txt = await optimizeGroceryListAI(
        need,
        p.map((x) => ({ name: x.name, grams: x.grams, count: x.count })),
        {
          currency: "USD",
          budget: Number.isFinite(budgetNum) ? budgetNum : undefined,
          dietaryPreferences: userProfile?.dietaryPreferences || [],
        }
      );
      setAI(txt);
    } catch (e: any) {
      Alert.alert("AI", e?.message || "Failed to optimize.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        AI Grocery Optimizer
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Estimates cost and asks AI for cheaper substitutions within a budget.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            Use Pantry
          </Text>
          <Switch value={usePantry} onValueChange={setUsePantry} />
          <View style={{ flex: 1 }} />
          <Text style={{ color: theme.colors.textMuted }}>
            Week start: {fmt(weekStart)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold, alignSelf: "center" }}>
            Budget
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text, width: 120 },
            ]}
            keyboardType="numeric"
            value={budget}
            onChangeText={setBudget}
          />
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={load}
            style={[
              styles.btn,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
              Reload
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          Estimated cost (need): {needCost.toFixed(2)} (est.)
        </Text>
        <TouchableOpacity
          onPress={runAI}
          style={[styles.btn, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, marginTop: 8 }]}
          disabled={loading}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
            {loading ? "Optimizing…" : "Optimize with AI"}
          </Text>
        </TouchableOpacity>
      </View>

      {need.length > 0 && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sub, { color: theme.colors.text }]}>Need</Text>
          {need.slice(0, 20).map((it, i) => (
            <Text key={i} style={{ color: theme.colors.textMuted }}>
              • {it.name} {it.grams ? `— ${Math.round(it.grams)} g` : ""}
            </Text>
          ))}
          {need.length > 20 && (
            <Text style={{ color: theme.colors.textMuted }}>
              + {need.length - 20} more…
            </Text>
          )}
        </View>
      )}

      {!!ai && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sub, { color: theme.colors.text }]}>
            AI Suggestions
          </Text>
          <Text style={{ color: theme.colors.text }}>{ai}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  sub: { fontFamily: fonts.semiBold, marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center" },
});