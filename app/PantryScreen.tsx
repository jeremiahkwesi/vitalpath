// app/PantryScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import {
  listPantry,
  addPantryItem,
  updatePantryItem,
  deletePantryItem,
  PantryItem,
} from "../src/services/pantry";

export default function PantryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [count, setCount] = useState("");

  const load = async () => {
    if (!user?.uid) return;
    const r = await listPantry(user.uid);
    setItems(r);
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  const add = async () => {
    if (!user?.uid) return;
    const nm = name.trim();
    if (!nm) return Alert.alert("Name", "Enter an item name");
    const g = parseInt(grams || "0", 10);
    const c = parseInt(count || "0", 10);
    await addPantryItem(user.uid, {
      name: nm,
      grams: Number.isFinite(g) && g > 0 ? g : undefined,
      count: Number.isFinite(c) && c > 0 ? c : undefined,
    } as any);
    setName("");
    setGrams("");
    setCount("");
    load();
  };

  const update = async (it: PantryItem, patch: Partial<PantryItem>) => {
    if (!user?.uid) return;
    await updatePantryItem(user.uid, it.id, patch);
    load();
  };

  const remove = async (it: PantryItem) => {
    if (!user?.uid) return;
    await deletePantryItem(user.uid, it.id);
    load();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        Pantry
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginBottom: 8 }}>
        Track what you already have; grocery lists will subtract these.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.sub, { color: theme.colors.text }]}>Add item</Text>
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
            placeholder="Name (e.g., Rice)"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[
              styles.input,
              {
                width: 100,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="Grams"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={grams}
            onChangeText={setGrams}
          />
          <TextInput
            style={[
              styles.input,
              {
                width: 100,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="Count"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
            value={count}
            onChangeText={setCount}
          />
          <TouchableOpacity
            onPress={add}
            style={[
              styles.btn,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
            ]}
          >
            <Text style={styles.btnTextLight}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.map((it) => (
        <View
          key={it.id}
          style={[
            styles.row,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{it.name}</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {it.grams ? `${it.grams} g` : ""} {it.count ? `• ${it.count} pcs` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              update(it, {
                grams: Math.max(0, (it.grams || 0) - 100),
              })
            }
            style={[styles.smallBtn, { backgroundColor: "#FFCC80", borderColor: "#FFCC80" }]}
          >
            <Text style={styles.btnTextDark}>-100g</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              update(it, {
                grams: (it.grams || 0) + 100,
              })
            }
            style={[styles.smallBtn, { backgroundColor: "#80CBC4", borderColor: "#80CBC4" }]}
          >
            <Text style={styles.btnTextDark}>+100g</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => remove(it)}
            style={[styles.smallBtn, { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" }]}
          >
            <Text style={styles.btnTextLight}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 6 },
  sub: { fontFamily: fonts.semiBold, marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  btnTextLight: { color: "#fff", fontFamily: fonts.semiBold },
  btnTextDark: { color: "#000", fontFamily: fonts.semiBold },
  row: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
});