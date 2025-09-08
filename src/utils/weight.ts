// src/utils/weight.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

type WeightEntry = { date: string; kg: number };

const key = (uid: string) => `weights:${uid}`;

export async function addWeight(uid: string, dateISO: string, kg: number) {
  const map = await getWeightMap(uid);
  map[dateISO] = kg;
  await AsyncStorage.setItem(key(uid), JSON.stringify(map));
  return map;
}

export async function getWeightMap(
  uid: string
): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function listWeights(uid: string): Promise<WeightEntry[]> {
  const map = await getWeightMap(uid);
  const arr: WeightEntry[] = Object.keys(map).map((d) => ({
    date: d,
    kg: map[d],
  }));
  arr.sort((a, b) => (a.date < b.date ? -1 : 1));
  return arr;
}

export function weeklyAvg(entries: WeightEntry[], weeks = 1): number | null {
  if (!entries.length) return null;
  const end = entries[entries.length - 1];
  // average last N weeks (7*weeks days), inclusive of end
  const count = 7 * weeks;
  const slice = entries.slice(-count);
  const sum = slice.reduce((a, e) => a + e.kg, 0);
  return Math.round((sum / slice.length) * 10) / 10;
}