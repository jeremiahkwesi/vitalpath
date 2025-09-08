// src/context/ActivityContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { doc, setDoc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";
import { Pedometer } from "expo-sensors";
import { getIntegrations } from "../utils/userSettings";

export type SetType =
  | "normal"
  | "superset"
  | "dropset"
  | "pyramid"
  | "amrap"
  | "timed";

export interface Workout {
  id: string;
  name: string;
  duration: number; // minutes
  caloriesBurned: number;
  type: "cardio" | "strength" | "flexibility" | "sports" | "other";
  timestamp: Date;
  details?: {
    startedAt: number;
    endedAt: number;
    totalSets: number;
    totalReps?: number;
    items: Array<{
      exercise: string;
      groupId?: string;
      sets: Array<{
        reps?: string;
        weight?: number;
        restSec?: number;
        type: SetType;
        completedAt?: number;
      }>;
    }>;
  };
}

export interface Meal {
  id: string;
  name: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  micros: { [key: string]: number };
  type: "breakfast" | "lunch" | "dinner" | "snack";
  timestamp: Date;
  imageUrl?: string;
}

export interface DailyActivity {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  steps: number;
  waterIntake: number; // ml
  sleepHours: number;
  workouts: Workout[];
  meals: Meal[];
  totalCalories: number;
  macros: { protein: number; carbs: number; fat: number };
  micros: { [key: string]: number };
  createdAt: Date;
}

interface ActivityContextType {
  todayActivity: DailyActivity | null;
  loading: boolean;
  updateSteps: (steps: number) => Promise<void>;
  addWater: (amount: number) => Promise<void>;
  setSleepHours: (hours: number) => Promise<void>;
  addWorkout: (w: Omit<Workout, "id" | "timestamp">) => Promise<void>;
  addWorkoutSession: (s: {
    name: string;
    duration: number;
    caloriesBurned: number;
    type: Workout["type"];
    startedAt: number;
    endedAt: number;
    items: Workout["details"]["items"];
  }) => Promise<void>;
  removeWorkout: (id: string) => Promise<void>;
  addMeal: (m: Omit<Meal, "id" | "timestamp">) => Promise<void>;
  updateMeal: (
    id: string,
    patch: Partial<Omit<Meal, "id" | "timestamp">>
  ) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  getTodayProgress: () => {
    caloriesConsumed: number;
    caloriesRemaining: number;
    macrosProgress: { protein: number; carbs: number; fat: number };
    microsProgress: { [key: string]: number };
  };
  getLastLift: (
    exercise: string
  ) => Promise<{ weight?: number; reps?: string } | null>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(
  undefined
);

export const useActivity = () => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
};

const localKey = (uid: string, date: string) => `activity:${uid}:${date}`;
const liftsKey = (uid: string) => `lifts:last:${uid}`;

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [todayActivity, setTodayActivity] =
    useState<DailyActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const todayString = new Date().toISOString().split("T")[0];

  const didInitRef = useRef(false);
  const lastUidRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const pedoSubRef = useRef<any>(null);
  const fitnessEnabledRef = useRef<boolean>(true);

  useEffect(() => {
    const uid = user?.uid || null;
    if (uid === lastUidRef.current && didInitRef.current) return;
    lastUidRef.current = uid;

    if (!uid) {
      setTodayActivity(null);
      setLoading(false);
      didInitRef.current = false;
      stopPedo();
      return;
    }

    (async () => {
      const integ = await getIntegrations(uid);
      fitnessEnabledRef.current = !!integ.fitnessSync;
    })();

    if (!didInitRef.current) setLoading(true);
    fetchTodayActivity(uid).finally(() => {
      didInitRef.current = true;
      setLoading(false);
      startPedo();
    });

    return () => stopPedo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const startPedo = async () => {
    if (Platform.OS === "web") return;
    if (!fitnessEnabledRef.current) return;
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) return;
      pedoSubRef.current = Pedometer.watchStepCount((ev) => {
        const stepsLive = ev.steps || 0;
        if (todayActivity) {
          const next = Math.max(todayActivity.steps || 0, stepsLive);
          updateActivityDoc({ steps: next });
        }
      });
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0
      );
      const count = await Pedometer.getStepCountAsync(start, now);
      if (todayActivity) {
        updateActivityDoc({
          steps: Math.max(todayActivity.steps || 0, count.steps || 0),
        });
      }
    } catch {}
  };
  const stopPedo = () => {
    try {
      pedoSubRef.current?.remove?.();
      pedoSubRef.current = null;
    } catch {}
  };

  const readLocal = async (uid: string, date: string) => {
    try {
      const raw = await AsyncStorage.getItem(localKey(uid, date));
      if (!raw) return null;
      const data = JSON.parse(raw);
      data.createdAt = new Date(data.createdAt);
      data.workouts = (data.workouts || []).map((w: any) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      }));
      data.meals = (data.meals || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      if (typeof data.sleepHours !== "number") data.sleepHours = 0;
      return data as DailyActivity;
    } catch {
      return null;
    }
  };
  const writeLocal = async (activity: DailyActivity) => {
    try {
      await AsyncStorage.setItem(
        localKey(activity.userId, activity.date),
        JSON.stringify(activity)
      );
    } catch {}
  };

  const fetchTodayActivity = async (uid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const id = `${uid}_${todayString}`;
    const ref = doc(db, "activities", id);

    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const raw = snap.data() as any;
        const fromCloud: DailyActivity = {
          ...(raw as any),
          createdAt: raw?.createdAt?.toDate
            ? raw.createdAt.toDate()
            : new Date(raw?.createdAt || Date.now()),
          workouts: Array.isArray(raw?.workouts)
            ? raw.workouts.map((w: any) => ({
                ...w,
                timestamp: w?.timestamp?.toDate
                  ? w.timestamp.toDate()
                  : new Date(w?.timestamp || Date.now()),
              }))
            : [],
          meals: Array.isArray(raw?.meals)
            ? raw.meals.map((m: any) => ({
                ...m,
                timestamp: m?.timestamp?.toDate
                  ? m.timestamp.toDate()
                  : new Date(m?.timestamp || Date.now()),
              }))
            : [],
        };
        if (typeof fromCloud.sleepHours !== "number") fromCloud.sleepHours = 0;
        setTodayActivity(fromCloud);
        await writeLocal(fromCloud);
        fetchingRef.current = false;
        return;
      }
    } catch {}

    const fromLocal = await readLocal(uid, todayString);
    if (fromLocal) {
      setTodayActivity(fromLocal);
      fetchingRef.current = false;
      return;
    }

    const newActivity: DailyActivity = {
      id,
      userId: uid,
      date: todayString,
      steps: 0,
      waterIntake: 0,
      sleepHours: 0,
      workouts: [],
      meals: [],
      totalCalories: 0,
      macros: { protein: 0, carbs: 0, fat: 0 },
      micros: {},
      createdAt: new Date(),
    };
    try {
      await setDoc(ref, newActivity);
    } catch {}
    await writeLocal(newActivity);
    setTodayActivity(newActivity);
    fetchingRef.current = false;
  };

  const computeFromMeals = (meals: Meal[]) => {
    const totalCalories = meals.reduce(
      (sum, m) => sum + (m.calories || 0),
      0
    );
    const macros = meals.reduce(
      (sum, m) => ({
        protein: sum.protein + (m.macros?.protein || 0),
        carbs: sum.carbs + (m.macros?.carbs || 0),
        fat: sum.fat + (m.macros?.fat || 0),
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    const micros = meals.reduce((acc, m) => {
      Object.keys(m.micros || {}).forEach((k) => {
        acc[k] = (acc[k] || 0) + (m.micros[k] || 0);
      });
      return acc;
    }, {} as { [key: string]: number });
    return { totalCalories, macros, micros };
  };

  const safeCloudMerge = async (updated: DailyActivity) => {
    await writeLocal(updated);
    setTodayActivity(updated);
    if (!updated.userId) return;
    const ref = doc(db, "activities", `${updated.userId}_${updated.date}`);
    try {
      await setDoc(ref, updated, { merge: true });
    } catch {}
  };

  const updateActivityDoc = async (updates: Partial<DailyActivity>) => {
    if (!todayActivity) return;
    const updated: DailyActivity = { ...todayActivity, ...updates };
    await safeCloudMerge(updated);
  };

  const updateSteps = async (steps: number) =>
    updateActivityDoc({ steps });
  const addWater = async (amount: number) =>
    updateActivityDoc({
      waterIntake: (todayActivity?.waterIntake || 0) + amount,
    });
  const setSleepHours = async (hours: number) => {
    const h = Math.max(0, Math.min(24, Math.round(hours * 10) / 10));
    await updateActivityDoc({ sleepHours: h });
  };

  const addWorkout = async (w: Omit<Workout, "id" | "timestamp">) => {
    const newWorkout: Workout = {
      ...w,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    const workouts = [...(todayActivity?.workouts || []), newWorkout];
    await updateActivityDoc({ workouts });
  };

  // Persist last lifts (by exercise name) for progression hints
  async function updateLastLifts(
    uid: string,
    items: Workout["details"]["items"]
  ) {
    try {
      const key = liftsKey(uid);
      const raw = (await AsyncStorage.getItem(key)) || "{}";
      const map = JSON.parse(raw) as Record<
        string,
        { weight?: number; reps?: string; updatedAt: number }
      >;
      for (const it of items || []) {
        const name = String(it.exercise || "").trim();
        if (!name) continue;
        const lastSet = (it.sets || [])
          .slice()
          .reverse()
          .find((s) => s.weight != null || s.reps != null);
        if (lastSet) {
          map[name] = {
            weight: lastSet.weight,
            reps: lastSet.reps,
            updatedAt: Date.now(),
          };
        }
      }
      await AsyncStorage.setItem(key, JSON.stringify(map));
    } catch {}
  }

  const getLastLift = async (exercise: string) => {
    try {
      const uid = user?.uid;
      if (!uid) return null;
      const raw = (await AsyncStorage.getItem(liftsKey(uid))) || "{}";
      const map = JSON.parse(raw) as Record<
        string,
        { weight?: number; reps?: string; updatedAt: number }
      >;
      return map[exercise] || null;
    } catch {
      return null;
    }
  };

  const addWorkoutSession = async (s: {
    name: string;
    duration: number;
    caloriesBurned: number;
    type: Workout["type"];
    startedAt: number;
    endedAt: number;
    items: Workout["details"]["items"];
  }) => {
    const totalSets = s.items.reduce(
      (acc, it) => acc + (it.sets?.length || 0),
      0
    );
    const newWorkout: Workout = {
      id: Date.now().toString(),
      name: s.name,
      duration: s.duration,
      caloriesBurned: s.caloriesBurned,
      type: s.type,
      timestamp: new Date(),
      details: {
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        totalSets,
        items: s.items,
      },
    };
    const workouts = [...(todayActivity?.workouts || []), newWorkout];
    await updateActivityDoc({ workouts });
    if (user?.uid) await updateLastLifts(user.uid, s.items);
  };

  const removeWorkout = async (id: string) => {
    const workouts = (todayActivity?.workouts || []).filter(
      (w) => w.id !== id
    );
    await updateActivityDoc({ workouts });
  };

  const addMeal = async (m: Omit<Meal, "id" | "timestamp">) => {
    const newMeal: Meal = {
      ...m,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    const meals = [...(todayActivity?.meals || []), newMeal];
    const totals = computeFromMeals(meals);
    await updateActivityDoc({ meals, ...totals });
  };

  const updateMeal = async (
    id: string,
    patch: Partial<Omit<Meal, "id" | "timestamp">>
  ) => {
    const meals = (todayActivity?.meals || []).map((m) =>
      m.id === id
        ? {
            ...m,
            ...patch,
            macros:
              patch.macros != null ? { ...m.macros, ...patch.macros } : m.macros,
          }
        : m
    );
    const totals = computeFromMeals(meals);
    await updateActivityDoc({ meals, ...totals });
  };

  const removeMeal = async (id: string) => {
    const meals = (todayActivity?.meals || []).filter((m) => m.id !== id);
    const totals = computeFromMeals(meals);
    await updateActivityDoc({ meals, ...totals });
  };

  const getTodayProgress = () => {
    const caloriesConsumed = todayActivity?.totalCalories || 0;
    const targetCalories = userProfile?.dailyCalories || 2000;
    const caloriesRemaining = Math.round(Math.max(0, targetCalories - caloriesConsumed));
    const macrosProgress = {
      protein: Math.min(
        100,
        ((todayActivity?.macros.protein || 0) /
          Math.max(1, userProfile?.macros.protein || 0)) *
          100
      ),
      carbs: Math.min(
        100,
        ((todayActivity?.macros.carbs || 0) /
          Math.max(1, userProfile?.macros.carbs || 0)) *
          100
      ),
      fat: Math.min(
        100,
        ((todayActivity?.macros.fat || 0) /
          Math.max(1, userProfile?.macros.fat || 0)) *
          100
      ),
    };
    const microsProgress: { [key: string]: number } = {};
    if (userProfile?.micros && todayActivity?.micros) {
      Object.keys(userProfile.micros).forEach((k) => {
        const consumedMic = todayActivity.micros[k] || 0;
        const targetMic = (userProfile.micros as any)[k] || 1;
        microsProgress[k] = Math.min(100, (consumedMic / targetMic) * 100);
      });
    }
    return {
      caloriesConsumed,
      caloriesRemaining,
      macrosProgress,
      microsProgress,
    };
  };

  return (
    <ActivityContext.Provider
      value={{
        todayActivity,
        loading,
        updateSteps,
        addWater,
        setSleepHours,
        addWorkout,
        addWorkoutSession,
        removeWorkout,
        addMeal,
        updateMeal,
        removeMeal,
        getTodayProgress,
        getLastLift,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
};