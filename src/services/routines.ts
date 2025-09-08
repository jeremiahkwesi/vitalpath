// src/services/routines.ts
import { doc, collection, addDoc, updateDoc, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export type SetType = "normal" | "superset" | "dropset" | "pyramid" | "amrap" | "timed";

export type RoutineExerciseSet = {
  reps?: string; // "10" or "8-12"
  weight?: number; // optional future
  restSec: number;
  type: SetType;
};

export type RoutineExercise = {
  externalId?: string; // from wger
  name: string;
  day: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
  groupId?: string; // for superset grouping (same groupId means these run together)
  sets: RoutineExerciseSet[];
};

export type Routine = {
  id?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: RoutineExercise[]; // across days
};

export async function saveRoutine(uid: string, routine: Omit<Routine, "id">): Promise<string> {
  const col = collection(db, "users", uid, "routines");
  const ref = await addDoc(col, routine);
  return ref.id;
}

export async function updateRoutine(uid: string, id: string, patch: Partial<Routine>) {
  await updateDoc(doc(db, "users", uid, "routines", id), { ...patch, updatedAt: Date.now() });
}

export async function deleteRoutine(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "routines", id));
}

export async function listRoutines(uid: string): Promise<Routine[]> {
  const col = collection(db, "users", uid, "routines");
  const snap = await getDocs(col);
  const out: Routine[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    out.push({
      id: d.id,
      name: String(data.name || "Routine"),
      createdAt: Number(data.createdAt || Date.now()),
      updatedAt: Number(data.updatedAt || Date.now()),
      items: Array.isArray(data.items) ? data.items : [],
    });
  });
  return out;
}