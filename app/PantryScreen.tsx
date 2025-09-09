import React, { useEffect, useMemo, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { labelFoodImageBase64 } from "../src/services/healthAI";
import Constants from "expo-constants";
import { Card, SectionHeader } from "../src/ui/components/UKit";

type BarcodeModule = typeof import("expo-barcode-scanner");
type BarcodeType = BarcodeModule["BarCodeScanner"] | null;

const isExpoGo = Constants.appOwnership === "expo";

export default function PantryScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [count, setCount] = useState("");
  const [q, setQ] = useState("");

  // Barcode
  const [BarcodeScanner, setBarcodeScanner] = useState<BarcodeType>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const load = async () => {
    if (!user?.uid) return;
    const r = await listPantry(user.uid);
    setItems(r);
  };

  useEffect(() => {
    load();
  }, [user?.uid]);

  // Lazy load scanner when opened
  useEffect(() => {
    let active = true;
    async function init() {
      setScanMsg(null);
      if (!scanOpen) return;
      if (isExpoGo) {
        setBarcodeScanner(null);
        setHasPermission(null);
        setScanMsg("Barcode scanning is not available in Expo Go. Use a dev build.");
        return;
      }
      try {
        const mod: BarcodeModule = await import("expo-barcode-scanner");
        const Scanner = mod.BarCodeScanner;
        if (!active) return;
        setBarcodeScanner(() => Scanner);
        const { status } = await mod.BarCodeScanner.requestPermissionsAsync();
        if (!active) return;
        setHasPermission(status === "granted");
      } catch (e) {
        if (!active) return;
        setScanMsg("Barcode scanning is not available in this build.");
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [scanOpen]);

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

  const analyzePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission", "Allow photo access");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (res.canceled || !res.assets?.[0]?.uri || !user?.uid) return;
    const m = await ImageManipulator.manipulateAsync(
      res.assets[0].uri,
      [{ resize: { width: 768 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    const base64 = m.base64 || "";
    try {
      const lab = await labelFoodImageBase64(base64, "image/jpeg");
      const guess = (lab.label || "").replace(/_/g, " ").trim();
      if (!guess) return Alert.alert("Analyze", "Could not identify the item.");
      setName(guess[0].toUpperCase() + guess.slice(1));
      Alert.alert("Analyzed", `Detected: ${guess}. You can edit and add.`);
    } catch (e: any) {
      Alert.alert("Analyze", e?.message || "Failed to analyze.");
    }
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

  const onScan = async ({ data }: { data: string }) => {
    setScanned(true);
    try {
      // Minimal pantry add via barcode: just count +1 named by barcode
      const nm = name.trim();
      const autoName = nm || `Barcode ${data}`;
      if (!user?.uid) return;
      await addPantryItem(user.uid, { name: autoName, count: 1 } as any);
      setName("");
      Alert.alert("Pantry", `Added "${autoName}" (count 1). Edit details if needed.`);
      load();
    } catch (e: any) {
      Alert.alert("Scan", e?.message || "Failed to add item.");
    } finally {
      setTimeout(() => setScanned(false), 600);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.name.toLowerCase().includes(s)) : items;
  }, [items, q]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionHeader
        title="Pantry"
        subtitle="Track what you have; planning can use this"
      />

      <Card>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="Filter pantry (e.g., rice)"
          placeholderTextColor={theme.colors.textMuted}
          value={q}
          onChangeText={setQ}
        />
      </Card>

      <Card>
        <SectionHeader title="Add item" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity
            onPress={analyzePhoto}
            style={[
              styles.btn,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
            ]}
          >
            <Text style={styles.btnTextDark}>Analyze Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setScanOpen((s) => !s)}
            style={[
              styles.btn,
              { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
            ]}
          >
            <Text style={styles.btnTextDark}>
              {scanOpen ? "Close Scanner" : "Scan barcode"}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                flex: 1,
                minWidth: 140,
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
                width: 110,
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
                width: 110,
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
      </Card>

      {scanOpen && (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: "hidden",
            height: 240,
            backgroundColor: "#000",
            marginBottom: 12,
          }}
        >
          {!BarcodeScanner ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }}>
              <Text style={{ color: theme.colors.text }}>
                {scanMsg || "Loading scanner…"}
              </Text>
            </View>
          ) : hasPermission === null ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }}>
              <Text style={{ color: theme.colors.textMuted }}>
                Requesting camera permission…
              </Text>
            </View>
          ) : hasPermission === false ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }}>
              <Text style={{ color: theme.colors.text }}>No access to camera</Text>
              <Text style={{ color: theme.colors.textMuted }}>Grant camera permission in settings.</Text>
            </View>
          ) : (
            <BarcodeScanner onBarCodeScanned={scanned ? undefined : onScan} style={{ flex: 1 }} />
          )}
        </View>
      )}

      {filtered.map((it) => (
        <Card key={it.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{it.name}</Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {it.grams ? `${it.grams} g` : ""} {it.count ? `• ${it.count} pcs` : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => update(it, { grams: Math.max(0, (it.grams || 0) - 100) })}
              style={[styles.smallBtn, { backgroundColor: "#FFCC80", borderColor: "#FFCC80" }]}
            >
              <Text style={styles.btnTextDark}>-100g</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => update(it, { grams: (it.grams || 0) + 100 })}
              style={[styles.smallBtn, { backgroundColor: "#80CBC4", borderColor: "#80CBC4" }]}
            >
              <Text style={styles.btnTextDark}>+100g</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert("Delete", "Remove this item?", [
                  { text: "Cancel" },
                  { text: "Delete", style: "destructive", onPress: () => remove(it) },
                ])
              }
              style={[styles.smallBtn, { backgroundColor: "#FF6B6B", borderColor: "#FF6B6B" }]}
            >
              <Text style={styles.btnTextLight}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular },
  btn: { borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  btnTextLight: { color: "#fff", fontFamily: fonts.semiBold },
  btnTextDark: { color: "#000", fontFamily: fonts.semiBold },
});