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

export type Paged<T> = { items: T[]; hasMore: boolean };

const API = "https://wger.de/api/v2";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

const LOCAL_EXERCISES: Exercise[] = [
  {
    id: "local-bench",
    name: "Barbell Bench Press",
    category: "Chest",
    equipment: ["Barbell", "Bench"],
    primaryMuscles: ["Pectoralis Major"],
    secondaryMuscles: ["Triceps", "Anterior Deltoid"],
    description:
      "Lie on a flat bench, grip slightly wider than shoulders, lower bar " +
      "to mid-chest with control, then press up.",
    source: "local",
  },
  {
    id: "local-squat",
    name: "Back Squat",
    category: "Legs",
    equipment: ["Barbell", "Rack"],
    primaryMuscles: ["Quadriceps", "Glutes"],
    secondaryMuscles: ["Hamstrings", "Core"],
    description:
      "With bar on upper back, brace core, sit hips back and down to " +
      "parallel, then drive up through mid-foot.",
    source: "local",
  },
  {
    id: "local-deadlift",
    name: "Conventional Deadlift",
    category: "Back",
    equipment: ["Barbell"],
    primaryMuscles: ["Hamstrings", "Glutes", "Erector Spinae"],
    secondaryMuscles: ["Forearms", "Core"],
    description:
      "Hinge at hips, grip the bar, brace, push floor away and stand tall. " +
      "Keep bar close and spine neutral.",
    source: "local",
  },
  {
    id: "local-pullup",
    name: "Pull-Up",
    category: "Back",
    equipment: ["Pull-up Bar"],
    primaryMuscles: ["Latissimus Dorsi"],
    secondaryMuscles: ["Biceps", "Traps", "Forearms"],
    description:
      "Hang from a bar, pull elbows down/back to bring chest toward bar, " +
      "lower under control.",
    source: "local",
  },
  {
    id: "local-plank",
    name: "Plank",
    category: "Core",
    equipment: ["Bodyweight"],
    primaryMuscles: ["Core"],
    secondaryMuscles: ["Glutes"],
    description:
      "Elbows under shoulders, legs straight, squeeze glutes and brace core, " +
      "hold straight line.",
    source: "local",
  },
];

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
function decodeEntities(s: string) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
export function stripHtml(html?: string): string {
  if (!html) return "";
  return decodeEntities(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function dedupe<T extends { id: string }>(arr: T[]): T[] {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.id, x);
  return Array.from(m.values());
}
async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

function mapExInfo(e: any): Exercise | null {
  const id = e?.id != null ? String(e.id) : undefined;
  const name = String(e?.name || "").trim();
  if (!id || name.length < 2) return null;

  const equipment = Array.isArray(e?.equipment)
    ? e.equipment.map((x: any) => x?.name).filter(Boolean)
    : [];
  const primaryMuscles = Array.isArray(e?.muscles)
    ? e.muscles.map((x: any) => x?.name).filter(Boolean)
    : [];
  const secondaryMuscles = Array.isArray(e?.muscles_secondary)
    ? e.muscles_secondary.map((x: any) => x?.name).filter(Boolean)
    : [];
  const category =
    e?.category?.name ||
    (typeof e?.category === "string" ? e.category : "General");

  return {
    id,
    name,
    category,
    equipment: equipment.length ? equipment : ["Bodyweight"],
    primaryMuscles,
    secondaryMuscles,
    description: stripHtml(e?.description || ""),
    source: "wger",
  };
}

export async function searchExercises(
  queryText: string,
  opts: { limit?: number } = {}
): Promise<Exercise[]> {
  const q = queryText.trim();
  if (!q) return [];

  const locals = LOCAL_EXERCISES.filter((e) =>
    e.name.toLowerCase().includes(q.toLowerCase())
  );

  try {
    const limit = Math.max(1, Math.min(120, opts.limit || 80));
    const url =
      `${API}/exerciseinfo/?language=2&limit=${limit}&search=` +
      encodeURIComponent(q);
    const data = await fetchJson<{ results: any[] }>(url);
    const wger = (data.results || []).map(mapExInfo).filter(Boolean) as
      | Exercise[]
      | [];
    const final = dedupe([...locals, ...wger]);
    return final.filter((e) => e.name && e.name.trim().length >= 2);
  } catch {
    return locals;
  }
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const local = LOCAL_EXERCISES.find((e) => e.id === id);
  if (local) return local;
  try {
    const url = `${API}/exerciseinfo/${encodeURIComponent(id)}/?language=2`;
    const e = await fetchJson<any>(url);
    return mapExInfo(e);
  } catch {
    return null;
  }
}

export function getHowToSteps(ex: Exercise): string[] {
  const text = String(ex.description || "").trim();
  if (!text) return [];
  const byBreaks = text.split(/(?:\r?\n|\u2028)+/g).map((s) => s.trim());
  const chunks =
    byBreaks.filter((s) => s.length >= 3).length > 1
      ? byBreaks
      : text.split(/(?:\. |\.\n|; |- )/g).map((s) => s.trim());
  return chunks.filter((s) => s.length >= 3);
}

function toHevyBucket(m?: string, category?: string): string {
  const x = (m || "").toLowerCase();
  if (x.includes("pector")) return "Chest";
  if (
    x.includes("lat") ||
    x.includes("rhom") ||
    x.includes("trape") ||
    x.includes("spinae")
  )
    return "Back";
  if (x.includes("deltoid")) return "Shoulders";
  if (x.includes("biceps")) return "Biceps";
  if (x.includes("triceps")) return "Triceps";
  if (x.includes("forearm") || x.includes("brachiorad")) return "Forearms";
  if (x.includes("quad") || x.includes("vastus") || x.includes("rectus fem"))
    return "Quads";
  if (x.includes("hamstring") || x.includes("biceps fem") || x.includes("semi"))
    return "Hamstrings";
  if (x.includes("glute")) return "Glutes";
  if (x.includes("gastro") || x.includes("soleus")) return "Calves";
  if (x.includes("abdom") || x.includes("oblique") || x.includes("core"))
    return "Core";
  const c = (category || "").toLowerCase();
  if (c.includes("chest")) return "Chest";
  if (c.includes("back")) return "Back";
  if (c.includes("shoulder")) return "Shoulders";
  if (c.includes("leg")) return "Legs";
  return "Other";
}
export function groupByPrimaryMuscle(items: Exercise[]): {
  title: string;
  data: Exercise[];
}[] {
  const groups = new Map<string, Exercise[]>();
  for (const ex of items) {
    const first = (ex.primaryMuscles || [])[0];
    const key = toHevyBucket(first, ex.category);
    const arr = groups.get(key) || [];
    arr.push(ex);
    groups.set(key, arr);
  }
  const out = Array.from(groups.entries()).map(([title, data]) => ({
    title,
    data,
  }));
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export async function addCustomExercise(
  uid: string,
  ex: Omit<Exercise, "id" | "source">
): Promise<Exercise> {
  const ref = await addDoc(collection(db, "users", uid, "customExercises"), {
    ...ex,
    source: "custom",
  });
  return { ...ex, id: ref.id, source: "custom" };
}
export async function updateCustomExercise(
  uid: string,
  id: string,
  data: Partial<Omit<Exercise, "id" | "source">>
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "customExercises", id), { ...data });
}
export async function deleteCustomExercise(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "customExercises", id));
}
export async function getCustomExercises(uid: string): Promise<Exercise[]> {
  try {
    const snap = await getDocs(collection(db, "users", uid, "customExercises"));
    const out: Exercise[] = [];
    snap.forEach((d) => {
      const x = d.data() as DocumentData;
      out.push({
        id: d.id,
        name: String(x.name || "Custom Exercise"),
        category: x.category || "Custom",
        equipment: Array.isArray(x.equipment) ? x.equipment : [],
        primaryMuscles: Array.isArray(x.primaryMuscles)
          ? x.primaryMuscles
          : [],
        secondaryMuscles: Array.isArray(x.secondaryMuscles)
          ? x.secondaryMuscles
          : [],
        description: x.description ? stripHtml(x.description) : undefined,
        source: "custom",
      });
    });
    return out;
  } catch {
    return [];
  }
}

// Append to Routine draft (guaranteed pickup by Builder)
type Day = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
const DAYS: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function todayDay(): Day {
  return DAYS[new Date().getDay()] || "Mon";
}
export async function appendExerciseToRoutineDraft(
  uid: string | null,
  ex: Exercise,
  opts?: { day?: Day }
) {
  const key = uid ? `routine:draft:${uid}` : "routine:draft:anon";
  let draft: { name: string; items: any[] } = {
    name: "My Workout",
    items: [],
  };
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) draft = JSON.parse(raw);
  } catch {}
  const day = opts?.day || todayDay();
  draft.items = draft.items || [];
  draft.items.push({
    externalId: ex.source === "wger" ? String(ex.id) : undefined,
    name: ex.name,
    day,
    sets: [{ reps: "8-12", restSec: 90, type: "normal" }],
  });
  try {
    await AsyncStorage.setItem(key, JSON.stringify(draft));
  } catch {}
}