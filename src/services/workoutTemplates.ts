import AsyncStorage from "@react-native-async-storage/async-storage";

type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export type TemplateSet = { reps: string; restSec: number; type?: string };
export type TemplateItem = { name: string; sets: TemplateSet[]; day: Day };
export type WorkoutTemplate = {
  id: string;
  name: string;
  description?: string;
  days: Day[];
  items: TemplateItem[];
};

const S = (reps: string, restSec = 90): TemplateSet => ({
  reps,
  restSec,
  type: "normal",
});

// Helpers to make days
const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pickDays = (labels: Day[]) => labels;

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: "ppl-3",
    name: "3-Day Push / Pull / Legs",
    description: "Balanced PPL split for 3 days a week.",
    days: pickDays(["Mon", "Wed", "Fri"]),
    items: [
      // Push
      { day: "Mon", name: "Barbell Bench Press", sets: [S("5x5", 150)] },
      { day: "Mon", name: "Incline Dumbbell Press", sets: [S("3x8-10")] },
      { day: "Mon", name: "Overhead Press", sets: [S("3x6-8", 120)] },
      { day: "Mon", name: "Dumbbell Lateral Raise", sets: [S("3x12-15", 60)] },
      { day: "Mon", name: "Triceps Pushdown", sets: [S("3x10-12", 60)] },

      // Pull
      { day: "Wed", name: "Barbell Row", sets: [S("4x6-8", 120)] },
      { day: "Wed", name: "Lat Pulldown", sets: [S("3x8-12", 90)] },
      { day: "Wed", name: "Seated Cable Row", sets: [S("3x10-12", 90)] },
      { day: "Wed", name: "Pull-Up", sets: [S("3xAMRAP", 120)] },
      { day: "Wed", name: "Hammer Curl", sets: [S("3x10-12", 60)] },

      // Legs
      { day: "Fri", name: "Back Squat", sets: [S("5x5", 180)] },
      { day: "Fri", name: "Romanian Deadlift", sets: [S("3x6-8", 150)] },
      { day: "Fri", name: "Bulgarian Split Squat", sets: [S("3x8-10", 90)] },
      { day: "Fri", name: "Standing Calf Raise", sets: [S("4x12-15", 60)] },
      { day: "Fri", name: "Plank", sets: [S("3x60s", 60)] },
    ],
  },
  {
    id: "ul-4",
    name: "4-Day Upper / Lower",
    description: "Alternating Upper and Lower sessions.",
    days: pickDays(["Mon", "Tue", "Thu", "Fri"]),
    items: [
      // Upper A
      { day: "Mon", name: "Barbell Bench Press", sets: [S("4x6-8", 150)] },
      { day: "Mon", name: "Overhead Press", sets: [S("3x6-8", 120)] },
      { day: "Mon", name: "Lat Pulldown", sets: [S("3x8-12", 90)] },
      { day: "Mon", name: "Seated Cable Row", sets: [S("3x8-12", 90)] },
      { day: "Mon", name: "Dumbbell Curl", sets: [S("3x10-12", 60)] },

      // Lower A
      { day: "Tue", name: "Back Squat", sets: [S("5x5", 180)] },
      { day: "Tue", name: "Romanian Deadlift", sets: [S("3x6-8", 150)] },
      { day: "Tue", name: "Walking Lunge", sets: [S("3x10-12", 90)] },
      { day: "Tue", name: "Standing Calf Raise", sets: [S("4x12-15", 60)] },
      { day: "Tue", name: "Plank", sets: [S("3x60s", 60)] },

      // Upper B
      { day: "Thu", name: "Incline Dumbbell Press", sets: [S("4x8-10", 120)] },
      { day: "Thu", name: "Barbell Row", sets: [S("4x6-8", 120)] },
      { day: "Thu", name: "Rear Delt Fly", sets: [S("3x12-15", 60)] },
      { day: "Thu", name: "Face Pull", sets: [S("3x12-15", 60)] },
      { day: "Thu", name: "EZ-Bar Skullcrusher", sets: [S("3x10-12", 60)] },

      // Lower B
      { day: "Fri", name: "Front Squat", sets: [S("4x4-6", 180)] },
      { day: "Fri", name: "Bulgarian Split Squat", sets: [S("3x8-10", 90)] },
      { day: "Fri", name: "Barbell Hip Thrust", sets: [S("4x8-10", 120)] },
      { day: "Fri", name: "Standing Calf Raise", sets: [S("4x12-15", 60)] },
      { day: "Fri", name: "Hanging Leg Raise", sets: [S("3x10-12", 60)] },
    ],
  },
  {
    id: "ppl-5",
    name: "5-Day Upper/Lower + PPL Hybrid",
    description: "A balanced 5-day progression-focused split.",
    days: pickDays(["Mon", "Tue", "Wed", "Fri", "Sat"]),
    items: [
      // Upper
      { day: "Mon", name: "Barbell Bench Press", sets: [S("5x5", 150)] },
      { day: "Mon", name: "Overhead Press", sets: [S("3x6-8", 120)] },
      { day: "Mon", name: "Lat Pulldown", sets: [S("3x8-12", 90)] },
      { day: "Mon", name: "Dumbbell Lateral Raise", sets: [S("3x12-15", 60)] },

      // Lower
      { day: "Tue", name: "Back Squat", sets: [S("5x5", 180)] },
      { day: "Tue", name: "Romanian Deadlift", sets: [S("3x6-8", 150)] },
      { day: "Tue", name: "Walking Lunge", sets: [S("3x10-12", 90)] },
      { day: "Tue", name: "Standing Calf Raise", sets: [S("4x12-15", 60)] },

      // Push
      { day: "Wed", name: "Incline Dumbbell Press", sets: [S("4x8-10", 120)] },
      { day: "Wed", name: "Overhead Press", sets: [S("3x6-8", 120)] },
      { day: "Wed", name: "Triceps Pushdown", sets: [S("3x10-12", 60)] },
      { day: "Wed", name: "Push-Up", sets: [S("3xAMRAP", 90)] },

      // Pull
      { day: "Fri", name: "Barbell Row", sets: [S("4x6-8", 120)] },
      { day: "Fri", name: "Seated Cable Row", sets: [S("3x8-12", 90)] },
      { day: "Fri", name: "Pull-Up", sets: [S("3xAMRAP", 120)] },
      { day: "Fri", name: "Hammer Curl", sets: [S("3x10-12", 60)] },

      // Legs/Glutes focus
      { day: "Sat", name: "Front Squat", sets: [S("4x4-6", 180)] },
      { day: "Sat", name: "Barbell Hip Thrust", sets: [S("4x8-10", 120)] },
      { day: "Sat", name: "Bulgarian Split Squat", sets: [S("3x8-10", 90)] },
      { day: "Sat", name: "Hanging Leg Raise", sets: [S("3x10-12", 60)] },
    ],
  },
];

export type RoutineDraft = { name: string; items: any[] };

export function buildDraftFromTemplate(t: WorkoutTemplate): RoutineDraft {
  const items = t.items.map((it) => ({
    name: it.name,
    day: it.day,
    sets: it.sets.map((s) => ({
      reps: s.reps,
      restSec: s.restSec,
      type: s.type || "normal",
    })),
  }));
  return { name: t.name, items };
}

export async function storeDraft(uid: string | null, draft: RoutineDraft) {
  const key = uid ? `routine:draft:${uid}` : "routine:draft:anon";
  await AsyncStorage.setItem(key, JSON.stringify(draft));
}