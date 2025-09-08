// src/services/recipes.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  DocumentData,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type Ingredient = {
  name: string;
  grams?: number; // total grams for this ingredient in the recipe
  quantity?: string; // "1 cup", "2 tbsp" (optional UI)
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number; // number of servings the recipe yields
  ingredients: Ingredient[];
  steps?: string[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

function n(v: any, fb = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fb;
}

export function computeTotals(ingredients: Ingredient[]) {
  const t = ingredients.reduce(
    (acc, it) => {
      acc.calories += n(it.calories);
      acc.protein += n(it.protein);
      acc.carbs += n(it.carbs);
      acc.fat += n(it.fat);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return {
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  };
}

export async function addRecipe(
  uid: string,
  r: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "totals">
): Promise<string> {
  const col = collection(db, "users", uid, "recipes");
  const totals = computeTotals(r.ingredients || []);
  const ref = await addDoc(col, {
    ...r,
    totals,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateRecipe(
  uid: string,
  id: string,
  patch: Partial<Omit<Recipe, "id">>
) {
  const totals = patch.ingredients ? computeTotals(patch.ingredients) : undefined;
  await updateDoc(doc(db, "users", uid, "recipes", id), {
    ...patch,
    ...(totals ? { totals } : {}),
    updatedAt: Date.now(),
  });
}

export async function deleteRecipe(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "recipes", id));
}

export async function getRecipe(uid: string, id: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "users", uid, "recipes", id));
  if (!snap.exists()) return null;
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: String(d.name || "Recipe"),
    servings: Number(d.servings || 1),
    ingredients: Array.isArray(d.ingredients) ? d.ingredients : [],
    steps: Array.isArray(d.steps) ? d.steps : [],
    tags: Array.isArray(d.tags) ? d.tags : [],
    createdAt: Number(d.createdAt || Date.now()),
    updatedAt: Number(d.updatedAt || Date.now()),
    totals: {
      calories: Number(d?.totals?.calories || 0),
      protein: Number(d?.totals?.protein || 0),
      carbs: Number(d?.totals?.carbs || 0),
      fat: Number(d?.totals?.fat || 0),
    },
  };
}

export async function listRecipes(uid: string): Promise<Recipe[]> {
  const col = collection(db, "users", uid, "recipes");
  const snap = await getDocs(col);
  const out: Recipe[] = [];
  snap.forEach((d) => {
    const x = d.data() as DocumentData;
    out.push({
      id: d.id,
      name: String(x.name || "Recipe"),
      servings: Number(x.servings || 1),
      ingredients: Array.isArray(x.ingredients) ? x.ingredients : [],
      steps: Array.isArray(x.steps) ? x.steps : [],
      tags: Array.isArray(x.tags) ? x.tags : [],
      createdAt: Number(x.createdAt || Date.now()),
      updatedAt: Number(x.updatedAt || Date.now()),
      totals: {
        calories: Number(x?.totals?.calories || 0),
        protein: Number(x?.totals?.protein || 0),
        carbs: Number(x?.totals?.carbs || 0),
        fat: Number(x?.totals?.fat || 0),
      },
    });
  });
  // sort newest first
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}