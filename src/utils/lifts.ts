// src/utils/lifts.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LiftSample = {
  date: string; // YYYY-MM-DD
  volume: number; // sum(weight * reps)
  est1RM?: number;
  topSet?: { weight?: number; reps?: number };
};

export type LiftStats = {
  name: string;
  pbWeight?: number;
  pb1RM?: number;
  bestVolume?: number;
  samples: LiftSample[]; // sorted by date asc
};

function parseReps(r?: string): number | null {
  if (!r) return null;
  const m = String(r).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function epley1RM(weight?: number, reps?: number | null): number | null {
  if (!weight || !reps || reps <= 1) return weight || null;
  return Math.round(weight * (1 + reps / 30));
}

type SessionSet = { reps?: string; weight?: number; completedAt?: number };
type SessionItem = { exercise: string; sets: SessionSet[] };
type Session = {
  date: string; // derived from activity key
  items: SessionItem[];
};

export async function loadAllLiftStats(
  uid: string,
  maxDays = 180
): Promise<Map<string, LiftStats>> {
  const out = new Map<string, LiftStats>();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys
      .filter((k) => k.startsWith(`activity:${uid}:`))
      .slice(-maxDays * 2); // rough cap
    const kv = await AsyncStorage.multiGet(mine);

    const sessions: Session[] = [];
    for (const [k, v] of kv) {
      if (!v) continue;
      try {
        const x = JSON.parse(v);
        const date = x?.date || (k.split(":")[2] || "").slice(0, 10);
        const items = Array.isArray(x?.workouts)
          ? (x.workouts || [])
              .map((w: any) => w?.details?.items || [])
              .flat()
          : [];
        if (items.length) sessions.push({ date, items });
      } catch {}
    }

    sessions.sort((a, b) => (a.date < b.date ? -1 : 1));

    for (const s of sessions) {
      for (const it of s.items || []) {
        const name = String(it.exercise || "").trim();
        if (!name) continue;
        const stats =
          out.get(name) ||
          ({
            name,
            samples: [],
          } as LiftStats);

        let dayVolume = 0;
        let dayTop1RM: number | null = null;
        let dayTopSet: { weight?: number; reps?: number } | undefined;

        for (const st of it.sets || []) {
          const reps = parseReps(st.reps);
          const wt = typeof st.weight === "number" ? st.weight : undefined;
          if (wt != null && reps != null) {
            dayVolume += wt * reps;
            const est = epley1RM(wt, reps);
            if (est != null && (dayTop1RM == null || est > dayTop1RM)) {
              dayTop1RM = est;
              dayTopSet = { weight: wt, reps };
            }
            // PBs
            if (stats.pbWeight == null || wt > stats.pbWeight) {
              stats.pbWeight = wt;
            }
            if (est != null && (stats.pb1RM == null || est > stats.pb1RM)) {
              stats.pb1RM = est;
            }
          }
        }

        if (dayVolume > 0) {
          stats.samples.push({
            date: s.date,
            volume: Math.round(dayVolume),
            est1RM: dayTop1RM || undefined,
            topSet: dayTopSet,
          });
          if (stats.bestVolume == null || dayVolume > stats.bestVolume) {
            stats.bestVolume = Math.round(dayVolume);
          }
        }

        out.set(name, stats);
      }
    }

    // Sort samples by date asc and trim to last ~50
    for (const [k, v] of out) {
      v.samples.sort((a, b) => (a.date < b.date ? -1 : 1));
      if (v.samples.length > 50) v.samples = v.samples.slice(-50);
    }
  } catch {}

  return out;
}