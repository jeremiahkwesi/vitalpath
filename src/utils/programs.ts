// src/utils/programs.ts
export type WorkoutBlock = {
  name: string;
  duration: number; // minutes
  caloriesBurned: number;
  type: "cardio" | "strength" | "flexibility" | "sports" | "other";
};

export type DayPlan = {
  day: string; // Mon, Tue, ...
  workouts: WorkoutBlock[];
};

export type Program = {
  id: string;
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  goal: "Lose Fat" | "Gain Muscle" | "General Fitness";
  durationWeeks: number;
  schedule: DayPlan[]; // 7 days
  description: string;
};

export const PROGRAMS: Program[] = [
  {
    id: "p1",
    title: "Beginner Fat‑Loss",
    level: "Beginner",
    goal: "Lose Fat",
    durationWeeks: 4,
    description:
      "Low‑impact cardio + light strength to burn fat safely and build habits.",
    schedule: [
      {
        day: "Mon",
        workouts: [
          { name: "Brisk Walk", duration: 30, caloriesBurned: 180, type: "cardio" },
          { name: "Bodyweight Circuit", duration: 15, caloriesBurned: 100, type: "strength" },
        ],
      },
      { day: "Tue", workouts: [{ name: "Cycling (easy)", duration: 30, caloriesBurned: 190, type: "cardio" }] },
      {
        day: "Wed",
        workouts: [
          { name: "Brisk Walk", duration: 30, caloriesBurned: 180, type: "cardio" },
          { name: "Core + Mobility", duration: 15, caloriesBurned: 60, type: "flexibility" },
        ],
      },
      { day: "Thu", workouts: [{ name: "Rest / Light Stretch", duration: 20, caloriesBurned: 40, type: "flexibility" }] },
      {
        day: "Fri",
        workouts: [
          { name: "Elliptical (easy)", duration: 25, caloriesBurned: 170, type: "cardio" },
          { name: "Bodyweight Circuit", duration: 15, caloriesBurned: 100, type: "strength" },
        ],
      },
      { day: "Sat", workouts: [{ name: "Hike / Outdoor Walk", duration: 40, caloriesBurned: 240, type: "cardio" }] },
      { day: "Sun", workouts: [{ name: "Rest / Mobility", duration: 20, caloriesBurned: 40, type: "flexibility" }] },
    ],
  },
  {
    id: "p2",
    title: "Muscle Builder 3‑Day",
    level: "Intermediate",
    goal: "Gain Muscle",
    durationWeeks: 6,
    description:
      "Push/Pull/Legs split with progressive overload. Add cardio as desired.",
    schedule: [
      {
        day: "Mon",
        workouts: [
          { name: "Push (Chest/Shoulders/Triceps)", duration: 45, caloriesBurned: 280, type: "strength" },
        ],
      },
      {
        day: "Tue",
        workouts: [{ name: "Walk / Light Cardio", duration: 20, caloriesBurned: 120, type: "cardio" }],
      },
      {
        day: "Wed",
        workouts: [{ name: "Pull (Back/Biceps)", duration: 45, caloriesBurned: 280, type: "strength" }],
      },
      {
        day: "Thu",
        workouts: [{ name: "Mobility / Core", duration: 20, caloriesBurned: 70, type: "flexibility" }],
      },
      {
        day: "Fri",
        workouts: [{ name: "Legs (Quads/Hamstrings/Glutes)", duration: 45, caloriesBurned: 300, type: "strength" }],
      },
      { day: "Sat", workouts: [{ name: "Optional Cardio", duration: 25, caloriesBurned: 160, type: "cardio" }] },
      { day: "Sun", workouts: [{ name: "Rest", duration: 0, caloriesBurned: 0, type: "other" }] },
    ],
  },
];