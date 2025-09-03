// src/utils/mealPlanner.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type PlannedMeal = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  slot: MealSlot;
  // Optional grams for the total portion
  grams?: number;
  // Optional per-item breakdown for mixed meals
  components?: { name: string; grams: number }[];
};
export type DayPlan = { date: string; meals: PlannedMeal[] };

const key = (uid: string) => `planner:${uid}`;

export async function getPlanner(uid: string): Promise<Record<string, DayPlan>> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function setPlannedMeal(
  uid: string,
  date: string,
  meal: PlannedMeal
) {
  const store = await getPlanner(uid);
  const day = store[date] || { date, meals: [] as PlannedMeal[] };
  const others = day.meals.filter((m) => m.slot !== meal.slot);
  day.meals = [...others, meal];
  const next = { ...store, [date]: day };
  await AsyncStorage.setItem(key(uid), JSON.stringify(next));
  return next;
}

export async function clearDay(uid: string, date: string) {
  const store = await getPlanner(uid);
  delete store[date];
  await AsyncStorage.setItem(key(uid), JSON.stringify(store));
  return store;
}

// Apply AI plan (example week) into the planner week
type AIPlan = {
  weeklyPlan: {
    meals: {
      day: string; // Sun..Sat
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
};

const dayOrder = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function addDaysISO(d: Date, n: number): string {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x.toISOString().split("T")[0];
}

function detectSlot(name: string, index: number): MealSlot {
  const s = name.toLowerCase();
  if (s.includes("breakfast")) return "breakfast";
  if (s.includes("lunch")) return "lunch";
  if (s.includes("dinner") || s.includes("supper")) return "dinner";
  if (s.includes("snack")) return "snack";
  if (index === 0) return "breakfast";
  if (index === 1) return "lunch";
  if (index === 2) return "dinner";
  return "snack";
}

function parseServingToGrams(serving?: string | null): number | undefined {
  if (!serving) return undefined;
  const m = String(serving).match(/(\d+(\.\d+)?)\s*g/i);
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]));
}

export async function applyPlanWeekToPlanner(
  uid: string,
  weekStart: Date,
  plan: AIPlan
) {
  const map: Record<string, any[]> = {};
  for (const d of plan.weeklyPlan.meals || []) {
    map[d.day] = d.items || [];
  }

  for (let i = 0; i < 7; i++) {
    const dateISO = addDaysISO(weekStart, i);
    const dow = dayOrder[i];
    const items = map[dow] || [];
    for (let j = 0; j < Math.min(4, items.length); j++) {
      const it = items[j];
      const slot = detectSlot(it.name, j);
      await setPlannedMeal(uid, dateISO, {
        name: it.name,
        calories: Math.round(it.calories || 0),
        protein: Math.round(it.protein || 0),
        carbs: Math.round(it.carbs || 0),
        fat: Math.round(it.fat || 0),
        slot,
        grams: it.grams ?? parseServingToGrams(it.serving),
        components: Array.isArray(it.components) ? it.components : undefined,
      });
    }
  }
}