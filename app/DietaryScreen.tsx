// app/DietaryScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
  Image,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Pedometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { doc, getDoc } from "firebase/firestore";

import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { colors } from "../src/constants/colors";
import { fonts } from "../src/constants/fonts";
import { db } from "../src/config/firebase";

import MealsModal from "../src/components/MealsModal";
import WorkoutsModal from "../src/components/WorkoutsModal";
import FoodSearchModal from "../src/components/FoodSearchModal";
import Achievements from "../src/components/Achievements";
import DailyCoach from "../src/components/DailyCoach";
import DailyGoals from "../src/components/DailyGoals";
import OnboardingChecklist from "../src/components/OnboardingChecklist";

import { evaluateTodayBadges } from "../src/utils/achievements";
import {
  scheduleDailyWaterReminders,
  scheduleDailyMealReminders,
  cancelAllReminders,
} from "../src/utils/notifications";
import { TEMPLATES } from "../src/services/foodDb";
import { getFavorites } from "../src/utils/favorites";
import {
  analyzeMealImageBase64,
  MealImageAnalysis,
} from "../src/services/healthAI";

const { width } = Dimensions.get("window");

export default function DietaryScreen() {
  const navigation = useNavigation<any>();
  const { userProfile, user } = useAuth();
  const {
    todayActivity,
    updateSteps,
    addWater,
    setSleepHours,
    addWorkout,
    addMeal,
    getTodayProgress,
    loading,
  } = useActivity();

  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showMealsModal, setShowMealsModal] = useState(false);
  const [showWorkoutsModal, setShowWorkoutsModal] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);

  const [stepsInput, setStepsInput] = useState("");
  const [waterInput, setWaterInput] = useState("");
  const [sleepInput, setSleepInput] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealImageAnalysis | null>(null);
  const [imgUri, setImgUri] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  const [stepTarget, setStepTarget] = useState<number>(8000);
  const [waterTarget, setWaterTarget] = useState<number>(2000);

  const progress = getTodayProgress();

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const favs = await getFavorites(user.uid);
      setFavorites(favs);
    })();
  }, [user?.uid, showFoodSearch, showMealsModal]);

  useEffect(() => {
    (async () => {
      if (!user?.uid || !todayActivity) return;
      const newly = await evaluateTodayBadges({
        uid: user.uid,
        steps: todayActivity.steps || 0,
        waterMl: todayActivity.waterIntake || 0,
        calories: todayActivity.totalCalories || 0,
        calorieGoal: userProfile?.dailyCalories || 0,
        proteinG: todayActivity.macros?.protein || 0,
        streakDays: 0,
      });
      setNewBadges(newly);
    })();
  }, [
    user?.uid,
    todayActivity?.steps,
    todayActivity?.waterIntake,
    todayActivity?.totalCalories,
    todayActivity?.macros?.protein,
    showMealsModal,
    showWorkoutsModal,
  ]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const sg = await AsyncStorage.getItem(`settings:goal:steps:${user.uid}`);
      const wg = await AsyncStorage.getItem(`settings:goal:water:${user.uid}`);
      setStepTarget(sg ? Math.max(0, parseInt(sg, 10)) : 8000);
      setWaterTarget(wg ? Math.max(0, parseInt(wg, 10)) : 2000);
    })();
  }, [user?.uid]);

  if (loading && !todayActivity) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading your dashboard...</Text>
      </View>
    );
  }

  const handleShareToday = async () => {
    try {
      const lines = [
        `My day — ${new Date().toLocaleDateString()}`,
        `Calories: ${progress.caloriesConsumed}/${userProfile?.dailyCalories || 0} kcal`,
        `Protein: ${Math.round(todayActivity?.macros?.protein || 0)}g`,
        `Carbs: ${Math.round(todayActivity?.macros?.carbs || 0)}g`,
        `Fat: ${Math.round(todayActivity?.macros?.fat || 0)}g`,
        `Steps: ${todayActivity?.steps || 0}/${stepTarget}`,
        `Water: ${todayActivity?.waterIntake || 0} ml/${waterTarget} ml`,
        `Workouts: ${todayActivity?.workouts?.length || 0}, Meals: ${todayActivity?.meals?.length || 0}`,
      ];
      await Share.share({ message: lines.join("\n") });
    } catch {}
  };

  const handleAddSteps = async () => {
    const steps = parseInt(stepsInput);
    if (steps && steps > 0) {
      await updateSteps(steps);
      setStepsInput("");
      setShowStepsModal(false);
    }
  };

  const handleAddWater = async () => {
    const amount = parseInt(waterInput);
    if (amount && amount > 0) {
      await addWater(amount);
      setWaterInput("");
      setShowWaterModal(false);
    }
  };

  const handleSetSleep = async () => {
    const hours = parseFloat(sleepInput);
    if (!isNaN(hours) && hours >= 0 && hours <= 24) {
      await setSleepHours(hours);
      setShowSleepModal(false);
      setSleepInput("");
    } else {
      Alert.alert("Invalid", "Enter sleep hours between 0 and 24.");
    }
  };

  const quickAddWater = async (amount: number) => {
    await addWater(amount);
    Alert.alert("Water", `${amount} ml added`);
  };

  const quickAddMeal = async (
    type: "breakfast" | "lunch" | "dinner" | "snack",
    calories: number
  ) => {
    await addMeal({
      name: `Quick ${capitalize(type)}`,
      calories,
      macros: {
        protein: Math.round((calories * 0.25) / 4),
        carbs: Math.round((calories * 0.5) / 4),
        fat: Math.round((calories * 0.25) / 9),
      },
      micros: {},
      type,
    });
    Alert.alert("Added", `${calories} cal ${type} logged`);
  };

  const quickAddTemplate = async (idx: number) => {
    const t = TEMPLATES[idx];
    await addMeal({
      name: t.name,
      type: t.type,
      calories: t.calories,
      macros: { protein: t.protein, carbs: t.carbs, fat: t.fat },
      micros: {},
    });
    Alert.alert("Added", `${t.name} logged!`);
  };

  const quickAddWorkout = async (
    name: string,
    duration: number,
    calories: number,
    type: "cardio" | "strength"
  ) => {
    await addWorkout({ name, duration, caloriesBurned: calories, type });
    Alert.alert("Added", `${name} workout logged`);
  };

  // Gemini image analysis (no Storage upload)
  const pickOrTakeAndAnalyzeMeal = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      let res:
        | ImagePicker.ImagePickerResult
        | undefined
        | null = null;

      if (camPerm.status === "granted") {
        res = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 1,
        });
      }
      if (!res || res.canceled || !res.assets?.[0]?.uri) {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libPerm.status !== "granted") {
          Alert.alert("Permission", "Media library permission is required.");
          return;
        }
        res = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          quality: 1,
        });
      }
      if (!res || res.canceled || !res.assets?.[0]?.uri) return;

      const uri = res.assets[0].uri;
      setImgUri(uri);
      setAnalyzing(true);
      setAnalysis(null);

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 768 } }],
        {
          compress: 0.65,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      const base64 = manipulated.base64 || "";
      if (!base64) throw new Error("Could not read image data");

      const item = await analyzeMealImageBase64(base64, "image/jpeg", {
        name: userProfile?.name,
        age: userProfile?.age,
        weight: userProfile?.weight,
        height: userProfile?.height,
        gender: userProfile?.gender,
        goal: userProfile?.goal,
        dailyCalories: userProfile?.dailyCalories,
        macros: userProfile?.macros,
      });

      setAnalysis(item);

      // Quick add to lunch; user can edit later in Meals manager
      await addMeal({
        name: item.name,
        calories: Math.round(item.calories || 0),
        macros: {
          protein: Math.round(item.macros.protein || 0),
          carbs: Math.round(item.macros.carbs || 0),
          fat: Math.round(item.macros.fat || 0),
        },
        micros: item.micros || {},
        type: "lunch",
      });

      Alert.alert(
        "Meal Added",
        `Logged: ${item.name} (${Math.round(item.calories)} cal)`
      );
    } catch (e: any) {
      console.log("Analyze error:", e?.message || e);
      const fallbackCalories = 500;
      const protein = Math.round((fallbackCalories * 0.25) / 4);
      const carbs = Math.round((fallbackCalories * 0.5) / 4);
      const fat = Math.round((fallbackCalories * 0.25) / 9);

      await addMeal({
        name: "Estimated Meal",
        calories: fallbackCalories,
        macros: { protein, carbs, fat },
        micros: {},
        type: "lunch",
      });

      Alert.alert(
        "Meal Added (Estimated)",
        `Logged: Estimated Meal (${fallbackCalories} cal). You can edit it in Manage Meals.`
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const repeatYesterday = async () => {
    try {
      if (!user?.uid) return;
      const today = new Date();
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yISO = y.toISOString().split("T")[0];
      const id = `${user.uid}_${yISO}`;
      const ref = doc(db, "activities", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Repeat", "No data for yesterday.");
        return;
      }
      const data: any = snap.data();
      const meals = data?.meals || [];
      if (!meals.length) {
        Alert.alert("Repeat", "Yesterday had no meals to copy.");
        return;
      }
      for (const m of meals) {
        await addMeal({
          name: m.name,
          calories: m.calories,
          macros: m.macros || { protein: 0, carbs: 0, fat: 0 },
          micros: m.micros || {},
          type: m.type || "lunch",
        });
      }
      Alert.alert("Copied", `Copied ${meals.length} meal(s) from yesterday.`);
    } catch (e) {
      Alert.alert("Repeat", "Failed to copy from yesterday.");
    }
  };

  const syncDeviceSteps = async () => {
    try {
      if (Platform.OS === "web") {
        Alert.alert("Steps", "Device step sync is not supported on web.");
        return;
      }
      const isAvail = await Pedometer.isAvailableAsync();
      if (!isAvail) {
        Alert.alert("Steps", "Pedometer not available on this device.");
        return;
      }
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0
      );
      const result = await Pedometer.getStepCountAsync(start, now);
      const stepsToday = result?.steps || 0;
      await updateSteps(stepsToday);
      Alert.alert("Steps", `Synced ${stepsToday} steps for today.`);
    } catch (e) {
      console.error("syncDeviceSteps error:", e);
      Alert.alert("Error", "Failed to sync steps.");
    }
  };

  const onWaterRemindersOn = async () => {
    try {
      await scheduleDailyWaterReminders();
      Alert.alert("Reminders", "Daily water reminders scheduled.");
    } catch {
      Alert.alert("Reminders", "Permission denied or scheduling failed.");
    }
  };

  const onMealRemindersOn = async () => {
    try {
      await scheduleDailyMealReminders([
        { hour: 8, minute: 0, label: "Breakfast" },
        { hour: 13, minute: 0, label: "Lunch" },
        { hour: 19, minute: 0, label: "Dinner" },
      ]);
      if (user?.uid) {
        await AsyncStorage.setItem(`remindersEnabled:${user.uid}`, "1");
      }
      Alert.alert("Reminders", "Meal reminders scheduled.");
    } catch {
      Alert.alert("Reminders", "Permission denied or scheduling failed.");
    }
  };

  const onEnableAllReminders = async () => {
    await onWaterRemindersOn();
    await onMealRemindersOn();
  };

  const onRemindersOff = async () => {
    await cancelAllReminders();
    Alert.alert("Reminders", "All reminders canceled.");
  };

  const macroBars = [
    {
      key: "protein" as const,
      label: "Protein",
      color: "#FF6B6B",
      current: todayActivity?.macros.protein || 0,
      target: userProfile?.macros.protein || 1,
      pct: progress.macrosProgress.protein,
    },
    {
      key: "carbs" as const,
      label: "Carbs",
      color: "#4ECDC4",
      current: todayActivity?.macros.carbs || 0,
      target: userProfile?.macros.carbs || 1,
      pct: progress.macrosProgress.carbs,
    },
    {
      key: "fat" as const,
      label: "Fat",
      color: "#45B7D1",
      current: todayActivity?.macros.fat || 0,
      target: userProfile?.macros.fat || 1,
      pct: progress.macrosProgress.fat,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Hey {firstName(userProfile?.name)} 👋
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.summaryPill}>
            <Ionicons name="flame" size={16} color={colors.primary} />
            <Text style={styles.summaryPillText}>
              {progress.caloriesRemaining} kcal left
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleShareToday}
            style={styles.shareBtn}
            accessibilityLabel="Share today"
          >
            <Ionicons name="share-social-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Onboarding Checklist */}
        <OnboardingChecklist
          uid={user?.uid || "anon"}
          dateISO={new Date().toISOString().split("T")[0]}
          userProfile={userProfile}
          todayActivity={todayActivity}
          onAddMeal={() => setShowFoodSearch(true)}
          onAddWorkout={() => setShowWorkoutsModal(true)}
          onAddWater={() => setShowWaterModal(true)}
          onEnableReminders={onEnableAllReminders}
          onGoProfile={() => navigation.navigate("Profile")}
        />

        {/* Coach + Achievements + Goals */}
        <DailyCoach
          name={userProfile?.name}
          caloriesRemaining={progress.caloriesRemaining}
          steps={todayActivity?.steps || 0}
          waterMl={todayActivity?.waterIntake || 0}
          proteinPct={progress.macrosProgress.protein}
        />
        <Achievements uid={user?.uid || "anon"} newly={newBadges} />
        <DailyGoals
          steps={todayActivity?.steps || 0}
          waterMl={todayActivity?.waterIntake || 0}
          proteinG={todayActivity?.macros?.protein || 0}
          proteinTarget={userProfile?.macros?.protein || 0}
          calories={todayActivity?.totalCalories || 0}
          calorieTarget={userProfile?.dailyCalories || 0}
          stepTarget={stepTarget}
          waterTarget={waterTarget}
          sleepHours={todayActivity?.sleepHours || 0}
          workoutsCount={todayActivity?.workouts?.length || 0}
          mealsCount={todayActivity?.meals?.length || 0}
        />

        {/* Overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today’s Overview</Text>

          <View style={styles.overviewRow}>
            <OverviewItem
              icon="flame"
              label="Calories"
              value={`${progress.caloriesConsumed}/${
                userProfile?.dailyCalories || 0
              }`}
              sub="consumed / goal"
            />
            <Separator />
            <OverviewItem
              icon="walk"
              label="Steps"
              value={`${todayActivity?.steps || 0}`}
              sub="today"
            />
            <Separator />
            <OverviewItem
              icon="water"
              label="Water"
              value={`${todayActivity?.waterIntake || 0} ml`}
              sub="today"
            />
          </View>

          {/* Macro bars */}
          <View style={{ marginTop: 14 }}>
            {macroBars.map((m) => (
              <MacroBar
                key={m.key}
                color={m.color}
                label={m.label}
                current={m.current}
                target={m.target}
                pct={m.pct}
              />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionTile
              icon="add"
              label="Add Steps"
              color={colors.primary}
              onPress={() => setShowStepsModal(true)}
            />
            <ActionTile
              icon="water"
              label="Add Water"
              color="#4ECDC4"
              onPress={() => setShowWaterModal(true)}
            />
            <ActionTile
              icon="fitness"
              label="Workouts"
              color="#FF6B6B"
              onPress={() => setShowWorkoutsModal(true)}
            />
            <ActionTile
              icon="restaurant"
              label="Meals"
              color="#FFA726"
              onPress={() => setShowMealsModal(true)}
            />
          </View>
        </View>

        {/* Meals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meals</Text>

          <Text style={styles.sectionTitle}>1‑Tap Templates</Text>
          <View style={styles.chipsRow}>
            <Chip
              onPress={() => quickAddTemplate(0)}
              text="Chicken & Rice • 600"
            />
            <Chip
              onPress={() => quickAddTemplate(1)}
              text="Yogurt + Berries • 250"
            />
            <Chip
              onPress={() => quickAddTemplate(2)}
              text="Omelette + Toast • 450"
            />
          </View>

          {favorites.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <View style={styles.chipsWrap}>
                {favorites.slice(0, 6).map((f) => (
                  <Chip
                    key={f.id}
                    text={`★ ${trimText(f.name, 18)} • ${Math.round(
                      f.calories
                    )}`}
                    onPress={async () => {
                      await addMeal({
                        name: f.name,
                        calories: f.calories,
                        macros: {
                          protein: f.protein,
                          carbs: f.carbs,
                          fat: f.fat,
                        },
                        micros: {},
                        type: f.type,
                      });
                      Alert.alert("Added", `${f.name} logged!`);
                    }}
                  />
                ))}
              </View>
            </>
          )}

          <View style={styles.chipsRow}>
            <Chip
              text="Search Foods…"
              outline
              onPress={() => setShowFoodSearch(true)}
            />
            <Chip
              text="Breakfast +400"
              onPress={() => quickAddMeal("breakfast", 400)}
            />
            <Chip text="Lunch +600" onPress={() => quickAddMeal("lunch", 600)} />
            <Chip
              text="Dinner +700"
              onPress={() => quickAddMeal("dinner", 700)}
            />
            <Chip text="Snack +200" onPress={() => quickAddMeal("snack", 200)} />
            <Chip text="Repeat Yesterday" onPress={repeatYesterday} />
          </View>
        </View>

        {/* Tools */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tools</Text>
          <View style={styles.toolsRow}>
            <ToolButton
              icon="camera"
              label={analyzing ? "Analyzing…" : "Take/Upload Meal Photo"}
              onPress={pickOrTakeAndAnalyzeMeal}
              disabled={analyzing}
            />
            <ToolButton
              icon="moon"
              label="Set Sleep"
              onPress={() => setShowSleepModal(true)}
            />
            <ToolButton icon="refresh" label="Sync Steps" onPress={syncDeviceSteps} />
            <ToolButton
              icon="notifications"
              label="Water ON"
              onPress={onWaterRemindersOn}
            />
            <ToolButton
              icon="notifications"
              label="Meals ON"
              onPress={onMealRemindersOn}
            />
            <ToolButton
              icon="notifications-off"
              label="Reminders OFF"
              onPress={onRemindersOff}
            />
          </View>

          {imgUri && analysis && (
            <View style={[styles.previewWrap, { marginTop: 12 }]}>
              <Image
                source={{ uri: imgUri }}
                style={{ width: "100%", height: 180, borderRadius: 8 }}
              />
              <Text style={[styles.gray, { marginTop: 6 }]}>
                Logged: {analysis.name} • {Math.round(analysis.calories)} kcal
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Steps Modal */}
      <Modal visible={showStepsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Steps</Text>
            <TextInput
              style={styles.modalInput}
              value={stepsInput}
              onChangeText={setStepsInput}
              placeholder="Enter steps count"
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowStepsModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryModalButton]}
                onPress={handleAddSteps}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.primaryModalButtonText,
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Water Modal */}
      <Modal visible={showWaterModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Water</Text>
            <TextInput
              style={styles.modalInput}
              value={waterInput}
              onChangeText={setWaterInput}
              placeholder="Enter amount in ml"
              keyboardType="numeric"
            />
            <View style={styles.quickWaterButtons}>
              <QuickWater onPress={() => quickAddWater(250)} label="250 ml" />
              <QuickWater onPress={() => quickAddWater(500)} label="500 ml" />
              <QuickWater onPress={() => quickAddWater(750)} label="750 ml" />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowWaterModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryModalButton]}
                onPress={handleAddWater}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.primaryModalButtonText,
                  ]}
                >
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sleep Modal */}
      <Modal visible={showSleepModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Sleep Hours</Text>
            <TextInput
              style={styles.modalInput}
              value={sleepInput}
              onChangeText={setSleepInput}
              placeholder="e.g., 7.5"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSleepModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryModalButton]}
                onPress={handleSetSleep}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.primaryModalButtonText,
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Managers */}
      <MealsModal
        visible={showMealsModal}
        onClose={() => setShowMealsModal(false)}
      />
      <WorkoutsModal
        visible={showWorkoutsModal}
        onClose={() => setShowWorkoutsModal(false)}
      />
      <FoodSearchModal
        visible={showFoodSearch}
        onClose={() => setShowFoodSearch(false)}
      />
    </SafeAreaView>
  );
}

/* UI helpers */

function OverviewItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.overviewItem}>
      <View style={styles.overviewIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewValue}>{value}</Text>
      {sub ? <Text style={styles.overviewSub}>{sub}</Text> : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function MacroBar({
  label,
  current,
  target,
  pct,
  color,
}: {
  label: string;
  current: number;
  target: number;
  pct: number;
  color: string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroVal}>
          {Math.round(current)} / {Math.round(target)} g
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: `${color}20` }]}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

function ActionTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.actionTile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({
  text,
  onPress,
  outline = false,
}: {
  text: string;
  onPress: () => void;
  outline?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        outline
          ? {
              backgroundColor: colors.white,
              borderColor: colors.primary,
              borderWidth: 1,
            }
          : {},
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          outline ? { color: colors.primary } : { color: colors.white },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolBtn, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.toolBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickWater({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.waterQuickButton} onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
}

function firstName(name?: string) {
  if (!name) return "there";
  return name.split(" ")[0];
}

function trimText(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* Styles */

const cardShadow = Platform.select({
  web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" } as any,
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  greeting: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  date: { fontSize: 13, fontFamily: fonts.regular, color: colors.gray, marginTop: 2 },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  summaryPillText: { fontFamily: fonts.semiBold, color: colors.primary, fontSize: 12 },
  shareBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, ...cardShadow },
  cardTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text, marginBottom: 12 },
  overviewRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  overviewItem: { flex: 1, padding: 12, alignItems: "center" },
  overviewIcon: { backgroundColor: `${colors.primary}10`, padding: 6, borderRadius: 10, marginBottom: 6 },
  overviewLabel: { fontSize: 12, color: colors.gray, fontFamily: fonts.regular },
  overviewValue: { fontSize: 16, color: colors.text, fontFamily: fonts.semiBold, marginTop: 2 },
  overviewSub: { fontSize: 10, color: colors.gray, marginTop: 2 },
  separator: { width: 1, backgroundColor: colors.border },
  macroHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  macroLabel: { fontSize: 12, color: colors.text, fontFamily: fonts.semiBold },
  macroVal: { fontSize: 12, color: colors.gray, fontFamily: fonts.regular },
  barTrack: { height: 8, borderRadius: 6, backgroundColor: colors.lightGray, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 6 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionTile: { width: (width - 16 * 2 - 12 * 3) / 4, alignItems: "center" },
  actionIconWrap: { padding: 10, borderRadius: 12, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: colors.text, fontFamily: fonts.semiBold, textAlign: "center" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.primary, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontFamily: fonts.semiBold, fontSize: 12 },
  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
  },
  toolBtnText: { fontFamily: fonts.semiBold, color: colors.text, fontSize: 12 },
  previewWrap: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: colors.white, borderRadius: 16, padding: 24, width: "90%", maxWidth: 400 },
  modalTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: "center", marginBottom: 20 },
  modalInput: { backgroundColor: colors.lightGray, borderRadius: 8, padding: 12, fontSize: 16, fontFamily: fonts.regular, marginBottom: 20 },
  quickWaterButtons: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  waterQuickButton: { backgroundColor: colors.white, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: "center",
    backgroundColor: colors.lightGray,
  },
  primaryModalButton: { backgroundColor: colors.primary },
  modalButtonText: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.text },
  primaryModalButtonText: { color: colors.white },
});