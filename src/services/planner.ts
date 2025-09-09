import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type Macros = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  [key: string]: number | undefined;
};

export type PlannedItem = {
  id: string;
  name: string;
  source?: "pantry" | "custom" | "recipe" | "search";
  macros?: Macros;
  quantity?: string;
  unit?: string;
  imageUrl?: string;
  notes?: string;
};

export type DayPlan = {
  date: string; // YYYY-MM-DD
  meals: {
    breakfast: PlannedItem[];
    lunch: PlannedItem[];
    dinner: PlannedItem[];
    snack: PlannedItem[];
  };
  updatedAt?: any;
};

const MEAL_KEYS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

async function ensurePlanDoc(uid: string, dayKey: string): Promise<void> {
  const ref = doc(db, "users", uid, "plans", dayKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const empty: DayPlan = {
      date: dayKey,
      meals: {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      },
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, empty);
  }
}

export async function getDayPlan(uid: string, dayKey: string): Promise<DayPlan> {
  const ref = doc(db, "users", uid, "plans", dayKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await ensurePlanDoc(uid, dayKey);
    return getDayPlan(uid, dayKey);
  }
  return snap.data() as DayPlan;
}

export async function addItemToPlan(
  uid: string,
  dayKey: string,
  meal: MealType,
  item: PlannedItem
): Promise<void> {
  await ensurePlanDoc(uid, dayKey);
  const ref = doc(db, "users", uid, "plans", dayKey);
  await updateDoc(ref, {
    [`meals.${meal}`]: arrayUnion(item),
    updatedAt: serverTimestamp(),
  } as any);
}

export async function replaceMealItems(
  uid: string,
  dayKey: string,
  meal: MealType,
  items: PlannedItem[]
): Promise<void> {
  await ensurePlanDoc(uid, dayKey);
  const ref = doc(db, "users", uid, "plans", dayKey);
  await updateDoc(ref, {
    [`meals.${meal}`]: items,
    updatedAt: serverTimestamp(),
  } as any);
}

export async function removeItemFromPlan(
  uid: string,
  dayKey: string,
  meal: MealType,
  itemId: string
): Promise<void> {
  const current = await getDayPlan(uid, dayKey);
  const filtered = current.meals[meal].filter((x) => x.id !== itemId);
  await replaceMealItems(uid, dayKey, meal, filtered);
}

export async function getWeekPlan(
  uid: string,
  anyDayInWeek: Date
): Promise<Record<string, DayPlan>> {
  const start = startOfWeek(anyDayInWeek, 1);
  const result: Record<string, DayPlan> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dateKey(d);
    result[key] = await getDayPlan(uid, key);
  }
  return result;
}

export async function applyDayPlanToDiary(
  uid: string,
  dayKey: string
): Promise<void> {
  const plan = await getDayPlan(uid, dayKey);
  const diaryRef = doc(db, "users", uid, "diary", dayKey);
  const payload = {
    date: dayKey,
    meals: plan.meals,
    fromPlan: true,
    updatedAt: serverTimestamp(),
  };
  await setDoc(diaryRef, payload, { merge: true });
}

export function newItemId(): string {
  // @ts-ignore
  return globalThis?.crypto?.randomUUID?.() ?? String(Date.now());
}

export async function applyPlanWeekToPlanner(
  uid: string,
  weekStart: Date,
  plan: {
    weeklyPlan: {
      meals: {
        day: string;
        items: {
          name: string;
          serving?: string;
          grams?: number;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          components?: { name: string; grams: number }[];
        }[];
      }[];
    };
  }
) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const map: Record<string, any[]> = {};
  for (const d of plan.weeklyPlan.meals || []) {
    map[d.day] = d.items || [];
  }
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = dateKey(d);
    await ensurePlanDoc(uid, key);
    const items = map[days[i]] || [];
    // naive: map to four meals (breakfast, lunch, dinner, snack)
    const mealKeys: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
    for (let j = 0; j < mealKeys.length; j++) {
      const it = items[j];
      if (!it) {
        await replaceMealItems(uid, key, mealKeys[j], []);
        continue;
      }
      const item = {
        id: newItemId(),
        name: it.name,
        source: "recipe" as const,
        macros: {
          kcal: Math.round(it.calories || 0),
          protein: Math.round(it.protein || 0),
          carbs: Math.round(it.carbs || 0),
          fat: Math.round(it.fat || 0),
        },
      };
      await replaceMealItems(uid, key, mealKeys[j], [item]);
    }
  }
}