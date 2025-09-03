// src/services/workoutsDb.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  DocumentData,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type Exercise = {
  id: string;
  name: string;
  category?: string;
  equipment?: string[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  description?: string;
  source?: "wger" | "local" | "custom";
};

export type Paged<T> = {
  items: T[];
  hasMore: boolean;
};

const LOCAL_EXERCISES: Exercise[] = [
  {
    id: "local-bench",
    name: "Barbell Bench Press",
    category: "Chest",
    equipment: ["Barbell", "Bench"],
    primaryMuscles: ["Pectoralis Major", "Triceps"],
    secondaryMuscles: ["Anterior Deltoid"],
    source: "local",
  },
  {
    id: "local-squat",
    name: "Back Squat",
    category: "Legs",
    equipment: ["Barbell", "Rack"],
    primaryMuscles: ["Quadriceps", "Glutes"],
    secondaryMuscles: ["Hamstrings", "Core"],
    source: "local",
  },
  {
    id: "local-deadlift",
    name: "Conventional Deadlift",
    category: "Back",
    equipment: ["Barbell"],
    primaryMuscles: ["Hamstrings", "Glutes", "Back"],
    secondaryMuscles: ["Forearms", "Core"],
    source: "local",
  },
  {
    id: "local-pullup",
    name: "Pull-Up",
    category: "Back",
    equipment: ["Pull-up Bar"],
    primaryMuscles: ["Lats", "Biceps"],
    secondaryMuscles: ["Traps", "Forearms"],
    source: "local",
  },
  {
    id: "local-plank",
    name: "Plank",
    category: "Core",
    equipment: ["Bodyweight"],
    primaryMuscles: ["Core"],
    secondaryMuscles: ["Glutes"],
    source: "local",
  },
];

const TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function dedupe<T extends { id: string }>(arr: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.id, x);
  return Array.from(m.values());
}

function mapWgerExercise(e: any): Exercise | null {
  if (!e?.name) return null;
  return {
    id: String(e.id),
    name: e.name,
    category: e.category?.name,
    equipment: (e.equipment || []).map((x: any) => x.name),
    primaryMuscles: (e.muscles || []).map((x: any) => x.name),
    secondaryMuscles: (e.muscles_secondary || []).map((x: any) => x.name),
    description: stripHtml(e.description),
    source: "wger",
  };
}

async function searchWgerPaged(
  query: string,
  page = 1,
  pageSize = 100
): Promise<Paged<Exercise>> {
  const offset = (page - 1) * pageSize;
  const key = `wger:search:${query || "_all"}:${page}:${pageSize}`;
  const cached = await getCache<Paged<Exercise>>(key);
  if (cached) return cached;

  const urlBase = "https://wger.de/api/v2/exerciseinfo/?language=2";
  const url =
    urlBase +
    `&limit=${pageSize}&offset=${offset}` +
    (query ? `&search=${encodeURIComponent(query)}` : "");

  try {
    const r = await fetch(url);
    const j = await r.json();
    const items: Exercise[] = (j?.results || [])
      .map(mapWgerExercise)
      .filter(Boolean) as Exercise[];
    const uniq = dedupe(items);
    const count = Number(j?.count ?? 0);
    const hasMore = offset + pageSize < count;
    const out = { items: uniq, hasMore };
    await setCache(key, out);
    return out;
  } catch {
    return { items: [], hasMore: false };
  }
}

export async function addCustomExercise(
  uid: string,
  ex: Omit<Exercise, "id" | "source">
): Promise<Exercise> {
  const col = collection(db, "users", uid, "customExercises");
  const ref = await addDoc(col, { ...ex, source: "custom" });
  return { ...ex, id: ref.id, source: "custom" };
}

export async function updateCustomExercise(
  uid: string,
  id: string,
  data: Partial<Omit<Exercise, "id" | "source">>
): Promise<void> {
  const ref = doc(db, "users", uid, "customExercises", id);
  await updateDoc(ref, { ...data });
}

export async function deleteCustomExercise(
  uid: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "customExercises", id));
}

export async function getCustomExercises(uid: string): Promise<Exercise[]> {
  try {
    const col = collection(db, "users", uid, "customExercises");
    const snap = await getDocs(col);
    const out: Exercise[] = [];
    snap.forEach((d) => {
      const x = d.data() as DocumentData;
      out.push({
        id: d.id,
        name: String(x.name || "Custom Exercise"),
        category: x.category,
        equipment: x.equipment || [],
        primaryMuscles: x.primaryMuscles || [],
        secondaryMuscles: x.secondaryMuscles || [],
        description: x.description,
        source: "custom",
      });
    });
    return out;
  } catch {
    return [];
  }
}

export async function searchExercisesPaged(
  queryText: string,
  opts: { uid?: string; page?: number; pageSize?: number } = {}
): Promise<Paged<Exercise>> {
  const q = queryText.trim().toLowerCase();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 100;

  const local = q
    ? LOCAL_EXERCISES.filter((e) => e.name.toLowerCase().includes(q))
    : LOCAL_EXERCISES;

  const customAll = opts.uid ? await getCustomExercises(opts.uid) : [];
  const customMatches = q
    ? customAll.filter((e) => e.name.toLowerCase().includes(q))
    : customAll;

  const wger = await searchWgerPaged(q, page, pageSize);

  const merged = dedupe([...customMatches, ...local, ...wger.items]);
  return { items: merged, hasMore: wger.hasMore };
}

// Back-compat
export async function searchExercises(
  queryText: string,
  opts: { uid?: string; limit?: number } = {}
) {
  const res = await searchExercisesPaged(queryText, {
    uid: opts.uid,
    page: 1,
    pageSize: opts.limit ?? 100,
  });
  return res.items;
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const local = LOCAL_EXERCISES.find((e) => e.id === id);
  if (local) return local;

  const key = `wger:byid:${id}`;
  const cached = await getCache<Exercise>(key);
  if (cached) return cached;

  try {
    const r = await fetch(
      `https://wger.de/api/v2/exerciseinfo/${encodeURIComponent(id)}/?language=2`
    );
    const j = await r.json();
    const mapped = mapWgerExercise(j);
    if (mapped) await setCache(key, mapped);
    return mapped || null;
  } catch {
    return null;
  }
}