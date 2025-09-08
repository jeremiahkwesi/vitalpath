// app/GroceryListScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { buildGroceryForRange, subtractPantry } from "../src/utils/grocery";
import * as Sharing from "expo-sharing";
import { listPantry, PantryItem } from "../src/services/pantry";

function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function GroceryListScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [raw, setRaw] = useState<{ name: string; grams?: number }[]>([]);
  const [need, setNeed] = useState<{ name: string; grams?: number }[]>([]);
  const [have, setHave] = useState<{ name: string; grams?: number }[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [usePantry, setUsePantry] = useState(true);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const res = await buildGroceryForRange(user.uid, fmt(weekStart), 7);
      setRaw(res.items);
      setMissing(res.missing);
      const p = await listPantry(user.uid);
      setPantry(p);
      if (usePantry) {
        const sub = subtractPantry(res.items, p);
        setNeed(sub.need);
        setHave(sub.have);
      } else {
        setNeed(res.items);
        setHave([]);
      }
    } catch {
      Alert.alert("Grocery", "Failed to build list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, weekStart, usePantry]);

  const shiftWeek = (dir: number) => {
    const x = new Date(weekStart);
    x.setDate(weekStart.getDate() + dir * 7);
    setWeekStart(x);
  };

  const exportText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Grocery list — week starting ${fmt(weekStart)}`);
    lines.push("");
    lines.push("NEED:");
    for (const it of need) {
      const g = it.grams ? ` — ${Math.round(it.grams)} g` : "";
      lines.push(`• ${it.name}${g}`);
    }
    if (have.length) {
      lines.push("");
      lines.push("FROM PANTRY:");
      for (const it of have) {
        const g = it.grams ? ` — ${Math.round(it.grams)} g` : "";
        lines.push(`• ${it.name}${g}`);
      }
    }
    if (missing.length) {
      lines.push("");
      lines.push("Meals without ingredient breakdown:");
      for (const m of missing) lines.push(`- ${m}`);
    }
    return lines.join("\n");
  }, [need, have, missing, weekStart]);

  const share = async () => {
    try {
      const file = `data:text/plain;charset=utf-8,${encodeURIComponent(
        exportText
      )}`;
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = file;
        a.download = "grocery-list.txt";
        a.click();
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file);
        } else {
          Alert.alert("Share", "Sharing not available.");
        }
      }
    } catch {
      Alert.alert("Share", "Failed to share list.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        Grocery List
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        From your meal plan (7 days). Subtracts your Pantry if enabled.
      </Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => shiftWeek(-1)}
          style={[
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            ◀ Prev
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => shiftWeek(1)}
          style={[
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            Next ▶
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={{ color: theme.colors.text }}>Use pantry</Text>
        <Switch value={usePantry} onValueChange={setUsePantry} />
        <TouchableOpacity
          onPress={share}
          style={[
            styles.btn,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
          ]}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Share</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          Building…
        </Text>
      ) : need.length === 0 && have.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          No items found. Make sure your planned meals include components (recipe
          ingredients) for detailed lists.
        </Text>
      ) : (
        <>
          <Text style={[styles.sub, { color: theme.colors.text }]}>Need</Text>
          {need.map((it, idx) => (
            <View
              key={`need-${idx}`}
              style={[
                styles.row,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold, flex: 1 }}>
                {it.name}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {it.grams ? `${Math.round(it.grams)} g` : ""}
              </Text>
            </View>
          ))}

          {!!have.length && (
            <>
              <Text style={[styles.sub, { color: theme.colors.text, marginTop: 12 }]}>
                From pantry
              </Text>
              {have.map((it, idx) => (
                <View
                  key={`have-${idx}`}
                  style={[
                    styles.row,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
                  ]}
                >
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold, flex: 1 }}>
                    {it.name}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>
                    {it.grams ? `${Math.round(it.grams)} g` : ""}
                  </Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {!!missing.length && (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.sub, { color: theme.colors.text }]}>
            Meals without ingredient breakdown
          </Text>
          {missing.map((m, i) => (
            <Text key={i} style={{ color: theme.colors.textMuted }}>
              • {m}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  row: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  sub: { fontFamily: fonts.semiBold, marginBottom: 6 },
});