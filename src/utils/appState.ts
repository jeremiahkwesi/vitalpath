// src/utils/appState.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function setFlag(uid: string, key: string, value: boolean) {
  try {
    await AsyncStorage.setItem(`${key}:${uid}`, value ? "1" : "0");
  } catch {}
}

export async function getFlag(uid: string, key: string) {
  try {
    const v = await AsyncStorage.getItem(`${key}:${uid}`);
    return !!v && v === "1";
  } catch {
    return false;
  }
}