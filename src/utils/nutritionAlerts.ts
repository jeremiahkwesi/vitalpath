// src/utils/nutritionAlerts.ts
import { DailyActivity } from "../context/ActivityContext";
import { UserProfile } from "../context/AuthContext";
import { rdiBaseline } from "./micros";

type AlertMsg = string;

export function computeNutritionAlerts(
  profile: UserProfile | null,
  today: DailyActivity | null
): AlertMsg[] {
  const msgs: AlertMsg[] = [];
  if (!profile) return msgs;

  const age = profile.age || 25;
  const gender = profile.gender || "male";
  const rdi = rdiBaseline(age, gender as any);

  // Calories
  const cal = today?.totalCalories || 0;
  const target = profile.dailyCalories || 2000;
  const diff = target - cal;
  if (diff < -150) {
    msgs.push(
      `You’re over target by ${Math.abs(diff)} kcal. Consider a lighter dinner or a short walk.`
    );
  } else if (diff > 200) {
    msgs.push(
      `You still have ~${diff} kcal. Add a balanced snack if hungry (protein + fiber).`
    );
  }

  // Protein adequacy
  const p = today?.macros?.protein || 0;
  const pTarget = profile?.macros?.protein || Math.round((target * 0.3) / 4);
  if (p < pTarget * 0.7) {
    msgs.push(`Protein is low vs target. Aim for lean protein next meal.`);
  }

  // Fiber estimate (if tracked in micros)
  const fiber = (today?.micros as any)?.fiber || 0;
  if (rdi.fiber && fiber < rdi.fiber * 0.6) {
    msgs.push(`Fiber is low. Add vegetables, beans, or whole grains.`);
  }

  // Sodium upper bound (if tracked)
  const sodium = (today?.micros as any)?.sodium || 0;
  if (rdi.sodium && sodium > rdi.sodium) {
    msgs.push(`Sodium is high. Choose lower-sodium options for dinner.`);
  }

  // Hydration
  const w = today?.waterIntake || 0;
  if (w < (profile?.micros ? 1500 : 1500)) {
    msgs.push(`Hydration behind. Drink a glass of water now.`);
  }

  // Health conditions tailoring (examples)
  if ((profile.healthConditions || []).find((c) => c.toLowerCase().includes("hypertension"))) {
    msgs.push(`Hypertension: keep sodium below 1500–2300 mg; avoid high-sodium sauces.`);
  }
  if ((profile.healthConditions || []).find((c) => c.toLowerCase().includes("diabetes"))) {
    msgs.push(`Diabetes: prefer low-GI carbs and pair carbs with protein/fiber.`);
  }

  return msgs.slice(0, 3);
}