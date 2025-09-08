// src/utils/userSettings.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Units = {
  weight: "kg" | "lb";
  distance?: "km" | "mi";
};

export type Integrations = {
  fitnessSync: boolean; // pedometer/fitness
  healthSync: boolean; // Apple Health / Google Fit stub
  analytics: boolean;
  crashReports: boolean;
};

export type DailyGoals = {
  stepsGoal: number; // steps per day
  waterGoalMl: number; // ml per day
};

const unitsKey = (uid?: string | null) =>
  `settings:units:${uid && uid.length ? uid : "anon"}`;
const integrationsKey = (uid?: string | null) =>
  `settings:integrations:${uid && uid.length ? uid : "anon"}`;
const goalsKey = (uid?: string | null) =>
  `settings:goals:${uid && uid.length ? uid : "anon"}`;

export async function getUnits(uid?: string | null): Promise<Units> {
  try {
    // Back-compat for legacy key "units:*"
    const legacy = await AsyncStorage.getItem(
      `units:${uid && uid.length ? uid : "anon"}`
    );
    const raw = (await AsyncStorage.getItem(unitsKey(uid))) || legacy;
    if (!raw) return { weight: "kg", distance: "km" };
    const parsed = JSON.parse(raw) as Units;
    return {
      weight: parsed.weight || "kg",
      distance: parsed.distance || "km",
    };
  } catch {
    return { weight: "kg", distance: "km" };
  }
}

export async function setUnits(u: Units, uid?: string | null) {
  try {
    await AsyncStorage.setItem(unitsKey(uid), JSON.stringify(u));
  } catch {}
}

export async function getIntegrations(
  uid?: string | null
): Promise<Integrations> {
  try {
    const raw = await AsyncStorage.getItem(integrationsKey(uid));
    if (!raw)
      return {
        fitnessSync: true,
        healthSync: false,
        analytics: false,
        crashReports: false,
      };
    const parsed = JSON.parse(raw) as Integrations;
    return {
      fitnessSync:
        typeof parsed.fitnessSync === "boolean" ? parsed.fitnessSync : true,
      healthSync:
        typeof parsed.healthSync === "boolean" ? parsed.healthSync : false,
      analytics:
        typeof parsed.analytics === "boolean" ? parsed.analytics : false,
      crashReports:
        typeof parsed.crashReports === "boolean" ? parsed.crashReports : false,
    };
  } catch {
    return {
      fitnessSync: true,
      healthSync: false,
      analytics: false,
      crashReports: false,
    };
  }
}

export async function setIntegrations(
  v: Integrations,
  uid?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(integrationsKey(uid), JSON.stringify(v));
  } catch {}
}

export async function getGoals(uid?: string | null): Promise<DailyGoals> {
  try {
    const raw = await AsyncStorage.getItem(goalsKey(uid));
    if (!raw) return { stepsGoal: 8000, waterGoalMl: 2000 };
    const parsed = JSON.parse(raw) as DailyGoals;
    return {
      stepsGoal: Math.max(0, Math.round(parsed.stepsGoal || 8000)),
      waterGoalMl: Math.max(0, Math.round(parsed.waterGoalMl || 2000)),
    };
  } catch {
    return { stepsGoal: 8000, waterGoalMl: 2000 };
  }
}

export async function setGoals(
  v: DailyGoals,
  uid?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(goalsKey(uid), JSON.stringify(v));
  } catch {}
}