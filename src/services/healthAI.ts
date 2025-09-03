// src/services/healthAI.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

export interface HealthContext {
  name?: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  goal?: string;
  dailyCalories?: number;
  macros?: { protein: number; carbs: number; fat: number };
  todayStats?: {
    caloriesConsumed: number;
    caloriesRemaining: number;
    steps: number;
    waterIntake: number;
    mealsCount: number;
    workoutsCount: number;
    macros: { protein: number; carbs: number; fat: number };
  };
  healthConditions?: string[];
}

export async function getHealthAssistantResponse(
  userMessage: string,
  context: HealthContext,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> =
    []
): Promise<string> {
  try {
    const call = httpsCallable(functions, "healthChat");
    const resp: any = await call({
      message: userMessage,
      profile: context,
      history: conversationHistory,
    });
    return (
      resp?.data?.reply ||
      "I'm here to help with nutrition and fitness. Ask me anything. 💡"
    );
  } catch (e: any) {
    console.error("healthChat error:", e?.message || e);
    return "AI is temporarily unavailable. Please try again later.";
  }
}

export type MealAnalyzeItem = {
  name: string;
  serving?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export async function analyzeMeal(
  items: MealAnalyzeItem[],
  context: HealthContext
): Promise<{ analysis: string }> {
  try {
    const call = httpsCallable(functions, "analyzeMeal");
    const resp: any = await call({ items, profile: context });
    return {
      analysis:
        resp?.data?.analysis ||
        "I couldn't analyze this meal. Please try again.",
    };
  } catch (e: any) {
    console.error("analyzeMeal error:", e?.message || e);
    return {
      analysis: "AI analysis is temporarily unavailable. Try again later.",
    };
  }
}

export type PortionItem = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros?: Record<string, number>;
};

export interface MealImageAnalysis {
  // Display name (e.g., "Banku with okro stew and fish")
  name: string;
  // Human-readable portion text for UI ("420 g", "1 bowl (350 g)", etc.)
  serving: string;
  // Optional numeric grams for the full portion (preferred)
  portionGrams?: number;
  // Optional per-item breakdown for mixed meals
  items?: PortionItem[];
  // Totals for the entire portion (not per 100 g)
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  micros: {
    fiber?: number;
    sodium?: number;
    potassium?: number;
    vitaminC?: number;
    calcium?: number;
    iron?: number;
    [k: string]: number | undefined;
  };
  confidence: number; // 0–1
}

function toNum(v: any, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function parseGramsFromText(s?: string | null): number | null {
  if (!s) return null;
  // Examples: "420 g", "1 bowl (350 g)", "195 g", "1 cup cooked (195 g)"
  const match = String(s).match(/(\d+(\.\d+)?)\s*g/i);
  if (!match) return null;
  return Math.round(parseFloat(match[1]));
}

function round(n: number, step = 1) {
  return Math.round(n / step) * step;
}

type RawV1 = {
  item?: {
    name?: string;
    serving?: string;
    calories?: number;
    macros?: { protein?: number; carbs?: number; fat?: number };
    micros?: Record<string, number>;
    confidence?: number;
  };
};

type RawV2 = {
  item?: {
    name?: string;
    portionGrams?: number;
    servingText?: string;
    items?: PortionItem[];
    totals?: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      micros?: Record<string, number>;
    };
    confidence?: number;
  };
};

function normalizeImageAnalysis(respData: any): MealImageAnalysis {
  const v2 = (respData as RawV2)?.item;
  if (v2 && (typeof v2.portionGrams === "number" || Array.isArray(v2.items))) {
    const totals = v2.totals || {};
    const portionGrams =
      typeof v2.portionGrams === "number" ? v2.portionGrams : undefined;
    const serving =
      v2.servingText ||
      (portionGrams ? `${round(portionGrams)} g` : "1 serving");
    return {
      name: String(v2.name || "Meal"),
      serving,
      portionGrams,
      items: Array.isArray(v2.items) ? v2.items : undefined,
      calories: round(toNum(totals.calories)),
      macros: {
        protein: round(toNum(totals.protein)),
        carbs: round(toNum(totals.carbs)),
        fat: round(toNum(totals.fat)),
      },
      micros: totals.micros || {},
      confidence: Math.max(0, Math.min(1, toNum(v2.confidence, 0.7))),
    };
  }

  // Fallback to v1
  const v1 = (respData as RawV1)?.item || {};
  const portionGrams = parseGramsFromText(v1.serving);
  return {
    name: String(v1.name || "Meal"),
    serving: v1.serving || (portionGrams ? `${portionGrams} g` : "1 serving"),
    portionGrams: portionGrams || undefined,
    calories: round(toNum(v1.calories)),
    macros: {
      protein: round(toNum(v1?.macros?.protein)),
      carbs: round(toNum(v1?.macros?.carbs)),
      fat: round(toNum(v1?.macros?.fat)),
    },
    micros: v1?.micros || {},
    confidence: Math.max(0, Math.min(1, toNum(v1?.confidence, 0.7))),
  };
}

export async function analyzeMealImageBase64(
  imageBase64: string,
  mimeType: string,
  context: HealthContext
): Promise<MealImageAnalysis> {
  try {
    const call = httpsCallable(functions, "analyzeMealImage");
    const resp: any = await call({
      imageBase64,
      mimeType,
      profile: context,
    });
    if (!resp?.data?.item) throw new Error("No analysis result");
    return normalizeImageAnalysis(resp.data);
  } catch (e: any) {
    console.error("analyzeMealImage error:", e?.message || e);
    throw new Error(
      "AI image analysis failed. Please try again with a clearer photo."
    );
  }
}