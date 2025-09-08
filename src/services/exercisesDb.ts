// src/services/exercisesDb.ts
const API = "https://wger.de/api/v2";

export type Muscle = {
  id: number;
  name: string;
  is_front: boolean;
  name_en?: string;
};
export type Exercise = {
  id: number;
  name: string;
  description: string;
  category: number;
  muscles: number[];
  muscles_secondary: number[];
  equipment: number[];
  images?: { id: number; image: string; is_main: boolean }[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

export async function getMuscles(): Promise<Muscle[]> {
  const data = await fetchJson<{ results: any[] }>(`${API}/muscle/?limit=200`);
  return data.results.map((m) => ({
    id: m.id,
    name: m.name,
    is_front: !!m.is_front,
    name_en: m.name_en || m.name,
  }));
}

export async function searchExercisesByMuscle(
  muscleId: number,
  limit = 60
): Promise<Exercise[]> {
  const data = await fetchJson<{ results: any[] }>(
    `${API}/exercise/?limit=${limit}&muscles=${muscleId}&language=2`
  );
  const exs = data.results.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    muscles: e.muscles,
    muscles_secondary: e.muscles_secondary,
    equipment: e.equipment,
  })) as Exercise[];
  for (const ex of exs) {
    try {
      const imgs = await fetchJson<{ results: any[] }>(
        `${API}/exerciseimage/?exercise=${ex.id}`
      );
      ex.images = imgs.results.map((i) => ({
        id: i.id,
        image: i.image,
        is_main: i.is_main,
      }));
    } catch {}
  }
  return exs;
}

export async function searchExercisesByName(
  name: string
): Promise<Exercise[]> {
  const data = await fetchJson<{ results: any[] }>(
    `${API}/exercise/?limit=50&name=${encodeURIComponent(name)}&language=2`
  );
  return data.results.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    category: e.category,
    muscles: e.muscles,
    muscles_secondary: e.muscles_secondary,
    equipment: e.equipment,
  })) as Exercise[];
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function stripHtml(html: string): string {
  return decodeEntities(String(html || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}