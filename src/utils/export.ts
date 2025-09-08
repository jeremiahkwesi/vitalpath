// src/utils/export.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { shareAsync } from "expo-sharing";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  doc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getUnits, getIntegrations, getGoals, setUnits, setIntegrations, setGoals } from "./userSettings";

type ExportBundle = {
  version: number;
  exportedAt: string;
  userId: string;
  activities: any[];
  customFoods: any[];
  customExercises: any[];
  routines: any[];
  planner: Record<string, any>;
  settings: {
    units: any;
    integrations: any;
    goals: any;
    reminders?: any;
  };
};

async function safeJsonParse<T>(s: string): Promise<T | null> {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function exportAll(uid: string): Promise<string> {
  // Firestore collections
  const activitiesCol = collection(db, "activities");
  const foodsCol = collection(db, "users", uid, "customFoods");
  const exCol = collection(db, "users", uid, "customExercises");
  const rCol = collection(db, "users", uid, "routines");

  const [activitiesSnap, foodsSnap, exSnap, rSnap] = await Promise.all([
    getDocs(query(activitiesCol, where("userId", "==", uid))),
    getDocs(foodsCol),
    getDocs(exCol),
    getDocs(rCol),
  ]);

  const activities: any[] = [];
  activitiesSnap.forEach((d) => {
    const x = d.data();
    activities.push({ id: d.id, ...x });
  });

  const customFoods: any[] = [];
  foodsSnap.forEach((d) => customFoods.push({ id: d.id, ...d.data() }));

  const customExercises: any[] = [];
  exSnap.forEach((d) => customExercises.push({ id: d.id, ...d.data() }));

  const routines: any[] = [];
  rSnap.forEach((d) => routines.push({ id: d.id, ...d.data() }));

  const plannerRaw =
    (await AsyncStorage.getItem(`planner:${uid}`)) || "{}";
  const planner = (await safeJsonParse<Record<string, any>>(plannerRaw)) || {};

  const remindersRaw =
    (await AsyncStorage.getItem(`reminders:${uid}`)) || null;

  const units = await getUnits(uid);
  const integrations = await getIntegrations(uid);
  const goals = await getGoals(uid);

  const bundle: ExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: uid,
    activities,
    customFoods,
    customExercises,
    routines,
    planner,
    settings: {
      units,
      integrations,
      goals,
      reminders: remindersRaw ? JSON.parse(remindersRaw) : undefined,
    },
  };

  const json = JSON.stringify(bundle, null, 2);
  const fileName = `vitalpath-export-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  const fileUri = FileSystem.cacheDirectory + fileName;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    await shareAsync(fileUri, { dialogTitle: "Export VitalPath data" });
  } catch {}
  return fileUri;
}

export async function importFromJson(
  uid: string,
  jsonText: string
): Promise<{ activities: number; customs: number; routines: number }> {
  const parsed = await safeJsonParse<ExportBundle>(jsonText);
  if (!parsed) throw new Error("Invalid JSON");

  // Planner
  if (parsed.planner) {
    await AsyncStorage.setItem(
      `planner:${uid}`,
      JSON.stringify(parsed.planner)
    );
  }

  // Settings
  if (parsed.settings?.units) await setUnits(parsed.settings.units, uid);
  if (parsed.settings?.integrations)
    await setIntegrations(parsed.settings.integrations, uid);
  if (parsed.settings?.goals) await setGoals(parsed.settings.goals, uid);
  if (parsed.settings?.reminders)
    await AsyncStorage.setItem(
      `reminders:${uid}`,
      JSON.stringify(parsed.settings.reminders)
    );

  // Firestore writes (append)
  let aCount = 0;
  let cCount = 0;
  let rCount = 0;

  // Activities: rewrite IDs to this uid
  for (const a of parsed.activities || []) {
    try {
      const date = a?.date || a?.id?.split("_")[1] || "";
      const id = `${uid}_${date || new Date().toISOString().split("T")[0]}`;
      const payload = { ...a, id, userId: uid };
      await setDoc(doc(db, "activities", id), payload, { merge: true });
      aCount++;
    } catch {}
  }

  // Custom foods
  for (const f of parsed.customFoods || []) {
    try {
      const data = { ...f };
      delete (data as any).id;
      await addDoc(collection(db, "users", uid, "customFoods"), data);
      cCount++;
    } catch {}
  }

  // Custom exercises
  for (const e of parsed.customExercises || []) {
    try {
      const data = { ...e };
      delete (data as any).id;
      await addDoc(collection(db, "users", uid, "customExercises"), data);
      cCount++;
    } catch {}
  }

  // Routines
  for (const r of parsed.routines || []) {
    try {
      const data = { ...r };
      delete (data as any).id;
      await addDoc(collection(db, "users", uid, "routines"), data);
      rCount++;
    } catch {}
  }

  return { activities: aCount, customs: cCount, routines: rCount };
}

export async function clearLocalCache(uid?: string | null) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefixes = [
      "wger:",
      "off:",
      "usda:",
      "nix:",
      "planner:",
      "activity:",
      "units:",
      "settings:",
      "reminders:",
      "lifts:last:",
    ];
    const uidStr = uid && uid.length ? uid : "anon";
    const toRemove = keys.filter(
      (k) =>
        prefixes.some((p) => k.startsWith(p)) ||
        k.includes(`:${uidStr}`) // user-scoped
    );
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}