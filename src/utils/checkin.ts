// src/utils/checkin.ts
import type { UserProfile } from "../context/AuthContext";
import type { WeightEntry } from "./weight";

export type AdjustPlan = {
  suggestion: "increase" | "decrease" | "maintain";
  delta: number; // kcal/day, positive or negative
  newTarget: number; // kcal/day
  reason: string;
};

export function suggestCalorieAdjustment(
  profile: UserProfile,
  weights: WeightEntry[]
): AdjustPlan | null {
  if (!profile) return null;
  if ((weights || []).length < 7) return null;

  const goal = profile.goal || "maintain";
  const currentTarget = profile.dailyCalories || 2000;

  // Compute weekly change (last 14 days)
  const last = weights.slice(-14);
  if (last.length < 7) return null;

  const first = last[0];
  const end = last[last.length - 1];
  const changeKg = end.kg - first.kg; // positive = gain
  const weeks = (last.length - 1) / 7;
  const rate = changeKg / Math.max(1, weeks); // kg/week

  // Desired rate by goal
  let desired = 0;
  if (goal === "lose_weight" || goal === "lose_fat") desired = -0.45; // ~0.5 kg/wk
  else if (goal === "gain_weight" || goal === "gain_muscle") desired = 0.25; // 0.25 kg/wk
  else desired = 0;

  // Difference in rate
  const diff = rate - desired; // positive => losing too slow or gaining too fast
  // Approx kcal per kg: 7700 kcal, per week => per day
  const kcalPerKgPerDay = 7700 / 7;
  let delta = Math.round(-diff * kcalPerKgPerDay); // negative diff => increase cals

  // Guard rails
  const maxStep = 250; // +/- per adjustment
  if (delta > maxStep) delta = maxStep;
  if (delta < -maxStep) delta = -maxStep;

  // Snap to 50s
  delta = Math.round(delta / 50) * 50;

  if (Math.abs(delta) < 50) {
    return {
      suggestion: "maintain",
      delta: 0,
      newTarget: currentTarget,
      reason: `Rate ${rate.toFixed(2)} kg/wk ~ desired ${desired} kg/wk. Keep current target.`,
    };
  }

  const newTarget = Math.max(1200, Math.round(currentTarget + delta));
  return {
    suggestion: delta > 0 ? "increase" : "decrease",
    delta,
    newTarget,
    reason: `Recent rate ${rate.toFixed(
      2
    )} kg/wk vs goal ${desired} kg/wk → adjust ${delta > 0 ? "+" : ""}${delta} kcal/day.`,
  };
}