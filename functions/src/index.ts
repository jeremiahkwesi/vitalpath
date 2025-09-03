// functions/src/index.ts
import * as functions from "firebase-functions";

// Type-only import to avoid ESM issues with CJS build.
import type { GenerativeModel } from "@google/generative-ai";

async function ensureFetch() {
  if (typeof (globalThis as any).fetch !== "function") {
    const { default: fetch } = await import("node-fetch");
    (globalThis as any).fetch = fetch as any;
  }
}

// ---------- Helpers ----------
function kcalFromEnergy(value: number, unit?: string) {
  if (!Number.isFinite(value)) return 0;
  return unit && unit.toUpperCase() === "KJ"
    ? Math.round(value / 4.184)
    : Math.round(value);
}

type HistoryMsg = { role: "user" | "assistant"; content: string };
type Profile = {
  name?: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  goal?: string;
  activityLevel?: string;
  bodyType?: string;
  targetTimelineWeeks?: number;
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
  country?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
};

async function getGeminiModel(
  modelName = "gemini-1.5-flash"
): Promise<GenerativeModel> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "GEMINI_API_KEY not configured"
    );
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const sys =
    "You are VitalPath AI, a concise, supportive health assistant.\n" +
    "- Reference the user's profile and today's stats.\n" +
    "- Keep replies to 2–5 sentences, actionable, with 1 relevant emoji.\n" +
    "- Not medical advice; suggest professionals for medical issues.\n" +
    "- When asked about workouts, first check if you know: location (gym/home) " +
    "and days per week. If missing, ask a single, clear question to get it. " +
    "Also consider experience level, available equipment, time per session, and " +
    "injuries/limitations. Once you have enough, propose a 1-week plan with " +
    "named exercises (sets × reps, rest seconds) per day. Keep it concise.";
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: sys,
  });
}

// ---------- AI assistant chat ----------
export const healthChat = functions
  .region("us-central1")
  .https.onCall(async (data: any, context) => {
    const message: string = String(data?.message || "").trim();
    const profile: Profile = data?.profile || {};
    const history: HistoryMsg[] = Array.isArray(data?.history)
      ? data.history
      : [];

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }
    if (!message) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "message is required"
      );
    }

    const model = await getGeminiModel("gemini-1.5-flash");

    const preface =
      `USER PROFILE\n` +
      `• Name: ${profile.name || "User"}\n` +
      `• Age: ${profile.age ?? "N/A"} • Gender: ${profile.gender || "N/A"}\n` +
      `• Weight: ${profile.weight ?? "N/A"}kg • Height: ${
        profile.height ?? "N/A"
      }m\n` +
      `• Goal: ${profile.goal || "N/A"}\n` +
      `• Daily Calories: ${profile.dailyCalories ?? "N/A"} kcal\n\n` +
      `TODAY\n` +
      `• Calories: ${profile.todayStats?.caloriesConsumed ?? 0} eaten, ${
        profile.todayStats?.caloriesRemaining ?? 0
      } remaining\n` +
      `• Steps: ${profile.todayStats?.steps ?? 0} • Water: ${
        profile.todayStats?.waterIntake ?? 0
      } ml\n` +
      `• Meals: ${profile.todayStats?.mealsCount ?? 0} • Workouts: ${
        profile.todayStats?.workoutsCount ?? 0
      }\n` +
      `• Macros today: P${
        profile.todayStats?.macros?.protein ?? 0
      }g C${profile.todayStats?.macros?.carbs ?? 0}g F${
        profile.todayStats?.macros?.fat ?? 0
      }g\n` +
      `• Conditions: ${
        (profile.healthConditions || []).join(", ") || "None"
      }\n` +
      `GUIDELINES\n` +
      `• If the user requests a workout plan and details are missing, ask: "Gym or home?" and "How many days per week?" (one short question at a time).\n` +
      `• When sufficient info is available, propose a concise 1-week schedule with named exercises per day (sets × reps, rest seconds). Include substitutions if equipment is unknown.\n`;

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    if (history.length) {
      for (const h of history.slice(-8)) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: preface + "\nQUESTION:\n" + message }],
    });

    try {
      const result = await model.generateContent({ contents });
      const reply =
        ((result as any).response?.text?.() as string | undefined)?.trim?.();
      return {
        reply:
          reply ||
          "I'm here to help with nutrition and fitness. Ask me anything. 💡",
      };
    } catch (e: any) {
      functions.logger.error("healthChat error", e);
      throw new functions.https.HttpsError(
        "internal",
        `Gemini chat failed: ${e?.message || e}`
      );
    }
  });

// ---------- Meal analyzer (text list) ----------
export const analyzeMeal = functions
  .region("us-central1")
  .https.onCall(async (data: any, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }

    const profile: Profile = data?.profile || {};
    const items: Array<{
      name: string;
      serving?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }> = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "items array is required"
      );
    }

    const model = await getGeminiModel("gemini-1.5-flash");

    const prompt =
      `Analyze the following meal for ${profile.name || "the user"}.\n` +
      `Return a concise analysis (3–6 sentences): summarize calories/macros, ` +
      `compare to the user's daily target if available, and give 2–3 specific ` +
      `improvements. Be practical and encouraging. 1 emoji.\n\n` +
      `USER GOAL: ${profile.goal || "N/A"}; Daily Calories: ${
        profile.dailyCalories ?? "N/A"
      }\n` +
      `TARGET MACROS (if available): P${profile.macros?.protein ?? "?"}g ` +
      `C${profile.macros?.carbs ?? "?"}g F${profile.macros?.fat ?? "?"}g\n\n` +
      `MEAL ITEMS:\n` +
      items
        .map((i, idx) => {
          const meta = [
            i.serving ? `serving=${i.serving}` : "",
            Number.isFinite(i.calories) ? `kcal=${i.calories}` : "",
            Number.isFinite(i.protein) ? `P=${i.protein}g` : "",
            Number.isFinite(i.carbs) ? `C=${i.carbs}g` : "",
            Number.isFinite(i.fat) ? `F=${i.fat}g` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `• ${idx + 1}. ${i.name}${meta ? ` (${meta})` : ""}`;
        })
        .join("\n");

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const text =
        ((result as any).response?.text?.() as string | undefined)?.trim?.();
      return {
        analysis:
          text ||
          "I couldn't analyze this meal. Try adding calories/macros for each item.",
      };
    } catch (e: any) {
      functions.logger.error("analyzeMeal error", e);
      throw new functions.https.HttpsError(
        "internal",
        `Gemini analyzeMeal failed: ${e?.message || e}`
      );
    }
  });

// ---------- Utilities for robust JSON extraction ----------
function tryParseJSON(anyText: string): any | null {
  try {
    return JSON.parse(anyText);
  } catch {
    const cleaned = anyText.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const slice = cleaned.slice(start, end + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function parseGramsFromText(s?: string) {
  if (!s) return 0;
  const m = String(s).match(/(\d+(\.\d+)?)\s*g/i);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

// ---------- Meal analyzer (image → nutrition JSON) ----------
export const analyzeMealImage = functions
  .region("us-central1")
  .https.onCall(async (data: any, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }

    const imageBase64: string = String(data?.imageBase64 || "");
    const mimeType: string = String(data?.mimeType || "image/jpeg");
    const profile: Profile = data?.profile || {};

    if (!imageBase64) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "imageBase64 is required"
      );
    }
    if (imageBase64.length > 8_000_000) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "image too large; please try a smaller image"
      );
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "You are VitalPath AI. Analyze food images and estimate nutrition " +
        "for the actual portion shown (do NOT report per 100 g). " +
        "Estimate total portion weight in grams. If the meal has multiple " +
        "components (e.g., banku, stew, fish), estimate grams and macros for " +
        "each component. Respond ONLY with valid JSON that matches the schema.",
    });

    const schemaV2 =
      `Respond ONLY with JSON matching this schema:\n` +
      `{\n` +
      `  "item": {\n` +
      `    "name": "string",\n` +
      `    "portionGrams": number, // estimated total grams for the portion\n` +
      `    "servingText": "string", // e.g., "1 bowl (420 g)"\n` +
      `    "items": [ // optional per-component breakdown\n` +
      `      {\n` +
      `        "name": "string", "grams": number,\n` +
      `        "calories": number, "protein": number, "carbs": number, "fat": number,\n` +
      `        "micros": { [k: string]: number }\n` +
      `      }\n` +
      `    ],\n` +
      `    "totals": {\n` +
      `      "calories": number, "protein": number, "carbs": number, "fat": number,\n` +
      `      "micros": {\n` +
      `        "fiber": number, "sodium": number, "potassium": number,\n` +
      `        "vitaminC": number, "calcium": number, "iron": number\n` +
      `      }\n` +
      `    },\n` +
      `    "confidence": number // 0..1\n` +
      `  }\n` +
      `}`;

    const userContext =
      `User goal: ${profile.goal || "N/A"}; Daily kcal target: ` +
      `${profile.dailyCalories ?? "N/A"}.\n` +
      `Report totals for the served portion only (not per 100 g). If unsure, ` +
      `make a reasonable estimate.`;

    const imagePart = { inlineData: { data: imageBase64, mimeType } };

    function sumItems(items: any[]) {
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 } as any;
      const micros: Record<string, number> = {};
      for (const it of items) {
        totals.calories += num(it?.calories);
        totals.protein += num(it?.protein);
        totals.carbs += num(it?.carbs);
        totals.fat += num(it?.fat);
        const im = it?.micros || {};
        for (const k of Object.keys(im)) {
          const v = num(im[k]);
          micros[k] = (micros[k] || 0) + v;
        }
      }
      return { totals, micros };
    }

    try {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Analyze this meal image and estimate nutrition.\n" +
                  "Return ONLY the JSON object, no extra text.\n" +
                  schemaV2 +
                  "\n\n" +
                  userContext,
              },
              imagePart as any,
            ],
          },
        ],
      });

      const raw =
        ((result as any).response?.text?.() as string | undefined) || "";
      const parsed = tryParseJSON(raw);
      if (!parsed) {
        functions.logger.error("analyzeMealImage JSON parse failed", { raw });
        throw new Error("Model returned non-JSON");
      }

      // Normalize to v2 contract
      const pItem = parsed?.item || {};
      const name = String(pItem?.name || "Meal");
      const portionGrams = num(pItem?.portionGrams);
      const servingText =
        String(pItem?.servingText || "").trim() ||
        (portionGrams ? `${portionGrams} g` : "1 serving");
      const items = Array.isArray(pItem?.items)
        ? pItem.items.map((it: any) => ({
            name: String(it?.name || "Item"),
            grams: num(it?.grams),
            calories: num(it?.calories),
            protein: num(it?.protein),
            carbs: num(it?.carbs),
            fat: num(it?.fat),
            micros: it?.micros || {},
          }))
        : [];

      let totals = {
        calories: num(pItem?.totals?.calories),
        protein: num(pItem?.totals?.protein),
        carbs: num(pItem?.totals?.carbs),
        fat: num(pItem?.totals?.fat),
      };
      let micros = {
        fiber: num(pItem?.totals?.micros?.fiber),
        sodium: num(pItem?.totals?.micros?.sodium),
        potassium: num(pItem?.totals?.micros?.potassium),
        vitaminC: num(pItem?.totals?.micros?.vitaminC),
        calcium: num(pItem?.totals?.micros?.calcium),
        iron: num(pItem?.totals?.micros?.iron),
      };

      // If totals missing, derive from items.
      if (
        !totals.calories &&
        !totals.protein &&
        !totals.carbs &&
        !totals.fat &&
        items.length
      ) {
        const s = sumItems(items);
        totals = s.totals;
        // Only fill known micros
        micros = {
          fiber: num(s.micros.fiber),
          sodium: num(s.micros.sodium),
          potassium: num(s.micros.potassium),
          vitaminC: num(s.micros.vitaminC),
          calcium: num(s.micros.calcium),
          iron: num(s.micros.iron),
        };
      }

      const pg =
        portionGrams ||
        items.reduce((a: number, b: any) => a + num(b.grams), 0) ||
        parseGramsFromText(servingText) ||
        0;

      const confidence = clamp01(num(pItem?.confidence) || 0.7);

      return {
        item: {
          name,
          portionGrams: pg,
          servingText,
          items,
          totals: { ...totals, micros },
          confidence,
        },
      };
    } catch (e: any) {
      functions.logger.error("analyzeMealImage error", e);
      throw new functions.https.HttpsError(
        "internal",
        `Gemini image analysis failed: ${e?.message || e}`
      );
    }
  });

// ---------- USDA search (big DB) ----------
export const usdaSearch = functions
  .region("us-central1")
  .https.onCall(async (data: any) => {
    await ensureFetch();

    const query: string = String(data?.query || "").trim();
    const page: number = Number(data?.page || 1);
    const pageSize: number = Math.min(Number(data?.pageSize || 50), 200);

    if (!query) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "query is required"
      );
    }

    const apiKey = process.env.USDA_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "USDA_API_KEY not configured"
      );
    }

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      apiKey
    )}`;

    const body = {
      query,
      pageNumber: page,
      pageSize,
      dataType: ["Branded", "SR Legacy", "Survey (FNDDS)"],
      requireAllWords: false,
      sortBy: "publishedDate",
      sortOrder: "desc",
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`USDA ${res.status}: ${text}`);
      }
      const json: any = await res.json();
      const foods: any[] = Array.isArray(json.foods) ? json.foods : [];
      const totalHits = Number(json.totalHits || 0);

      const items = foods.map((f: any) => {
        const nutrients: any[] = f.foodNutrients || [];
        const findN = (name: string) =>
          nutrients.find((n) => (n.nutrientName || "").includes(name));
        const nEnergy = findN("Energy");
        const nProtein = findN("Protein");
        const nCarb = findN("Carbohydrate");
        const nFat = findN("Total lipid");

        const calories = kcalFromEnergy(
          Number(nEnergy?.value || 0),
          nEnergy?.unitName
        );
        const protein = Number(nProtein?.value || 0);
        const carbs = Number(nCarb?.value || 0);
        const fat = Number(nFat?.value || 0);

        const serving =
          f.servingSize && f.servingSizeUnit
            ? `${f.servingSize} ${String(f.servingSizeUnit).toLowerCase()}`
            : "100 g";

        return {
          id: `fdc-${f.fdcId}`,
          name: f.description || "Food item",
          brand: f.brandOwner || undefined,
          serving,
          calories,
          protein,
          carbs,
          fat,
          barcode: f.gtinUpc || undefined,
          source: "usda",
        };
      });

      const hasMore = page * pageSize < totalHits;
      return { items, hasMore };
    } catch (e: any) {
      throw new functions.https.HttpsError(
        "internal",
        `USDA search failed: ${e?.message || e}`
      );
    }
  });

// ---------- Curate initial AI plan ----------
export const curateInitialPlan = functions
  .region("us-central1")
  .https.onCall(async (data: any, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }
    const profile = data?.profile || {};
    const required = ["age", "weight", "height", "gender", "goal"];
    for (const r of required) {
      if (profile[r] == null || profile[r] === "") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Missing required field: ${r}`
        );
      }
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "You are VitalPath AI. Create a realistic, safe weekly example " +
        "plan for workouts + nutrition. Include meals with grams and " +
        "per-meal component breakdowns when relevant. Include workouts " +
        "with specific exercises (sets × reps, rest seconds). Respond ONLY " +
        "with valid JSON that matches the schema.",
    });

    const schema =
      `Schema:\n` +
      `{\n` +
      `  "targetCalories": number,\n` +
      `  "macros": {"protein": number, "carbs": number, "fat": number},\n` +
      `  "micros": {\n` +
      `    "fiber": number, "sodium": number, "potassium": number,\n` +
      `    "vitaminC": number, "calcium": number, "iron": number\n` +
      `  },\n` +
      `  "adjustedTimelineWeeks": number,\n` +
      `  "weeklyPlan": {\n` +
      `    "workouts": [\n` +
      `      {\n` +
      `        "day": "Sun|Mon|Tue|Wed|Thu|Fri|Sat",\n` +
      `        "location": "home|gym",\n` +
      `        "focus": "Full Body|Upper|Lower|Push|Pull|Mobility|Cardio",\n` +
      `        "duration": number,\n` +
      `        "exercises": [\n` +
      `          {\n` +
      `            "name": "string", "sets": number, "reps": "string",\n` +
      `            "restSec": number, "equipment": [ "string" ],\n` +
      `            "alt": "string"\n` +
      `          }\n` +
      `        ],\n` +
      `        "blocks": [\n` +
      `          { "name": "string", "type": "cardio|strength|mobility", "duration": number }\n` +
      `        ]\n` +
      `      }\n` +
      `    ],\n` +
      `    "meals": [\n` +
      `      {\n` +
      `        "day": "Sun|Mon|Tue|Wed|Thu|Fri|Sat",\n` +
      `        "items": [\n` +
      `          {\n` +
      `            "name": "string", "serving": "string", "grams": number,\n` +
      `            "calories": number, "protein": number, "carbs": number, "fat": number,\n` +
      `            "components": [ { "name": "string", "grams": number } ]\n` +
      `          }\n` +
      `        ]\n` +
      `      }\n` +
      `    ]\n` +
      `  },\n` +
      `  "countryFoods": [string],\n` +
      `  "notes": string\n` +
      `}`;

    const prefs = (profile.dietaryPreferences || []).join(", ") || "none";
    const allergies = (profile.allergies || []).join(", ") || "none";

    const prompt =
      `Create a personalized, safe plan for the next ` +
      `${profile.targetTimelineWeeks || 12} weeks.\n` +
      `User:\n` +
      `- Age: ${profile.age}\n` +
      `- Gender: ${profile.gender}\n` +
      `- Height: ${profile.height} m\n` +
      `- Weight: ${profile.weight} kg\n` +
      `- Body Type: ${profile.bodyType || "other"}\n` +
      `- Activity: ${profile.activityLevel || "moderate"}\n` +
      `- Goal: ${profile.goal}\n` +
      `- Country: ${profile.country || "Unknown"}\n` +
      `- Dietary Prefs: ${prefs}\n` +
      `- Allergies: ${allergies}\n\n` +
      `Constraints:\n` +
      `- Keep calorie targets realistic; safe weekly change. Adjust timeline if goal is too aggressive.\n` +
      `- Provide a 7-day example plan for workouts and meals (typical week).\n` +
      `- Meals should include grams; mixed meals include per-component grams.\n` +
      `- Workouts should list specific exercises with sets × reps and rest seconds.\n` +
      `- Return ONLY JSON that matches the schema below.\n\n` +
      schema;

    function tryParseJSONLocal(s: string) {
      try {
        return JSON.parse(s);
      } catch {
        const cleaned = s.replace(/```json|```/g, "").trim();
        try {
          return JSON.parse(cleaned);
        } catch {
          const start = cleaned.indexOf("{");
          const end = cleaned.lastIndexOf("}");
          if (start >= 0 && end > start) {
            const slice = cleaned.slice(start, end + 1);
            try {
              return JSON.parse(slice);
            } catch {
              return null;
            }
          }
          return null;
        }
      }
    }

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const raw =
        ((result as any).response?.text?.() as string | undefined) || "";
      const plan = tryParseJSONLocal(raw);
      if (!plan) {
        functions.logger.error("curateInitialPlan parse fail", { raw });
        throw new Error("Model returned non-JSON");
      }
      return { plan };
    } catch (e: any) {
      functions.logger.error("curateInitialPlan error", e);
      throw new functions.https.HttpsError(
        "internal",
        `Plan generation failed: ${e?.message || e}`
      );
    }
  });