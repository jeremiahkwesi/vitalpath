// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export type GoalType =
  | "lose_weight"
  | "gain_weight"
  | "maintain"
  | "gain_muscle"
  | "lose_fat";

export type GenderType = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type BodyType = "ectomorph" | "mesomorph" | "endomorph" | "other";

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface Micros {
  vitaminA: number;
  vitaminC: number;
  vitaminD: number;
  vitaminE: number;
  vitaminK: number;
  vitaminB1: number;
  vitaminB2: number;
  vitaminB3: number;
  vitaminB6: number;
  vitaminB12: number;
  folate: number;
  calcium: number;
  iron: number;
  magnesium: number;
  potassium: number;
  sodium: number;
  zinc: number;
  phosphorus: number;
  selenium: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  age: number;
  weight: number;
  height: number;
  gender: GenderType;
  activityLevel: ActivityLevel;
  goal: GoalType;
  bodyType?: BodyType;
  targetTimelineWeeks?: number;
  country?: string;
  dietaryPreferences?: string[];
  allergies?: string[];

  healthConditions: string[];
  dailyCalories: number;
  macros: Macros;
  micros: Micros;
  bmi: number;
  createdAt: Date;
  avatarUrl?: string;
  notes?: string;
}

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let done = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          setUser(u);
          await ensureBootstrapProfile(u);
          const profile = await fetchUserProfile(u.uid);
          setUserProfile(profile);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (e) {
        console.error("Auth state error:", e);
        setUser(null);
        setUserProfile(null);
      } finally {
        if (!done) {
          setLoading(false);
          done = true;
        }
      }
    });

    const safety = setTimeout(() => {
      if (!done) {
        setLoading(false);
        done = true;
      }
    }, 4000);

    return () => {
      clearTimeout(safety);
      unsub();
    };
  }, []);

  const ensureBootstrapProfile = async (u: User) => {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const bootstrap: Partial<UserProfile> = {
        uid: u.uid,
        email: u.email || "",
        name: "",
        age: 0,
        weight: 0,
        height: 0,
        gender: "male",
        activityLevel: "moderate",
        goal: "maintain",
        bodyType: "other",
        targetTimelineWeeks: 12,
        country: "",
        dietaryPreferences: [],
        allergies: [],
        healthConditions: [],
        dailyCalories: 2000,
        macros: { protein: 150, carbs: 225, fat: 67 },
        micros: defaultMicros(25, "male", 70),
        bmi: 0,
        createdAt: new Date(),
      };
      await setDoc(ref, bootstrap, { merge: true });
    }
  };

  const fetchUserProfile = async (uid: string) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        return data;
      }
      return null;
    } catch (e) {
      console.error("Fetch profile error:", e);
      return null;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      console.error("signIn error:", e);
      throw e;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      await ensureBootstrapProfile(cred.user);
    } catch (e) {
      console.error("signUp error:", e);
      throw e;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      console.error("resetPassword error:", e);
      throw e;
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error("No authenticated user");
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (e) {
      console.error("sendVerificationEmail error:", e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("logout error:", e);
      throw e;
    }
  };

  const updateUserProfile = async (
    profileData: Partial<UserProfile>
  ): Promise<void> => {
    if (!user) throw new Error("No authenticated user");

    const current = (await fetchUserProfile(user.uid)) || ({} as UserProfile);
    const merged: Partial<UserProfile> = { ...current, ...profileData };

    merged.uid = merged.uid || user.uid;
    merged.email = merged.email || user.email || "";

    if (
      profileData.weight !== undefined ||
      profileData.height !== undefined ||
      profileData.age !== undefined ||
      profileData.goal !== undefined ||
      profileData.gender !== undefined ||
      profileData.activityLevel !== undefined ||
      profileData.bodyType !== undefined ||
      profileData.dailyCalories !== undefined ||
      profileData.macros !== undefined
    ) {
      const weight = merged.weight ?? current.weight ?? 70;
      const height = merged.height ?? current.height ?? 1.7;
      const age = merged.age ?? current.age ?? 25;
      const gender = merged.gender ?? current.gender ?? "male";
      const goal = merged.goal ?? current.goal ?? "maintain";
      const activityLevel =
        merged.activityLevel ?? current.activityLevel ?? "moderate";
      const bodyType = merged.bodyType ?? current.bodyType ?? "other";

      if (profileData.dailyCalories == null || profileData.macros == null) {
        const bmi = height > 0 ? weight / (height * height) : 0;
        const { calories, macros } = calculateCaloriesAndMacros(
          weight,
          height,
          age,
          gender,
          goal,
          activityLevel,
          bodyType
        );
        const micros = defaultMicros(age, gender, weight);

        merged.bmi = bmi;
        merged.dailyCalories = profileData.dailyCalories ?? calories;
        merged.macros = profileData.macros ?? macros;
        merged.micros = micros;
      } else {
        merged.bmi = height > 0 ? weight / (height * height) : 0;
        merged.micros = defaultMicros(age, gender, weight);
      }
    }

    merged.createdAt =
      merged.createdAt || current.createdAt || (new Date() as Date);

    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, merged, { merge: true });
      setUserProfile(merged as UserProfile);
    } catch (e) {
      console.error("updateUserProfile error:", e);
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        resetPassword,
        sendVerificationEmail,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Calculations
const activityFactorMap: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function adjustByBodyType(
  baseCalories: number,
  goal: GoalType,
  bodyType: BodyType
): number {
  if (bodyType === "ectomorph" && (goal === "gain_weight" || goal === "gain_muscle")) {
    return Math.round(baseCalories * 1.07);
  }
  if (bodyType === "endomorph" && (goal === "lose_weight" || goal === "lose_fat")) {
    return Math.round(baseCalories * 0.93);
  }
  return Math.round(baseCalories);
}

const calculateCaloriesAndMacros = (
  weight: number,
  height: number,
  age: number,
  gender: GenderType,
  goal: GoalType,
  activityLevel: ActivityLevel,
  bodyType: BodyType
): { calories: number; macros: Macros } => {
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * (height * 100) - 5 * age + 5
      : 10 * weight + 6.25 * (height * 100) - 5 * age - 161;

  const activityFactor =
    activityFactorMap[activityLevel] ?? activityFactorMap.moderate;

  let calories = bmr * activityFactor;

  switch (goal) {
    case "lose_weight":
    case "lose_fat":
      calories *= 0.8;
      break;
    case "gain_weight":
    case "gain_muscle":
      calories *= 1.2;
      break;
    default:
      break;
  }

  calories = adjustByBodyType(calories, goal, bodyType);

  let proteinRatio = 0.25;
  let carbRatio = 0.45;
  let fatRatio = 0.3;

  if (goal === "gain_muscle" || goal === "lose_fat") {
    proteinRatio = 0.35;
    carbRatio = 0.35;
    fatRatio = 0.3;
  } else if (goal === "lose_weight") {
    proteinRatio = 0.3;
    carbRatio = 0.35;
    fatRatio = 0.35;
  }

  if (bodyType === "ectomorph") {
    carbRatio += 0.05;
    fatRatio -= 0.05;
  } else if (bodyType === "endomorph") {
    proteinRatio += 0.05;
    carbRatio -= 0.05;
  }

  const protein = (calories * proteinRatio) / 4;
  const carbs = (calories * carbRatio) / 4;
  const fat = (calories * fatRatio) / 9;

  return {
    calories: Math.round(calories),
    macros: {
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    },
  };
};

function defaultMicros(age: number, gender: GenderType, weight: number): Micros {
  return {
    vitaminA: gender === "male" ? 900 : 700,
    vitaminC: gender === "male" ? 90 : 75,
    vitaminD: age < 70 ? 15 : 20,
    vitaminE: 15,
    vitaminK: gender === "male" ? 120 : 90,
    vitaminB1: gender === "male" ? 1.2 : 1.1,
    vitaminB2: gender === "male" ? 1.3 : 1.1,
    vitaminB3: gender === "male" ? 16 : 14,
    vitaminB6: age < 50 ? 1.3 : gender === "male" ? 1.7 : 1.5,
    vitaminB12: 2.4,
    folate: 400,
    calcium: age < 50 ? 1000 : 1200,
    iron: gender === "male" ? 8 : age < 50 ? 18 : 8,
    magnesium:
      (gender === "male" ? 400 : 310) +
      (gender === "male" ? weight - 70 : weight - 55),
    potassium: 3500,
    sodium: 2300,
    zinc: gender === "male" ? 11 : 8,
    phosphorus: 700,
    selenium: 55,
  };
}