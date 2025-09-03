// src/utils/achievements.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Badge =
  | "STEPS_6K"
  | "STEPS_10K"
  | "HYDRATE_2L"
  | "CALORIE_GOAL"
  | "PROTEIN_100"
  | "STREAK_7"
  | "STREAK_14";

export type Achievement = {
  id: Badge;
  title: string;
  description: string;
  earnedAt: string; // ISO
};

const key = (uid: string) => `achievements:${uid}`;

export const BADGE_META: Record<Badge, { title: string; description: string }> = {
  STEPS_6K: { title: "Step Starter", description: "Hit 6,000+ steps in a day" },
  STEPS_10K: { title: "10K Walker", description: "Hit 10,000+ steps in a day" },
  HYDRATE_2L: { title: "Hydrate Hero", description: "Drink 2 liters of water" },
  CALORIE_GOAL: { title: "Calorie Captain", description: "Stay within your calorie goal" },
  PROTEIN_100: { title: "Protein Pro", description: "Hit 100g+ protein" },
  STREAK_7: { title: "7‑Day Streak", description: "Stay on track for 7 days" },
  STREAK_14: { title: "14‑Day Streak", description: "Stay on track for 14 days" },
};

export async function getAchievements(uid: string): Promise<Achievement[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return [];
    return JSON.parse(raw) as Achievement[];
  } catch {
    return [];
  }
}

export async function addAchievement(uid: string, badge: Badge) {
  const list = await getAchievements(uid);
  if (list.find((a) => a.id === badge)) return list;
  const meta = BADGE_META[badge];
  const next: Achievement = {
    id: badge,
    title: meta.title,
    description: meta.description,
    earnedAt: new Date().toISOString(),
  };
  const out = [next, ...list].slice(0, 100);
  await AsyncStorage.setItem(key(uid), JSON.stringify(out));
  return out;
}

// Evaluate achievements for today’s data and streak.
// Returns the newly unlocked badges (if any).
export async function evaluateTodayBadges(params: {
  uid: string;
  steps: number;
  waterMl: number;
  calories: number;
  calorieGoal: number;
  proteinG: number;
  streakDays: number;
}) {
  const { uid, steps, waterMl, calories, calorieGoal, proteinG, streakDays } =
    params;
  const newly: Badge[] = [];
  const existing = await getAchievements(uid);
  const has = (b: Badge) => existing.some((a) => a.id === b);

  const withinCalorie = calorieGoal > 0 && calories <= calorieGoal + 50; // small buffer

  if (steps >= 6000 && !has("STEPS_6K")) newly.push("STEPS_6K");
  if (steps >= 10000 && !has("STEPS_10K")) newly.push("STEPS_10K");
  if (waterMl >= 2000 && !has("HYDRATE_2L")) newly.push("HYDRATE_2L");
  if (withinCalorie && !has("CALORIE_GOAL")) newly.push("CALORIE_GOAL");
  if (proteinG >= 100 && !has("PROTEIN_100")) newly.push("PROTEIN_100");
  if (streakDays >= 7 && !has("STREAK_7")) newly.push("STREAK_7");
  if (streakDays >= 14 && !has("STREAK_14")) newly.push("STREAK_14");

  for (const b of newly) {
    await addAchievement(uid, b);
  }
  return newly;
}