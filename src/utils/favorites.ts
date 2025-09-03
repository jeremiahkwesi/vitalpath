// src/utils/favorites.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type Favorite = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  type: "breakfast" | "lunch" | "dinner" | "snack";
};

export async function addFavorite(uid: string, fav: Favorite) {
  await addDoc(collection(db, "users", uid, "favorites"), fav);
}

export async function getFavorites(uid: string): Promise<Favorite[]> {
  const snap = await getDocs(collection(db, "users", uid, "favorites"));
  const res: Favorite[] = [];
  snap.forEach((d) => res.push({ id: d.id, ...(d.data() as any) }));
  return res;
}

export async function removeFavorite(uid: string, id: string) {
  await deleteDoc(doc(db, "users", uid, "favorites", id));
}