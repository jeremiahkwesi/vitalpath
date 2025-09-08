// src/services/aiPlans.ts
type DayName = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export type MealPlanOptions = {
  dailyCalories: number;
  mealsPerDay: 3 | 4 | 5;
  preferences?: string[];
  allergies?: string[];
};

export type WorkoutPlanOptions = {
  daysPerWeek: number;
  goal: "hypertrophy" | "strength" | "fat_loss" | "general";
  experience: "beginner" | "intermediate" | "advanced";
  sessionLengthMin: number;
  equipment: string[];
  focus: "full_body" | "upper_lower" | "ppl" | "emphasis";
};

export type AIPlan = {
  weeklyPlan: {
    meals: {
      day: DayName;
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

const DAYS: DayName[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

// Meal planner (local heuristic)
export async function generateMealPlanLocal(
  opts: MealPlanOptions
): Promise<AIPlan> {
  const total = clamp(opts.dailyCalories || 2000, 1200, 4000);
  const meals = opts.mealsPerDay || 3;
  const splits =
    meals === 3
      ? [0.25, 0.4, 0.35]
      : meals === 4
      ? [0.25, 0.3, 0.3, 0.15]
      : [0.2, 0.3, 0.3, 0.1, 0.1];

  const base = [
    { name: "Yogurt + Berries", calories: 250, protein: 15, carbs: 35, fat: 5 },
    { name: "Chicken & Rice", calories: 600, protein: 40, carbs: 70, fat: 15 },
    { name: "Omelette + Toast", calories: 450, protein: 25, carbs: 35, fat: 18 },
    { name: "Salmon + Quinoa", calories: 550, protein: 35, carbs: 45, fat: 18 },
    { name: "Tofu Stir-fry", calories: 500, protein: 25, carbs: 50, fat: 16 },
    { name: "Protein Oats", calories: 400, protein: 25, carbs: 50, fat: 10 },
    { name: "Tuna Salad", calories: 350, protein: 28, carbs: 20, fat: 16 },
  ];

  const week: AIPlan["weeklyPlan"]["meals"] = [];
  for (let d = 0; d < 7; d++) {
    const items: AIPlan["weeklyPlan"]["meals"][number]["items"] = [];
    for (let i = 0; i < meals; i++) {
      const target = Math.round(total * splits[i]);
      const pick = base[(d + i) % base.length];
      const r = target / pick.calories;
      items.push({
        name: pick.name,
        calories: Math.round(pick.calories * r),
        protein: Math.round(pick.protein * r),
        carbs: Math.round(pick.carbs * r),
        fat: Math.round(pick.fat * r),
      });
    }
    week.push({ day: DAYS[d], items });
  }
  return { weeklyPlan: { meals: week } };
}

// Workout routine generator (local with warm-ups, supersets, finishers)
type DraftRoutineSet = { reps?: string; restSec: number; type: "normal" | "timed" };
type DraftRoutineItem = { name: string; day: DayName; sets: DraftRoutineSet[]; groupId?: string };

export async function generateWorkoutRoutineLocal(
  opts: WorkoutPlanOptions
): Promise<{ name: string; items: DraftRoutineItem[] }> {
  const days = clamp(Math.round(opts.daysPerWeek || 3), 2, 6);
  const level = opts.experience;
  const goal = opts.goal;

  const mainSets = level === "advanced" ? 4 : 3;
  const accSets = level === "advanced" ? 4 : 3;
  const restMain = goal === "strength" ? 150 : goal === "hypertrophy" ? 90 : 75;
  const restAcc = goal === "strength" ? 120 : 75;

  // set builders
  const SMain = () =>
    Array.from({ length: mainSets }, () => ({
      reps: goal === "strength" ? "3-6" : "8-12",
      restSec: restMain,
      type: "normal" as const,
    }));
  const SAcc = () =>
    Array.from({ length: accSets }, () => ({
      reps: "10-15",
      restSec: restAcc,
      type: "normal" as const,
    }));
  const SWarm = () => [{ reps: "10 (warm-up)", restSec: 60, type: "normal" as const }];
  const SFinisher = (sec = 60) => [{ reps: `${sec}s`, restSec: 30, type: "timed" as const }];

  const C = {
    Chest: ["Barbell Bench Press", "Incline Dumbbell Press", "Push-Up"],
    Back: ["Pull-Up", "Barbell Row", "Lat Pulldown"],
    Shoulders: ["Overhead Press", "Dumbbell Lateral Raise", "Rear Delt Fly"],
    Quads: ["Back Squat", "Leg Press", "Lunge"],
    Hamstrings: ["Romanian Deadlift", "Leg Curl", "Hip Hinge"],
    Glutes: ["Hip Thrust", "Bulgarian Split Squat", "Glute Bridge"],
    Biceps: ["Barbell Curl", "Dumbbell Curl", "Hammer Curl"],
    Triceps: ["Triceps Pushdown", "Skull Crusher", "Close-Grip Bench"],
    Core: ["Plank", "Hanging Leg Raise", "Cable Woodchop"],
    Calves: ["Standing Calf Raise", "Seated Calf Raise", "Single-leg Calf"],
    Conditioning: ["Mountain Climbers", "Burpees", "Jump Rope"],
  };

  const daysList: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const items: DraftRoutineItem[] = [];
  const add = (name: string, day: DayName, sets: DraftRoutineSet[], groupId?: string) =>
    items.push({ name, day, sets, groupId });

  const addSuperset = (
    a: { name: string; sets?: DraftRoutineSet[] },
    b: { name: string; sets?: DraftRoutineSet[] },
    day: DayName,
    id: string
  ) => {
    add(a.name, day, a.sets || SAcc(), id);
    add(b.name, day, b.sets || SAcc(), id);
  };

  if (opts.focus === "ppl" && days >= 3) {
    const seq = ["Push", "Pull", "Legs", "Push", "Pull", "Legs"];
    for (let i = 0; i < days; i++) {
      const label = seq[i];
      const day = daysList[i] as DayName;
      if (label === "Push") {
        add(C.Chest[0], day, [...SWarm(), ...SMain()]);
        add(C.Shoulders[0], day, SMain());
        addSuperset({ name: C.Triceps[0] }, { name: C.Chest[2] }, day, "A");
        add(C.Core[0], day, SFinisher(60));
      } else if (label === "Pull") {
        add(C.Back[0], day, [...SWarm(), ...SMain()]);
        add(C.Back[1], day, SMain());
        addSuperset({ name: C.Biceps[0] }, { name: C.Biceps[2] }, day, "A");
        add(C.Core[1], day, SFinisher(60));
      } else {
        add(C.Quads[0], day, [...SWarm(), ...SMain()]);
        add(C.Hamstrings[0], day, SMain());
        addSuperset({ name: C.Glutes[0] }, { name: C.Calves[0] }, day, "A");
        add(C.Conditioning[2], day, SFinisher(90));
      }
    }
    return { name: "PPL Program", items };
  }

  if (opts.focus === "upper_lower" && days >= 2) {
    const seq = ["Upper", "Lower", "Upper", "Lower", "Upper", "Lower"];
    for (let i = 0; i < days; i++) {
      const day = daysList[i] as DayName;
      if (seq[i] === "Upper") {
        add(C.Chest[0], day, [...SWarm(), ...SMain()]);
        add(C.Back[0], day, SMain());
        add(C.Shoulders[0], day, SAcc());
        addSuperset({ name: C.Biceps[0] }, { name: C.Triceps[0] }, day, "A");
        add(C.Core[0], day, SFinisher(60));
      } else {
        add(C.Quads[0], day, [...SWarm(), ...SMain()]);
        add(C.Hamstrings[0], day, SMain());
        addSuperset({ name: C.Glutes[0] }, { name: C.Calves[0] }, day, "A");
        add(C.Core[1], day, SFinisher(60));
      }
    }
    return { name: "Upper / Lower", items };
  }

  // Full body default
  for (let i = 0; i < days; i++) {
    const day = daysList[i] as DayName;
    add(C.Quads[0], day, [...SWarm(), ...SMain()]);
    add(C.Chest[0], day, SMain());
    add(C.Back[0], day, SMain());
    addSuperset({ name: C.Shoulders[0] }, { name: C.Core[0], sets: SFinisher(45) }, day, "A");
  }
  return { name: "Full Body", items };
}