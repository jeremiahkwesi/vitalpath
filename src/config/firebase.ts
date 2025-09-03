// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBfFe-Pb2Ri-8SF4Qs7gZLERY0ueKBFOVE",
  authDomain: "vitalpath2.firebaseapp.com",
  projectId: "vitalpath2",
  storageBucket: "vitalpath2.firebasestorage.app",
  messagingSenderId: "863487646204",
  appId: "1:863487646204:web:b29a64500fd663af82ba79",
  measurementId: "G-ZLWKSDY5JS",
};

// Init app
const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Auth
// - On native, use initializeAuth + AsyncStorage (persists across sessions)
// - On web, use standard getAuth + browserLocalPersistence (fallback to memory)
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

if (typeof window !== "undefined" && Platform.OS === "web") {
  import("firebase/auth").then(({ setPersistence }) => {
    setPersistence(auth, browserLocalPersistence).catch(async () => {
      const { setPersistence: setP } = await import("firebase/auth");
      await setP(auth, inMemoryPersistence);
    });
  });
}

// Storage (explicit GS URL)
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

// Functions (default region)
export const functions = getFunctions(app, "us-central1");

// Emulator wiring (dev) — safe for devices
// Only use emulator if EXPO_PUBLIC_USE_EMULATOR=1
// On native, requires EXPO_PUBLIC_EMULATOR_HOST=<your-computer-LAN-IP>
const USE_EMULATOR =
  __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === "1";
const EMU_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST || (Platform.OS === "web" ? "localhost" : "");
const EMU_PORT =
  Number(process.env.EXPO_PUBLIC_EMULATOR_PORT || "5001") || 5001;

if (USE_EMULATOR && EMU_HOST) {
  try {
    connectFunctionsEmulator(functions, EMU_HOST, EMU_PORT);
    console.log(`⚙️ Functions emulator connected (${EMU_HOST}:${EMU_PORT})`);
  } catch (e) {
    console.warn("Emulator connect failed", e);
  }
} else {
  console.log("🔗 Using PRODUCTION Firebase Functions");
}