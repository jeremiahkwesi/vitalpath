// app/ScanFoodScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
// Lazy import barcode scanner (see below)
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";

import { getByBarcode, addCustomFood } from "../src/services/foodDb";
import { useActivity } from "../src/context/ActivityContext";
import { useAuth } from "../src/context/AuthContext";
import {
  analyzeMealImageBase64,
  MealImageAnalysis,
} from "../src/services/healthAI";
import { fonts } from "../src/constants/fonts";
import QuickEditMealModal, {
  QuickMeal,
} from "../src/components/QuickEditMealModal";
import Card from "../src/ui/components/Card";
import Segmented from "../src/ui/components/Segmented";
import { useTheme } from "../src/ui/ThemeProvider";
import { useToast } from "../src/ui/components/Toast";
import { SkeletonBlock } from "../src/ui/components/Skeleton";
import { useHaptics } from "../src/ui/hooks/useHaptics";

type Mode = "barcode" | "photo";

type BarcodeModule = typeof import("expo-barcode-scanner");
type BarcodeType = BarcodeModule["BarCodeScanner"] | null;

export default function ScanFoodScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const [mode, setMode] = useState<Mode>("barcode");

  // Barcode lazy module + state
  const [BarcodeScanner, setBarcodeScanner] = useState<BarcodeType>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Photo
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealImageAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const [baseGrams, setBaseGrams] = useState<number | null>(null);
  const [portionGrams, setPortionGrams] = useState<number | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { addMeal } = useActivity();
  const { user, userProfile } = useAuth();

  // Lazy load BarCodeScanner when user chooses Barcode mode
  useEffect(() => {
    let mounted = true;
    async function loadScanner() {
      setBarcodeError(null);
      if (mode !== "barcode") return;
      try {
        const mod: BarcodeModule = await import("expo-barcode-scanner");
        const Scanner = mod.BarCodeScanner;
        if (!mounted) return;
        setBarcodeScanner(() => Scanner);
        // Request permissions after module is ready
        const { status } = await mod.BarCodeScanner.requestPermissionsAsync();
        if (!mounted) return;
        setHasPermission(status === "granted");
      } catch (e: any) {
        if (!mounted) return;
        setBarcodeScanner(null);
        setHasPermission(null);
        setBarcodeError(
          "Barcode scanning is not available in this build. Use Photo mode or a development build."
        );
      }
    }
    loadScanner();
    return () => {
      mounted = false;
    };
  }, [mode]);

  // Helpers
  const parseServingToGrams = (s?: string | null): number | null => {
    if (!s) return null;
    const match = String(s).match(/(\d+(\.\d+)?)\s*g/i);
    if (!match) return null;
    return Math.round(parseFloat(match[1]));
  };

  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const scaleTotals = (
    totals: { calories: number; protein: number; carbs: number; fat: number },
    fromGrams?: number | null,
    toGrams?: number | null
  ) => {
    if (!fromGrams || !toGrams || fromGrams <= 0) return totals;
    const r = toGrams / fromGrams;
    return {
      calories: totals.calories * r,
      protein: totals.protein * r,
      carbs: totals.carbs * r,
      fat: totals.fat * r,
    };
  };

  const buildContext = () => ({
    name: userProfile?.name,
    age: userProfile?.age,
    weight: userProfile?.weight,
    height: userProfile?.height,
    gender: userProfile?.gender,
    goal: userProfile?.goal,
    dailyCalories: userProfile?.dailyCalories,
    macros: userProfile?.macros,
  });

  // Barcode flow
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    setLoading(true);
    try {
      const item = await getByBarcode(data, { uid: user?.uid });
      if (!item) {
        Alert.alert("Not Found", "No match found. Add this as a custom food?", [
          { text: "Cancel", onPress: () => setScanned(false) },
          {
            text: "Add Custom",
            onPress: async () => {
              if (!user?.uid) {
                Alert.alert("Sign in required", "Please sign in first.");
                setScanned(false);
                return;
              }
              await addCustomFood(user.uid, {
                name: "Custom food",
                serving: "1 serving",
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                barcode: data,
              });
              toast.success("Custom food saved to My Foods");
              setScanned(false);
            },
          },
        ]);
        return;
      }

      const doAdd = async (multiplier: number) => {
        await addMeal({
          name: item.name,
          type: "snack",
          calories: Math.round((item.calories || 0) * multiplier),
          macros: {
            protein: Math.round((item.protein || 0) * multiplier),
            carbs: Math.round((item.carbs || 0) * multiplier),
            fat: Math.round((item.fat || 0) * multiplier),
          },
          micros: {},
        });
        h.impact("light");
        toast.success(`${item.name} (${multiplier}×) logged`);
        setScanned(false);
      };

      const baseText = item.serving ? `Serving: ${item.serving}` : "1 serving";
      Alert.alert(
        "Log Portion",
        `${item.name}\n${baseText}\nSelect a portion:`,
        [
          { text: "0.5×", onPress: () => doAdd(0.5) },
          { text: "1×", onPress: () => doAdd(1) },
          { text: "2×", onPress: () => doAdd(2) },
        ],
        { cancelable: true }
      );
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  // Photo pick/capture
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to continue.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setAnalysis(null);
    setImgUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow camera access to continue.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setAnalysis(null);
    setImgUri(res.assets[0].uri);
  };

  const analyzeCurrentImage = async () => {
    if (!imgUri) return;
    setAnalyzing(true);
    h.impact("light");
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        imgUri,
        [{ resize: { width: 768 } }],
        {
          compress: 0.65,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const base64 = manipulated.base64 || "";
      if (!base64) throw new Error("Could not read image data.");
      const result = await analyzeMealImageBase64(
        base64,
        "image/jpeg",
        buildContext()
      );
      const g =
        result.portionGrams ?? parseServingToGrams(result.serving) ?? null;
      setAnalysis(result);
      setBaseGrams(g);
      setPortionGrams(g ?? 250);
      setShowQuickEdit(false);
      toast.success("Analysis complete");
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveQuick = async (m: QuickMeal) => {
    await addMeal({
      name: m.name,
      type: m.type,
      calories: Math.round(m.calories || 0),
      macros: {
        protein: Math.round(m.protein || 0),
        carbs: Math.round(m.carbs || 0),
        fat: Math.round(m.fat || 0),
      },
      micros: {},
    });
    setShowQuickEdit(false);
    setImgUri(null);
    setAnalysis(null);
    h.success();
    toast.success(`${m.name} logged to ${m.type}`);
  };

  // Derived display totals based on portion grams
  const displayTotals = useMemo(() => {
    if (!analysis) return null;
    return scaleTotals(
      {
        calories: analysis.calories || 0,
        protein: analysis.macros.protein || 0,
        carbs: analysis.macros.carbs || 0,
        fat: analysis.macros.fat || 0,
      },
      baseGrams,
      portionGrams || baseGrams
    );
  }, [analysis, baseGrams, portionGrams]);

  const breakdown = useMemo(() => {
    if (!analysis?.items || !analysis.items.length) return null;
    const sumBase =
      analysis.portionGrams ||
      analysis.items.reduce((a, b) => a + (b.grams || 0), 0) ||
      baseGrams ||
      null;
    if (!sumBase || !portionGrams) return analysis.items;
    const r = portionGrams / sumBase;
    return analysis.items.map((it) => ({
      ...it,
      grams: Math.round((it.grams || 0) * r),
      calories: Math.round((it.calories || 0) * r),
      protein: Math.round((it.protein || 0) * r),
      carbs: Math.round((it.carbs || 0) * r),
      fat: Math.round((it.fat || 0) * r),
    }));
  }, [analysis, baseGrams, portionGrams]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.appBg }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Scan Meal or Barcode
        </Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        <Segmented
          items={[
            { label: "Barcode", value: "barcode" },
            { label: "Photo", value: "photo" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      </View>

      {mode === "barcode" ? (
        <>
          {!BarcodeScanner ? (
            <View style={styles.center}>
              <Text style={{ color: theme.colors.text }}>
                {barcodeError ||
                  "Loading scanner… If it doesn’t load, use Photo mode or a dev build."}
              </Text>
            </View>
          ) : hasPermission === null ? (
            <View style={styles.center}>
              <Text style={{ color: theme.colors.textMuted }}>
                Requesting camera permission…
              </Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.center}>
              <Text style={{ color: theme.colors.text }}>
                No access to camera
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                Grant camera permission in settings.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.scanner,
                  { borderColor: theme.colors.border, backgroundColor: "#000" },
                ]}
              >
                <BarcodeScanner
                  onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                  style={{ flex: 1 }}
                />
                {loading && (
                  <View style={styles.loadingOverlay}>
                    <Text style={{ color: "#fff" }}>Searching…</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.primary }]}
                onPress={() => setScanned(false)}
                disabled={!scanned}
                accessibilityLabel="Scan again"
              >
                <Ionicons name="scan" size={18} color="#fff" />
                <Text style={styles.buttonText}>
                  {scanned ? "Scan Again" : "Scanning..."}
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.tip,
                  { color: theme.colors.textMuted, textAlign: "center" },
                ]}
              >
                Tip: If a barcode isn't found, use Photo mode or Quick Add from
                Meals.
              </Text>
            </>
          )}
        </>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#546E7A" }]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Pick photo"
            >
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Pick Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#546E7A" }]}
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: theme.colors.primary, opacity: imgUri ? 1 : 0.5 },
              ]}
              onPress={analyzeCurrentImage}
              disabled={!imgUri || analyzing}
              accessibilityRole="button"
              accessibilityLabel="Analyze photo"
            >
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>
                {analyzing ? "Analyzing…" : "Analyze"}
              </Text>
            </TouchableOpacity>
          </View>

          {imgUri && (
            <Card style={{ marginBottom: 12, padding: 8 }}>
              {analyzing ? (
                <View style={{ gap: 8 }}>
                  <SkeletonBlock style={{ height: 220, borderRadius: 8 }} />
                  <SkeletonBlock style={{ height: 16, width: "60%", borderRadius: 8 }} />
                  <SkeletonBlock style={{ height: 12, width: "40%", borderRadius: 8 }} />
                </View>
              ) : (
                <Image
                  source={{ uri: imgUri }}
                  style={{ width: "100%", height: 220, borderRadius: 8 }}
                />
              )}
            </Card>
          )}

          {analysis && !analyzing && (
            <Card>
              <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
                {analysis.name}
              </Text>
              <Text style={[styles.resultMeta, { color: theme.colors.textMuted }]}>
                {analysis.serving}
                {portionGrams ? ` (adjusted: ${portionGrams} g)` : ""}
              </Text>

              <View style={styles.portionRow}>
                <Text style={[styles.portionLabel, { color: theme.colors.text }]}>
                  Portion:
                </Text>
                <TouchableOpacity
                  style={[
                    styles.portionBtn,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
                  ]}
                  onPress={() =>
                    setPortionGrams((p) =>
                      clamp((p || baseGrams || 250) - 10, 20, 1500)
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Decrease portion by 10 grams"
                >
                  <Text style={[styles.portionBtnText, { color: theme.colors.text }]}>
                    -10g
                  </Text>
                </TouchableOpacity>
                <View
                  style={[
                    styles.portionInputWrap,
                    { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                  ]}
                >
                  <TextInput
                    style={[styles.portionInput, { color: theme.colors.text }]}
                    value={
                      portionGrams
                        ? String(portionGrams)
                        : baseGrams
                        ? String(baseGrams)
                        : ""
                    }
                    keyboardType="numeric"
                    onChangeText={(t) => {
                      const v = Number(t.replace(/[^\d.]/g, ""));
                      if (Number.isFinite(v)) {
                        setPortionGrams(clamp(Math.round(v), 20, 1500));
                      } else if (!t) {
                        setPortionGrams(null);
                      }
                    }}
                    placeholder="grams"
                    placeholderTextColor={theme.colors.textMuted}
                    accessibilityLabel="Portion in grams"
                  />
                  <Text style={[styles.portionUnit, { color: theme.colors.textMuted }]}>
                    g
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.portionBtn,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
                  ]}
                  onPress={() =>
                    setPortionGrams((p) =>
                      clamp((p || baseGrams || 250) + 10, 20, 1500)
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Increase portion by 10 grams"
                >
                  <Text style={[styles.portionBtnText, { color: theme.colors.text }]}>
                    +10g
                  </Text>
                </TouchableOpacity>
              </View>

              {displayTotals && (
                <>
                  <Text
                    style={[
                      styles.resultMeta,
                      { marginTop: 6, color: theme.colors.text },
                    ]}
                  >
                    {Math.round(displayTotals.calories)} kcal
                  </Text>
                  <Text style={[styles.resultMeta, { color: theme.colors.text }]}>
                    P {Math.round(displayTotals.protein)}g • C{" "}
                    {Math.round(displayTotals.carbs)}g • F{" "}
                    {Math.round(displayTotals.fat)}g
                  </Text>
                </>
              )}

              {!!analysis?.items?.length && (
                <TouchableOpacity
                  style={[
                    styles.breakdownBtn,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
                  ]}
                  onPress={() => setShowBreakdown((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle breakdown"
                >
                  <Text
                    style={[styles.breakdownBtnText, { color: theme.colors.primary }]}
                  >
                    {showBreakdown ? "Hide" : "Show"} breakdown
                  </Text>
                </TouchableOpacity>
              )}

              {showBreakdown && breakdown && (
                <View style={styles.breakdownList}>
                  {breakdown.map((it, idx) => (
                    <View key={`${it.name}-${idx}`} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownName, { color: theme.colors.text }]}>
                        • {it.name} ({it.grams} g)
                      </Text>
                      <Text style={[styles.breakdownMeta, { color: theme.colors.textMuted }]}>
                        {it.calories} kcal — P{it.protein} C{it.carbs} F{it.fat}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.addRow}>
                {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                  (t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.addTypeBtn, { backgroundColor: theme.colors.primary }]}
                      onPress={() =>
                        saveQuick({
                          name: analysis.name,
                          serving: analysis.serving,
                          calories: Math.round(
                            displayTotals?.calories || analysis.calories || 0
                          ),
                          protein: Math.round(
                            displayTotals?.protein || analysis.macros.protein || 0
                          ),
                          carbs: Math.round(
                            displayTotals?.carbs || analysis.macros.carbs || 0
                          ),
                          fat: Math.round(
                            displayTotals?.fat || analysis.macros.fat || 0
                          ),
                          type: t,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Add to ${t}`}
                    >
                      <Text style={styles.addTypeBtnText}>
                        Add {t[0].toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 8 }]}
                onPress={() => setShowQuickEdit(true)}
              >
                <Text style={styles.buttonText}>Quick Edit</Text>
              </TouchableOpacity>
            </Card>
          )}

          {!imgUri && !analysis && (
            <Text
              style={[
                styles.gray,
                { color: theme.colors.textMuted, textAlign: "center", marginTop: 12 },
              ]}
            >
              Pick or take a photo of a meal to analyze its nutrition.
            </Text>
          )}
        </ScrollView>
      )}

      <QuickEditMealModal
        visible={showQuickEdit && !!analysis}
        onClose={() => setShowQuickEdit(false)}
        initial={{
          name: analysis?.name || "Meal",
          serving: analysis?.serving,
          calories: Math.round(
            displayTotals?.calories || analysis?.calories || 0
          ),
          protein: Math.round(
            displayTotals?.protein || analysis?.macros.protein || 0
          ),
          carbs: Math.round(
            displayTotals?.carbs || analysis?.macros.carbs || 0
          ),
          fat: Math.round(displayTotals?.fat || analysis?.macros.fat || 0),
        }}
        onSave={saveQuick}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 22, fontFamily: fonts.bold },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  gray: { fontFamily: fonts.regular },
  scanner: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    minHeight: 320,
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  button: {
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontFamily: fonts.semiBold },
  tip: { marginTop: 8, fontFamily: fonts.regular },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  resultTitle: { fontFamily: fonts.semiBold, fontSize: 16 },
  resultMeta: { fontFamily: fonts.regular, marginTop: 2 },
  portionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  portionLabel: { fontFamily: fonts.semiBold, fontSize: 12 },
  portionBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  portionBtnText: { fontFamily: fonts.medium, fontSize: 12 },
  portionInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  portionInput: {
    width: 70,
    paddingVertical: 6,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  portionUnit: { marginLeft: 4, fontFamily: fonts.regular, fontSize: 12 },
  breakdownBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  breakdownBtnText: { fontFamily: fonts.semiBold, fontSize: 12 },
  breakdownList: { marginTop: 8, gap: 6 },
  breakdownRow: {},
  breakdownName: { fontFamily: fonts.medium, fontSize: 13 },
  breakdownMeta: { fontFamily: fonts.regular, fontSize: 12 },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  addTypeBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  addTypeBtnText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
});