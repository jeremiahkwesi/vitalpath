// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Use env vars. In Expo, public vars must be prefixed with EXPO_PUBLIC_
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

// Cross‑platform auth persistence
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

// Web persistence setup
if (Platform.OS === "web") {
  setPersistence(auth, browserLocalPersistence).catch(async () => {
    await setPersistence(auth, inMemoryPersistence);
  });
}

// Optional: emulator for functions (dev only)
const USE_EMULATOR =
  __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === "1";
const EMU_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST ||
  (Platform.OS === "web" ? "localhost" : "");
const EMU_PORT =
  Number(process.env.EXPO_PUBLIC_EMULATOR_PORT || "5001") || 5001;

if (USE_EMULATOR && EMU_HOST) {
  try {
    connectFunctionsEmulator(functions, EMU_HOST, EMU_PORT);
    console.log(`Functions emulator: ${EMU_HOST}:${EMU_PORT}`);
  } catch (e) {
    console.warn("Emulator connect failed", e);
  }
} else {
  console.log("Using PRODUCTION Firebase Functions");
}