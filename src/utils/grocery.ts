// src/utils/grocery.ts
import { getPlanner } from "./mealPlanner";
import type { PantryItem } from "../services/pantry";

export type GroceryItem = {
  name: string;
  grams?: number;
  count?: number;
};

export type GroceryList = {
  items: GroceryItem[];
  missing: string[];
};

function add(map: Map<string, GroceryItem>, name: string, grams?: number) {
  const k = name.trim().toLowerCase();
  const ex = map.get(k);
  if (ex) {
    ex.grams = (ex.grams || 0) + (grams || 0);
    ex.count = (ex.count || 0) + 1;
  } else {
    map.set(k, { name, grams: grams || 0, count: 1 });
  }
}

export async function buildGroceryForRange(
  uid: string,
  startISO: string,
  days = 7
): Promise<GroceryList> {
  const planner = await getPlanner(uid);
  const out = new Map<string, GroceryItem>();
  const missing: string[] = [];

  const d0 = new Date(startISO);
  for (let i = 0; i < days; i++) {
    const dt = new Date(d0);
    dt.setDate(d0.getDate() + i);
    const iso = dt.toISOString().split("T")[0];
    const day = planner[iso];
    if (!day) continue;
    for (const m of day.meals || []) {
      if (Array.isArray(m.components) && m.components.length) {
        for (const c of m.components) {
          add(out, c.name, c.grams);
        }
      } else {
        missing.push(`${iso}: ${m.name}`);
      }
    }
  }

  const items = Array.from(out.values());
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items, missing };
}

export function subtractPantry(
  items: GroceryItem[],
  pantry: PantryItem[]
): { need: GroceryItem[]; have: GroceryItem[] } {
  const pMap = new Map<string, PantryItem>();
  for (const p of pantry) pMap.set(p.name.trim().toLowerCase(), p);
  const need: GroceryItem[] = [];
  const have: GroceryItem[] = [];

  for (const it of items) {
    const p = pMap.get(it.name.trim().toLowerCase());
    if (!p) {
      need.push({ ...it });
      continue;
    }
    const pg = p.grams || 0;
    const ig = it.grams || 0;
    if (pg >= ig) {
      have.push({ name: it.name, grams: ig });
    } else {
      have.push({ name: it.name, grams: pg });
      need.push({ name: it.name, grams: ig - pg });
    }
  }
  return { need, have };
}