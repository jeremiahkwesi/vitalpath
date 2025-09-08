// functions/src/index.ts
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import logger from "firebase-functions/logger";
import { initializeApp as adminInit } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// Ensure fetch exists (Node 20 usually has it)
async function ensureFetch() {
  if (typeof (globalThis as any).fetch !== "function") {
    const { default: fetch } = await import("node-fetch");
    (globalThis as any).fetch = fetch as any;
  }
}

setGlobalOptions({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB",
});

adminInit();
const adminDb = getAdminFirestore();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const USDA_API_KEY = defineSecret("USDA_API_KEY");
const NUTRITIONIX_APP_ID = defineSecret("NUTRITIONIX_APP_ID");
const NUTRITIONIX_API_KEY = defineSecret("NUTRITIONIX_API_KEY");
const HUGGING_FACE_TOKEN = defineSecret("HUGGING_FACE_TOKEN");

// Types
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

// Helpers
function tryParseJSON(anyText: string) {
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
function kcalFromEnergy(value: number, unit?: string) {
  if (!Number.isFinite(value)) return 0;
  return unit && unit.toUpperCase() === "KJ"
    ? Math.round(value / 4.184)
    : Math.round(value);
}

async function getGeminiModel(modelName = "gemini-1.5-flash") {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const key = GEMINI_API_KEY.value();
  if (!key)
    throw new HttpsError(
      "failed-precondition",
      "GEMINI_API_KEY not configured"
    );
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction:
      "You are VitalPath AI, a concise, supportive health assistant.\n" +
      "- Reference the user's profile and today's stats.\n" +
      "- Keep replies to 2–5 sentences, actionable, with 1 emoji.\n" +
      "- Not medical advice.\n" +
      "- For workouts, if details are missing (gym/home, days/week), ask once then propose a concise 7‑day plan.",
  });
}

// Ghanaian dish lexicon (expand as needed)
const GHANA_FOOD_LEXICON: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "Jollof Rice", patterns: [/jollof/i, /west african jollof/i] },
  { canonical: "Waakye", patterns: [/waakye/i, /rice.*beans.*ghana/i] },
  {
    canonical: "Banku with Okro Stew",
    patterns: [/banku.*ok(ro|ra)/i, /okro.*banku/i],
  },
  { canonical: "Kenkey with Fish", patterns: [/kenkey/i] },
  { canonical: "Fufu with Light Soup", patterns: [/fufu/i, /foofoo/i] },
  { canonical: "Kelewele", patterns: [/kelewele/i, /spiced.*plantain/i] },
  { canonical: "Grilled Tilapia", patterns: [/tilapia/i] },
  { canonical: "Shito Sauce", patterns: [/shito/i] },
];

function canonicalizeGhanaDishName(
  name: string,
  labelHint?: string,
  country?: string
): string {
  const text = `${labelHint || ""} ${name}`.trim();
  const preferGhana = country && /ghana/i.test(country);
  for (const entry of GHANA_FOOD_LEXICON) {
    for (const p of entry.patterns) {
      if (p.test(text)) return entry.canonical;
    }
  }
  // If country Ghana and generic dish string contains "stew", "soup" etc., keep as-is.
  if (preferGhana) return name;
  return name;
}

// ---------- AI Chat ----------
export const healthChat = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (req) => {
    const message: string = String(req.data?.message || "").trim();
    const profile: Profile = req.data?.profile || {};
    const history: HistoryMsg[] = Array.isArray(req.data?.history)
      ? req.data.history
      : [];
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Must be signed in.");
    if (!message)
      throw new HttpsError("invalid-argument", "message is required");

    const model = await getGeminiModel("gemini-1.5-flash");

    const preface =
      `USER PROFILE\n` +
      `• Name: ${profile.name || "User"}\n` +
      `• Age: ${profile.age ?? "N/A"} • Gender: ${
        profile.gender || "N/A"
      }\n` +
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
      `• Macros today: P${profile.todayStats?.macros?.protein ?? 0}g C${
        profile.todayStats?.macros?.carbs ?? 0
      }g F${profile.todayStats?.macros?.fat ?? 0}g\n` +
      `• Conditions: ${(profile.healthConditions || []).join(", ") || "None"}\n`;

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];
    for (const h of (history || []).slice(-8)) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: preface + "\nQUESTION:\n" + message }],
    });

    try {
      const result = await (await model).generateContent({ contents });
      const reply = ((result as any).response?.text?.() as
        | string
        | undefined)?.trim?.();
      return {
        reply:
          reply ||
          "I'm here to help with nutrition and fitness. Ask me anything. 💡",
      };
    } catch (e: any) {
      logger.error("healthChat error", e);
      throw new HttpsError("internal", `Gemini chat failed: ${e?.message || e}`);
    }
  }
);

// ---------- Analyze Meal (text list) ----------
export const analyzeMeal = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (req) => {
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Must be signed in.");
    const profile: Profile = req.data?.profile || {};
    const items: Array<{
      name: string;
      serving?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    }> = Array.isArray(req.data?.items) ? req.data.items : [];
    if (!items.length)
      throw new HttpsError("invalid-argument", "items array is required");

    const model = await getGeminiModel("gemini-1.5-flash");
    const prompt =
      `Analyze the following meal for ${profile.name || "the user"}.\n` +
      `Return 3–6 concise sentences: calories/macros summary, compare to the user's target, and 2–3 specific improvements. 1 emoji.\n` +
      `STRICTLY: Respect dietary preferences (${(profile.dietaryPreferences ||
        []).join(", ") || "none"}) and exclude allergens (${(profile.allergies ||
        []).join(", ") || "none"}).\n\n` +
      `USER TARGETS: Calories=${profile.dailyCalories ?? "?"} kcal; Macros: P${
        profile.macros?.protein ?? "?"
      }g C${profile.macros?.carbs ?? "?"}g F${
        profile.macros?.fat ?? "?"
      }g\n\n` +
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
      const result = await (
        await model
      ).generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const text = ((result as any).response?.text?.() as
        | string
        | undefined)?.trim?.();
      return {
        analysis:
          text ||
          "I couldn't analyze this meal. Try adding calories/macros for each item.",
      };
    } catch (e: any) {
      logger.error("analyzeMeal error", e);
      throw new HttpsError(
        "internal",
        `Gemini analyzeMeal failed: ${e?.message || e}`
      );
    }
  }
);

// Normalize Hugging Face label shapes
function pickLabels(
  json: any
): Array<{ label?: string; score?: number }> {
  // Handles:
  // - [{ label, score }, ...]
  // - [{ labels: [...] }]
  // - { labels: [...] }
  // - { data: { labels: [...] } }
  if (!json) return [];
  if (Array.isArray(json)) {
    if (json.length && Array.isArray(json[0]?.labels)) {
      return json[0].labels as any[];
    }
    return json as any[];
  }
  if (Array.isArray((json as any).labels)) {
    return (json as any).labels as any[];
  }
  if (Array.isArray((json as any)?.data?.labels)) {
    return (json as any).data.labels as any[];
  }
  return [];
}

// ---------- Hugging Face Image Labeler ----------
export const imageLabeler = onCall(
  { secrets: [HUGGING_FACE_TOKEN] },
  async (req) => {
    await ensureFetch();
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Must be signed in.");
    const imageBase64: string = String(req.data?.imageBase64 || "");
    const mimeType: string = String(req.data?.mimeType || "image/jpeg");
    if (!imageBase64)
      throw new HttpsError("invalid-argument", "imageBase64 is required");

    const token = HUGGING_FACE_TOKEN.value();
    if (!token)
      throw new HttpsError(
        "failed-precondition",
        "HUGGING_FACE_TOKEN not configured"
      );

    const MODEL = "nateraw/food101"; // swap to a Ghana-focused model if available
    const url = `https://api-inference.huggingface.co/models/${MODEL}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [
            {
              name: "image",
              type: "image",
              data: imageBase64,
              mime_type: mimeType,
            },
          ],
          options: { wait_for_model: true },
        }),
      });
      const json: any = await res.json();
      const arr = pickLabels(json);
      const top =
        Array.isArray(arr) && arr.length
          ? arr.sort(
              (a: any, b: any) =>
                Number(b?.score || 0) - Number(a?.score || 0)
            )[0]
          : null;
      return { label: top?.label || "", score: Number(top?.score || 0) };
    } catch (e: any) {
      logger.error("imageLabeler error", e);
      throw new HttpsError(
        "internal",
        `HF labeler failed: ${e?.message || e}`
      );
    }
  }
);

// ---------- Analyze Meal Image (with Ghanaian lexicon) ----------
export const analyzeMealImage = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (req) => {
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Must be signed in.");

    const imageBase64: string = String(req.data?.imageBase64 || "");
    const mimeType: string = String(req.data?.mimeType || "image/jpeg");
    const profile: Profile = req.data?.profile || {};
    const labelHint: string = String(req.data?.labelHint || "");
    if (!imageBase64)
      throw new HttpsError("invalid-argument", "imageBase64 is required");
    if (imageBase64.length > 8_000_000)
      throw new HttpsError("invalid-argument", "image too large");

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value() || "");
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction:
        "You are VitalPath AI. Analyze food images and estimate nutrition for the served portion (not per 100 g). " +
        "Estimate portion grams and give totals. If labelHint is provided, use it as the likely dish name. " +
        "Return only valid JSON per the schema.",
    });

    const schemaV2 =
      `Respond ONLY with JSON:\n` +
      `{\n` +
      `  "item": {\n` +
      `    "name": "string",\n` +
      `    "portionGrams": number,\n` +
      `    "servingText": "string",\n` +
      `    "items": [ { "name": "string", "grams": number, "calories": number, "protein": number, "carbs": number, "fat": number, "micros": { [k: string]: number } } ],\n` +
      `    "totals": { "calories": number, "protein": number, "carbs": number, "fat": number, "micros": { "fiber": number, "sodium": number, "potassium": number, "vitaminC": number, "calcium": number, "iron": number } },\n` +
      `    "confidence": number\n` +
      `  }\n` +
      `}`;

    const userContext =
      `User goal: ${profile.goal || "N/A"}; Daily kcal target: ${
        profile.dailyCalories ?? "N/A"
      }.\n` +
      `Dietary preferences: ${(profile.dietaryPreferences || []).join(", ") ||
        "none"}; Allergies: ${(profile.allergies || []).join(", ") ||
        "none"}.\n` +
      (labelHint ? `Likely dish name: ${labelHint}.\n` : "") +
      `Report totals for the portion only. Make a reasonable estimate if unsure.`;

    const imagePart = {
      inlineData: { data: imageBase64, mimeType },
    } as any;

    function sumItems(items: any[]) {
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 } as any;
      const micros: Record<string, number> = {};
      for (const it of items) {
        totals.calories += num(it?.calories);
        totals.protein += num(it?.protein);
        totals.carbs += num(it?.carbs);
        totals.fat += num(it?.fat);
        for (const [k, v] of Object.entries(it?.micros || {})) {
          micros[k] = (micros[k] || 0) + num(v);
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
                  "Analyze this meal image and estimate nutrition. Return ONLY the JSON.\n" +
                  schemaV2 +
                  "\n\n" +
                  userContext,
              },
              imagePart,
            ],
          },
        ],
      });

      const raw =
        ((result as any).response?.text?.() as string | undefined) || "";
      const parsed = tryParseJSON(raw);
      if (!parsed) throw new Error("Model returned non-JSON");

      const pItem = parsed?.item || {};
      const name0 = String(pItem?.name || labelHint || "Meal");
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

      if (
        !totals.calories &&
        !totals.protein &&
        !totals.carbs &&
        !totals.fat &&
        items.length
      ) {
        const s = sumItems(items);
        totals = s.totals;
        micros = {
          fiber: num((s.micros as any).fiber),
          sodium: num((s.micros as any).sodium),
          potassium: num((s.micros as any).potassium),
          vitaminC: num((s.micros as any).vitaminC),
          calcium: num((s.micros as any).calcium),
          iron: num((s.micros as any).iron),
        };
      }

      const pg =
        portionGrams ||
        items.reduce((a: number, b: any) => a + num(b.grams), 0) ||
        parseGramsFromText(servingText) ||
        0;
      const confidence = clamp01(num(pItem?.confidence) || 0.7);

      // Ghanaian canonicalization
      const name = canonicalizeGhanaDishName(
        name0,
        labelHint,
        profile.country
      );

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
      logger.error("analyzeMealImage error", e);
      throw new HttpsError(
        "internal",
        `Gemini image analysis failed: ${e?.message || e}`
      );
    }
  }
);

// ---------- USDA Search ----------
export const usdaSearch = onCall(
  { secrets: [USDA_API_KEY] },
  async (req) => {
    await ensureFetch();
    const query: string = String(req.data?.query || "").trim();
    const page: number = Number(req.data?.page || 1);
    const pageSize: number = Math.min(Number(req.data?.pageSize || 50), 200);
    if (!query)
      throw new HttpsError("invalid-argument", "query is required");

    const key = USDA_API_KEY.value();
    if (!key)
      throw new HttpsError(
        "failed-precondition",
        "USDA_API_KEY not configured"
      );

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
      key
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
      if (!res.ok) throw new Error(`USDA ${res.status}: ${await res.text()}`);
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
      throw new HttpsError(
        "internal",
        `USDA search failed: ${e?.message || e}`
      );
    }
  }
);

// ---------- Nutritionix Search ----------
export const nutritionixSearch = onCall(
  { secrets: [NUTRITIONIX_APP_ID, NUTRITIONIX_API_KEY] },
  async (req) => {
    await ensureFetch();
    const query: string = String(req.data?.query || "").trim();
    const page: number = Number(req.data?.page || 1);
    const pageSize: number = Math.min(Number(req.data?.pageSize || 25), 50);
    if (!query)
      throw new HttpsError("invalid-argument", "query is required");

    const appId = NUTRITIONIX_APP_ID.value();
    const key = NUTRITIONIX_API_KEY.value();
    if (!appId || !key)
      throw new HttpsError(
        "failed-precondition",
        "Nutritionix secrets not configured"
      );

    const instantUrl = `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(
      query
    )}&detailed=true`;
    const headers = {
      "x-app-id": appId,
      "x-app-key": key,
      "Content-Type": "application/json",
    };

    try {
      const res = await fetch(instantUrl, { headers });
      if (!res.ok) throw new Error(`Instant ${res.status}: ${await res.text()}`);
      const j = (await res.json()) as any;
      const branded: any[] = Array.isArray(j.branded) ? j.branded : [];
      const slice = branded.slice((page - 1) * pageSize, page * pageSize);

      const detailItems: any[] = [];
      for (const b of slice) {
        const id = b.nix_item_id;
        if (!id) continue;
        const detailUrl = `https://trackapi.nutritionix.com/v2/search/item?nix_item_id=${encodeURIComponent(
          id
        )}`;
        try {
          const dres = await fetch(detailUrl, { headers });
          if (!dres.ok) continue;
          const dj = (await dres.json()) as any;
          const foods = Array.isArray(dj?.foods) ? dj.foods : [];
          for (const f of foods) {
            const serving =
              f.serving_qty && f.serving_unit
                ? `${f.serving_qty} ${f.serving_unit}`
                : "1 serving";
            detailItems.push({
              id: `nix-${id}`,
              name: f.food_name || b.food_name || "Food item",
              brand: f.brand_name || b.brand_name || undefined,
              serving,
              calories: Math.round(Number(f.nf_calories || 0)),
              protein: Math.round(Number(f.nf_protein || 0)),
              carbs: Math.round(Number(f.nf_total_carbohydrate || 0)),
              fat: Math.round(Number(f.nf_total_fat || 0)),
              barcode: b.upc || undefined,
              source: "nutritionix",
            });
          }
        } catch {}
      }

      const hasMore = page * pageSize < branded.length;
      return { items: detailItems, hasMore };
    } catch (e: any) {
      logger.error("nutritionixSearch error", e);
      throw new HttpsError(
        "internal",
        `Nutritionix search failed: ${e?.message || e}`
      );
    }
  }
);

// ---------- Curate Initial AI Plan (tight constraints) ----------
export const curateInitialPlan = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (req) => {
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Must be signed in.");
    const profile = req.data?.profile || {};
    const required = ["age", "weight", "height", "gender", "goal"];
    for (const r of required) {
      if (profile[r] == null || profile[r] === "") {
        throw new HttpsError(
          "invalid-argument",
          `Missing required field: ${r}`
        );
      }
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const model = new GoogleGenerativeAI(GEMINI_API_KEY.value() || "")
      .getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction:
          "You are VitalPath AI. Create a realistic, safe weekly example plan for workouts + nutrition. " +
          "Include meals with grams and (when relevant) per-item component grams. Include workouts with specific exercises (sets×reps, rest seconds). " +
          "Respond ONLY with valid JSON that matches the schema.",
      });

    const targets =
      `TARGETS:\n` +
      `- Daily Calories: ${
        profile.dailyCalories ?? "compute safely from profile"
      }\n` +
      `- Macros (if provided): P${profile.macros?.protein ?? "?"}g C${
        profile.macros?.carbs ?? "?"
      }g F${profile.macros?.fat ?? "?"}g\n`;

    const safety =
      `STRICT RULES:\n` +
      `- Each day's total calories must be within ±5% of the daily target.\n` +
      `- Respect dietary preferences: ${(profile.dietaryPreferences || []).join(
        ", "
      ) || "none"}.\n` +
      `- Exclude allergens completely: ${(profile.allergies || []).join(
        ", "
      ) || "none"}.\n` +
      `- Consider health conditions: ${(profile.healthConditions || []).join(
        ", "
      ) || "none"}.\n` +
      `- Prefer country foods if known (country=${profile.country || "Unknown"}; if Ghana, include typical Ghanaian options appropriately).\n` +
      `- Use realistic serving grams and per-meal totals.\n`;

    const schema =
      `Schema:\n` +
      `{\n` +
      `  "targetCalories": number,\n` +
      `  "macros": {"protein": number, "carbs": number, "fat": number},\n` +
      `  "micros": {"fiber": number, "sodium": number, "potassium": number, "vitaminC": number, "calcium": number, "iron": number},\n` +
      `  "adjustedTimelineWeeks": number,\n` +
      `  "weeklyPlan": {\n` +
      `    "workouts": [\n` +
      `      {\n` +
      `        "day": "Sun|Mon|Tue|Wed|Thu|Fri|Sat",\n` +
      `        "location": "home|gym",\n` +
      `        "focus": "Full Body|Upper|Lower|Push|Pull|Mobility|Cardio",\n` +
      `        "duration": number,\n` +
      `        "exercises": [ {"name": "string", "sets": number, "reps": "string", "restSec": number, "equipment": ["string"], "alt": "string"} ],\n` +
      `        "blocks": [ {"name": "string", "type": "cardio|strength|mobility", "duration": number} ]\n` +
      `      }\n` +
      `    ],\n` +
      `    "meals": [\n` +
      `      {\n` +
      `        "day": "Sun|Mon|Tue|Wed|Thu|Fri|Sat",\n` +
      `        "items": [ {"name": "string", "serving": "string", "grams": number, "calories": number, "protein": number, "carbs": number, "fat": number, "components": [{"name": "string", "grams": number}]} ]\n` +
      `      }\n` +
      `    ]\n` +
      `  },\n` +
      `  "countryFoods": [string],\n` +
      `  "notes": string\n` +
      `}`;

    const prompt =
      `Create a personalized, safe weekly example plan (7 days) for ${
        profile.name || "the user"
      }.\n` +
      `USER:\n` +
      `- Age: ${profile.age}\n` +
      `- Gender: ${profile.gender}\n` +
      `- Height: ${profile.height} m\n` +
      `- Weight: ${profile.weight} kg\n` +
      `- Body Type: ${profile.bodyType || "other"}\n` +
      `- Activity: ${profile.activityLevel || "moderate"}\n` +
      `- Goal: ${profile.goal}\n` +
      `- Country: ${profile.country || "Unknown"}\n` +
      `- Dietary Prefs: ${(profile.dietaryPreferences || []).join(", ") ||
        "none"}\n` +
      `- Allergies: ${(profile.allergies || []).join(", ") || "none"}\n\n` +
      targets +
      safety +
      `Return ONLY JSON per the schema. Ensure daily kcal total within ±5%.\n\n` +
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
        logger.error("curateInitialPlan parse fail", { raw });
        throw new Error("Model returned non-JSON");
      }
      return { plan };
    } catch (e: any) {
      logger.error("curateInitialPlan error", e);
      throw new HttpsError(
        "internal",
        `Plan generation failed: ${e?.message || e}`
      );
    }
  }
);

// ---------- Delete User Data ----------
export const deleteUserData = onCall({}, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  const uid = req.auth.uid;

  // Delete subcollections under users/{uid}
  const userRef = adminDb.collection("users").doc(uid);
  const subcols = await userRef.listCollections();
  for (const sc of subcols) {
    const docs = await sc.listDocuments();
    while (docs.length) {
      const batch = adminDb.batch();
      const take = docs.splice(0, 400);
      for (const d of take) batch.delete(d);
      await batch.commit();
    }
  }
  await userRef.delete().catch(() => {});

  // activities
  const actSnap = await adminDb
    .collection("activities")
    .where("userId", "==", uid)
    .get();
  for (const d of actSnap.docs) await d.ref.delete().catch(() => {});

  // conversations
  const convSnap = await adminDb
    .collection("conversations")
    .where("userId", "==", uid)
    .get();
  for (const d of convSnap.docs) await d.ref.delete().catch(() => {});

  return { ok: true };
});