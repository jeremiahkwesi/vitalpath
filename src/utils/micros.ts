// src/utils/micros.ts
export type RDIMicros = {
  calories?: number;
  protein?: number;
  fiber?: number;
  sodium?: number;
  addedSugar?: number;
  [k: string]: number | undefined;
};

// Simplified RDI baseline (per day) — extend as needed
// Values: calories vary per user; here we keep macros/micros of interest
export function rdiBaseline(age: number, gender: "male" | "female"): RDIMicros {
  // grams / mg per day
  const fiber = gender === "male" ? 30 : 25;
  const sodium = 2300; // mg upper
  const addedSugar = 50; // g (~10% of 2000 kcal)
  return { fiber, sodium, addedSugar };
}