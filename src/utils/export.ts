import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export async function exportUserDataCsv(uid: string): Promise<string> {
  if (!uid) return "No user";
  // export last 30 days
  const today = new Date();
  const rows: string[] = ["date,steps,water,calories,protein,carbs,fat,meals,workouts"];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const id = `${uid}_${ds}`;
    try {
      const ref = doc(db, "activities", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const a = snap.data() as any;
        rows.push(
          [
            ds,
            a.steps || 0,
            a.waterIntake || 0,
            a.totalCalories || 0,
            a.macros?.protein || 0,
            a.macros?.carbs || 0,
            a.macros?.fat || 0,
            (a.meals || []).length,
            (a.workouts || []).length,
          ].join(",")
        );
      } else {
        rows.push([ds, 0, 0, 0, 0, 0, 0, 0, 0].join(","));
      }
    } catch {
      rows.push([ds, 0, 0, 0, 0, 0, 0, 0, 0].join(","));
    }
  }
  return rows.join("\n");
}