// src/context/ActivityContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../config/firebase";
import { useAuth } from "./AuthContext";

export interface Workout {
  id: string;
  name: string;
  duration: number; // minutes
  caloriesBurned: number;
  type: "cardio" | "strength" | "flexibility" | "sports" | "other";
  timestamp: Date;
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
  sleepHours: number; // new
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
  removeWorkout: (id: string) => Promise<void>;
  addMeal: (m: Omit<Meal, "id" | "timestamp">) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  getTodayProgress: () => {
    caloriesConsumed: number;
    caloriesRemaining: number;
    macrosProgress: { protein: number; carbs: number; fat: number };
    microsProgress: { [key: string]: number };
  };
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const useActivity = () => {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
};

const localKey = (uid: string, date: string) => `activity:${uid}:${date}`;

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [todayActivity, setTodayActivity] = useState<DailyActivity | null>(null);
  const [loading, setLoading] = useState(true);

  const { user, userProfile } = useAuth();
  const todayString = new Date().toISOString().split("T")[0];

  // Refs to avoid repeated initial loads and flicker
  const didInitRef = useRef(false);
  const lastUidRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Only fetch when UID truly changes
    const uid = user?.uid || null;
    if (uid === lastUidRef.current && didInitRef.current) {
      return;
    }
    lastUidRef.current = uid;

    if (!uid) {
      // No user, clear state
      setTodayActivity(null);
      setLoading(false);
      didInitRef.current = false;
      return;
    }

    // First load shows loader; subsequent refreshes don't toggle loading
    if (!didInitRef.current) setLoading(true);
    fetchTodayActivity(uid).finally(() => {
      didInitRef.current = true;
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const readLocal = async (uid: string, date: string) => {
    try {
      const raw = await AsyncStorage.getItem(localKey(uid, date));
      if (!raw) return null;
      const data = JSON.parse(raw);
      // revive dates
      data.createdAt = new Date(data.createdAt);
      data.workouts = (data.workouts || []).map((w: any) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      }));
      data.meals = (data.meals || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
      // Backward compatibility: ensure sleepHours
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
    } catch (e) {
      console.log("Local persist failed:", e);
    }
  };

  const fetchTodayActivity = async (uid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const id = `${uid}_${todayString}`;
    const ref = doc(db, "activities", id);

    // 1) Try Firestore
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const fromCloud = snap.data() as DailyActivity;
        if (typeof fromCloud.sleepHours !== "number") fromCloud.sleepHours = 0;
        setTodayActivity(fromCloud);
        await writeLocal(fromCloud);
        fetchingRef.current = false;
        return;
      }
    } catch (e) {
      console.log("Firestore fetch failed, fallback to local:", e);
    }

    // 2) Fallback to local
    const fromLocal = await readLocal(uid, todayString);
    if (fromLocal) {
      setTodayActivity(fromLocal);
      fetchingRef.current = false;
      return;
    }

    // 3) Create fresh
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
    } catch (e) {
      console.log("Cannot write cloud; will use local only:", e);
    }
    await writeLocal(newActivity);
    setTodayActivity(newActivity);
    fetchingRef.current = false;
  };

  const safeCloudMerge = async (updated: DailyActivity) => {
    // Always save local and update state
    await writeLocal(updated);
    setTodayActivity(updated);

    // Best-effort cloud merge; don't toggle loading
    if (!updated.userId) return;
    const ref = doc(db, "activities", `${updated.userId}_${updated.date}`);
    try {
      await setDoc(ref, updated, { merge: true });
    } catch (e) {
      console.log("Cloud merge failed (will catch up later):", e);
    }
  };

  const computeFromMeals = (meals: Meal[]) => {
    const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
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

  const updateActivityDoc = async (updates: Partial<DailyActivity>) => {
    if (!todayActivity) return;
    const updated: DailyActivity = { ...todayActivity, ...updates };
    await safeCloudMerge(updated);
  };

  const updateSteps = async (steps: number) => {
    await updateActivityDoc({ steps });
  };

  const addWater = async (amount: number) => {
    const next = (todayActivity?.waterIntake || 0) + amount;
    await updateActivityDoc({ waterIntake: next });
  };

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

  const removeWorkout = async (id: string) => {
    const workouts = (todayActivity?.workouts || []).filter((w) => w.id !== id);
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

  const removeMeal = async (id: string) => {
    const meals = (todayActivity?.meals || []).filter((m) => m.id !== id);
    const totals = computeFromMeals(meals);
    await updateActivityDoc({ meals, ...totals });
  };

  const getTodayProgress = () => {
    const caloriesConsumed = todayActivity?.totalCalories || 0;
    const targetCalories = userProfile?.dailyCalories || 2000;
    const caloriesRemaining = Math.max(0, targetCalories - caloriesConsumed);

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
        removeWorkout,
        addMeal,
        removeMeal,
        getTodayProgress,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
};