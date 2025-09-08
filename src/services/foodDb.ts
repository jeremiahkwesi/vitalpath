// src/services/foodDb.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";

export type FoodItem = {
  id: string;
  name: string;
  brand?: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  source?: "local" | "off" | "usda" | "custom" | "nutritionix";
};

export type Paged<T> = {
  items: T[];
  hasMore: boolean;
};

const LOCAL_FOODS: FoodItem[] = [
  { id: "local-1", name: "Chicken Breast (100g)", serving: "100 g", calories: 165, protein: 31, carbs: 0, fat: 3.6, source: "local" },
  { id: "local-2", name: "Brown Rice (1 cup cooked)", serving: "195 g", calories: 216, protein: 5, carbs: 45, fat: 1.8, source: "local" },
  { id: "local-3", name: "Banana (1 medium)", serving: "118 g", calories: 105, protein: 1.3, carbs: 27, fat: 0.3, barcode: "0000000000012", source: "local" },
  { id: "local-4", name: "Greek Yogurt (170g)", serving: "170 g", calories: 100, protein: 17, carbs: 6, fat: 0, source: "local" },
  { id: "local-5", name: "Oats (40g dry)", serving: "40 g", calories: 150, protein: 5, carbs: 27, fat: 3, source: "local" },
  { id: "local-6", name: "Apple (1 medium)", serving: "182 g", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, barcode: "0000000000034", source: "local" },
  { id: "local-7", name: "Egg (1 large)", serving: "50 g", calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, source: "local" },
  { id: "local-8", name: "Almonds (28g)", serving: "28 g", calories: 164, protein: 6, carbs: 6, fat: 14, source: "local" },
  { id: "local-9", name: "Salmon (100g)", serving: "100 g", calories: 208, protein: 20, carbs: 0, fat: 13, source: "local" },
];

// Quick templates
export const TEMPLATES = [
  { name: "Chicken & Rice", type: "lunch", calories: 600, protein: 40, carbs: 70, fat: 15 },
  { name: "Yogurt + Berries", type: "breakfast", calories: 250, protein: 15, carbs: 35, fat: 5 },
  { name: "Omelette + Toast", type: "breakfast", calories: 450, protein: 25, carbs: 35, fat: 18 },
] as const;

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getCache<T>(k: string, ttl = TTL_MS): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { t: number; v: T };
    if (Date.now() - obj.t > ttl) return null;
    return obj.v;
  } catch {
    return null;
  }
}
async function setCache<T>(k: string, v: T) {
  try {
    await AsyncStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
  } catch {}
}
function n(v: any, fb = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fb;
}
function dedupe(items: FoodItem[]) {
  const m = new Map<string, FoodItem>();
  for (const it of items) m.set(it.id, it);
  return [...m.values()];
}

// ---- Open Food Facts ----
function mapOFFProduct(p: any): FoodItem | null {
  if (!p) return null;
  const nutr = p.nutriments || {};
  const kcal100 =
    n(nutr["energy-kcal_100g"]) ||
    n(nutr["energy-kcal"]) ||
    (n(nutr["energy_100g"]) ? Math.round(n(nutr["energy_100g"]) / 4.184) : 0);
  const proteins = n(nutr["proteins_100g"]);
  const carbs = n(nutr["carbohydrates_100g"]);
  const fat = n(nutr["fat_100g"]);
  const name = p.product_name || p.generic_name || p.brands || "Food item";
  const serving = p.serving_size || "100 g";
  return {
    id: p.code || p._id || `off-${name}`.toLowerCase(),
    name: String(name).trim(),
    brand: p.brands || undefined,
    serving,
    calories: Math.round(kcal100),
    protein: Math.round(proteins),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    barcode: p.code || undefined,
    source: "off",
  };
}
async function searchOpenFoodFactsPaged(
  q: string,
  page = 1,
  pageSize = 50
): Promise<Paged<FoodItem>> {
  const cacheKey = `off:search:${q}:${page}:${pageSize}`;
  const cached = await getCache<Paged<FoodItem>>(cacheKey);
  if (cached) return cached;
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    `search_terms=${encodeURIComponent(q)}` +
    "&search_simple=1&action=process&json=1" +
    `&page=${page}&page_size=${pageSize}` +
    "&fields=code,product_name,brands,serving_size,nutriments";
  try {
    const res = await fetch(url);
    const json = await res.json();
    const items =
      (json?.products || [])
        .map(mapOFFProduct)
        .filter(Boolean) as FoodItem[];
    const count = Number(json?.count ?? 0);
    const hasMore = page * pageSize < count;
    const out = { items: dedupe(items), hasMore };
    await setCache(cacheKey, out);
    return out;
  } catch {
    return { items: [], hasMore: false };
  }
}
async function fetchByBarcodeOFF(code: string): Promise<FoodItem | null> {
  const cacheKey = `off:barcode:${code}`;
  const cached = await getCache<FoodItem>(cacheKey);
  if (cached) return cached;
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
    code
  )}.json`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const mapped = mapOFFProduct(json?.product);
    if (mapped) await setCache(cacheKey, mapped);
    return mapped || null;
  } catch {
    return null;
  }
}

// ---- USDA via callable ----
async function searchUsdaPaged(
  q: string,
  page = 1,
  pageSize = 50
): Promise<Paged<FoodItem>> {
  const cacheKey = `usda:search:${q}:${page}:${pageSize}`;
  const cached = await getCache<Paged<FoodItem>>(cacheKey);
  if (cached) return cached;
  try {
    const call = httpsCallable(functions, "usdaSearch");
    const resp: any = await call({ query: q, page, pageSize });
    const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
    const hasMore = !!resp?.data?.hasMore;
    const out: Paged<FoodItem> = {
      items: (items || []).map((it: any) => ({ ...it, source: "usda" })),
      hasMore,
    };
    await setCache(cacheKey, out);
    return out;
  } catch {
    return { items: [], hasMore: false };
  }
}

// ---- Nutritionix via callable ----
async function searchNutritionixPaged(
  q: string,
  page = 1,
  pageSize = 25
): Promise<Paged<FoodItem>> {
  const cacheKey = `nix:search:${q}:${page}:${pageSize}`;
  const cached = await getCache<Paged<FoodItem>>(cacheKey);
  if (cached) return cached;
  try {
    const call = httpsCallable(functions, "nutritionixSearch");
    const resp: any = await call({ query: q, page, pageSize });
    const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
    const hasMore = !!resp?.data?.hasMore;
    const out: Paged<FoodItem> = {
      items: (items || []).map((it: any) => ({ ...it, source: "nutritionix" })),
      hasMore,
    };
    await setCache(cacheKey, out);
    return out;
  } catch {
    return { items: [], hasMore: false };
  }
}

// ---------- Firestore: Custom Foods ----------
export async function addCustomFood(
  uid: string,
  food: Omit<FoodItem, "id" | "source">
): Promise<FoodItem> {
  const col = collection(db, "users", uid, "customFoods");
  const ref = await addDoc(col, { ...food, source: "custom" });
  return { ...food, id: ref.id, source: "custom" };
}
export async function updateCustomFood(
  uid: string,
  id: string,
  data: Partial<Omit<FoodItem, "id" | "source">>
): Promise<void> {
  const ref = doc(db, "users", uid, "customFoods", id);
  await updateDoc(ref, { ...data });
}
export async function deleteCustomFood(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "customFoods", id));
}
export async function getCustomFoods(uid: string): Promise<FoodItem[]> {
  try {
    const col = collection(db, "users", uid, "customFoods");
    const snap = await getDocs(col);
    const out: FoodItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as DocumentData;
      out.push({
        id: d.id,
        name: String(data.name || "Custom food"),
        brand: data.brand || undefined,
        serving: String(data.serving || "1 serving"),
        calories: n(data.calories),
        protein: n(data.protein),
        carbs: n(data.carbs),
        fat: n(data.fat),
        barcode: data.barcode || undefined,
        source: "custom",
      });
    });
    return out;
  } catch {
    return [];
  }
}
export async function findCustomByBarcode(
  uid: string,
  code: string
): Promise<FoodItem | null> {
  try {
    const col = collection(db, "users", uid, "customFoods");
    const qy = query(col, where("barcode", "==", code));
    const snap = await getDocs(qy);
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data() as DocumentData;
    return {
      id: first.id,
      name: data.name,
      brand: data.brand,
      serving: data.serving,
      calories: n(data.calories),
      protein: n(data.protein),
      carbs: n(data.carbs),
      fat: n(data.fat),
      barcode: data.barcode,
      source: "custom",
    };
  } catch {
    return null;
  }
}

// ---------- Public API ----------
export async function searchFoodsPaged(
  queryText: string,
  opts: { uid?: string; page?: number; pageSize?: number } = {}
): Promise<Paged<FoodItem>> {
  const qText = queryText.trim().toLowerCase();
  if (!qText) return { items: [], hasMore: false };

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  const localMatches = LOCAL_FOODS.filter((f) =>
    f.name.toLowerCase().includes(qText)
  );
  const customAll = opts.uid ? await getCustomFoods(opts.uid) : [];
  const customMatches = customAll.filter((f) =>
    f.name.toLowerCase().includes(qText)
  );

  const [off, usda, nix] = await Promise.all([
    searchOpenFoodFactsPaged(qText, page, pageSize),
    searchUsdaPaged(qText, page, pageSize),
    searchNutritionixPaged(qText, page, Math.min(25, pageSize)),
  ]);

  const merged = dedupe([
    ...customMatches,
    ...localMatches,
    ...nix.items,
    ...usda.items,
    ...off.items,
  ]);
  return { items: merged, hasMore: off.hasMore || usda.hasMore || nix.hasMore };
}

export async function searchFoods(
  queryText: string,
  opts: { uid?: string; limit?: number } = {}
): Promise<FoodItem[]> {
  const res = await searchFoodsPaged(queryText, {
    uid: opts.uid,
    page: 1,
    pageSize: opts.limit ?? 50,
  });
  return res.items;
}

export async function getByBarcode(
  code: string,
  opts: { uid?: string } = {}
): Promise<FoodItem | null> {
  if (opts.uid) {
    const c = await findCustomByBarcode(opts.uid, code);
    if (c) return c;
  }
  const off = await fetchByBarcodeOFF(code);
  if (off) return off;
  const local = LOCAL_FOODS.find((f) => f.barcode === code) || null;
  return local;
}