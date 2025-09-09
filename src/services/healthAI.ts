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
  fitnessGoal?: string;
  country?: string; // included to bias AI suggestions towards local foods
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

// Image analysis types
export type PortionItem = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros?: Record<string, number>;
  notes?: string;
};
export interface MealImageAnalysis {
  name: string;
  serving: string;
  portionGrams?: number;
  items?: PortionItem[];
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
  confidence: number;
}

function toNum(v: any, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function parseGramsFromText(s?: string | null): number | null {
  if (!s) return null;
  const m = String(s).match(/(\d+(\.\d+)?)\s*g/i);
  return m ? Math.round(parseFloat(m[1])) : null;
}
function round(n: number, step = 1) {
  return Math.round(n / step) * step;
}

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

function normalizeImageAnalysis(respData: any): MealImageAnalysis {
  const v2 = (respData as RawV2)?.item;
  if (v2 && (typeof v2.portionGrams === "number" || Array.isArray(v2.items))) {
    const totals = v2.totals || {};
    const portionGrams =
      typeof v2.portionGrams === "number" ? v2.portionGrams : undefined;
    const serving =
      v2.servingText || (portionGrams ? `${round(portionGrams)} g` : "1 serving");
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

// Hugging Face labeler
export async function labelFoodImageBase64(
  imageBase64: string,
  mimeType: string
): Promise<{ label: string; score: number }> {
  try {
    const call = httpsCallable(functions, "imageLabeler");
    const resp: any = await call({ imageBase64, mimeType });
    return {
      label: resp?.data?.label || "",
      score: Number(resp?.data?.score || 0),
    };
  } catch (e: any) {
    console.error("imageLabeler error:", e?.message || e);
    return { label: "", score: 0 };
  }
}

export async function analyzeMealImageBase64(
  imageBase64: string,
  mimeType: string,
  context: HealthContext,
  opts?: { labelHint?: string }
): Promise<MealImageAnalysis> {
  try {
    const call = httpsCallable(functions, "analyzeMealImage");
    const resp: any = await call({
      imageBase64,
      mimeType,
      profile: context,
      labelHint: opts?.labelHint || "",
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

// JSON parsing helper
function tryParseJSON<T = any>(s: string): T | null {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
    return null;
  }
}

// Pantry → meals
export type PantryLite = { name: string; grams?: number; count?: number };
export type PantryIdea = {
  title: string;
  ingredients: string[];
  description: string[];
  nutrition?: { calories: number; protein: number; carbs: number; fat: number };
};

export async function getPantryMealIdeasAI(
  pantry: PantryLite[],
  targets: {
    caloriesRemaining: number;
    macrosRemaining: { protein: number; carbs: number; fat: number };
    preferences?: string[];
  },
  profile?: HealthContext
): Promise<PantryIdea[]> {
  const countryLine = `User country: ${profile?.country || "Unknown"}. ${
    (profile?.country || "").toLowerCase().includes("ghana")
      ? "If appropriate, prefer Ghanaian/local dishes (e.g., jollof rice, waakye, banku, kenkey) using pantry items."
      : "Prefer locally common, budget-friendly dishes."
  }`;

  const msg = `
You are a dietician. Suggest 3 meal ideas using the pantry items FIRST.
Respect dietary preferences: ${targets.preferences?.join(", ") || "none"}.
${countryLine}
Today remaining: ${targets.caloriesRemaining} kcal, P${targets.macrosRemaining.protein} C${targets.macrosRemaining.carbs} F${targets.macrosRemaining.fat}.

Pantry:
${pantry
  .map(
    (p) =>
      `- ${p.name}${
        p.grams ? ` (${p.grams} g)` : p.count ? ` (${p.count} pcs)` : ""
      }`
  )
  .join("\n")}

Return JSON array with:
[{ "title": "", "ingredients": ["name ..."], "description": ["step..."], "nutrition": {"calories": 0, "protein":0,"carbs":0,"fat":0}}]
Only return JSON.
  `.trim();

  const text = await getHealthAssistantResponse(msg, profile || {});
  const json = tryParseJSON<PantryIdea[]>(text);
  if (json && Array.isArray(json)) return json.slice(0, 5);
  return [
    {
      title: "Meal ideas",
      ingredients: [],
      description: text.split("\n").filter(Boolean).slice(0, 8),
    },
  ];
}

// Daily meal suggestions (by remaining macros)
export async function getDailyMealIdeasAI(
  targets: {
    caloriesRemaining: number;
    macrosRemaining: { protein: number; carbs: number; fat: number };
    usePantry?: boolean;
  },
  profile?: HealthContext
): Promise<PantryIdea[]> {
  const countryLine = `User country: ${profile?.country || "Unknown"}. ${
    (profile?.country || "").toLowerCase().includes("ghana")
      ? "When suitable, prefer concise Ghanaian/local options with grams."
      : "Prefer locally common, budget-friendly options with grams."
  }`;

  const msg = `
You are a dietician. Suggest 3 meal ideas the user can eat today.
${countryLine}
Respect dietary preferences and allergies from context. Use concise servings with grams.
Target remaining today: ${targets.caloriesRemaining} kcal, P${targets.macrosRemaining.protein} C${targets.macrosRemaining.carbs} F${targets.macrosRemaining.fat}.
${targets.usePantry ? "Prefer items likely to be in a typical pantry." : ""}
Return ONLY JSON:
[{"title":"","ingredients":[""],"description":[""],"nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0}}]
`.trim();

  const txt = await getHealthAssistantResponse(msg, profile || {});
  const json = tryParseJSON<PantryIdea[]>(txt);
  if (json && Array.isArray(json)) return json.slice(0, 5);
  return [
    {
      title: "Meal suggestions",
      ingredients: [],
      description: txt.split("\n").filter(Boolean).slice(0, 6),
    },
  ];
}