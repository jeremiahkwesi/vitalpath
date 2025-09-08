// src/utils/exerciseFavorites.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Exercise } from "../services/workoutsDb";

function key(uid: string | null) {
  return uid ? `exFavs:${uid}` : "exFavs:anon";
}

export type FavExercise = { name: string; id?: string };

export async function getExerciseFavorites(
  uid: string | null
): Promise<FavExercise[]> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

export async function setExerciseFavorites(
  uid: string | null,
  list: FavExercise[]
) {
  try {
    await AsyncStorage.setItem(key(uid), JSON.stringify(list));
  } catch {}
}

export async function isExerciseFavorite(
  uid: string | null,
  name: string
): Promise<boolean> {
  const list = await getExerciseFavorites(uid);
  return !!list.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

export async function toggleExerciseFavorite(
  uid: string | null,
  ex: Pick<Exercise, "name" | "id">
): Promise<boolean> {
  const list = await getExerciseFavorites(uid);
  const idx = list.findIndex(
    (f) => f.name.toLowerCase() === ex.name.toLowerCase()
  );
  if (idx >= 0) {
    list.splice(idx, 1);
    await setExerciseFavorites(uid, list);
    return false; // now unfavorited
  }
  list.push({ name: ex.name, id: ex.id });
  await setExerciseFavorites(uid, list);
  return true; // now favorited
}