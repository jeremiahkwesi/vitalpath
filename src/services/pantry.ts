// src/services/pantry.ts
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

export type PantryItem = {
  id: string;
  name: string;
  grams?: number; // for bulk items, e.g., rice 1000 g
  unit?: string; // optional: "g", "pcs", "ml"
  count?: number; // for discrete items, e.g., eggs
  updatedAt: number;
};

export async function listPantry(uid: string): Promise<PantryItem[]> {
  const snap = await getDocs(collection(db, "users", uid, "pantry"));
  const out: PantryItem[] = [];
  snap.forEach((d) => {
    const x = d.data() as DocumentData;
    out.push({
      id: d.id,
      name: String(x.name || "Item"),
      grams: typeof x.grams === "number" ? x.grams : undefined,
      unit: x.unit || undefined,
      count: typeof x.count === "number" ? x.count : undefined,
      updatedAt: Number(x.updatedAt || Date.now()),
    });
  });
  // sort by updatedAt desc
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export async function addPantryItem(
  uid: string,
  it: Omit<PantryItem, "id" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "users", uid, "pantry"), {
    ...it,
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updatePantryItem(
  uid: string,
  id: string,
  patch: Partial<Omit<PantryItem, "id">>
) {
  await updateDoc(doc(db, "users", uid, "pantry", id), {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function deletePantryItem(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "pantry", id));
}