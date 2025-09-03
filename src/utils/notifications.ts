// src/utils/notifications.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldSetBadge: false,
    shouldPlaySound: false,
  }),
});

export async function requestNotifPerms(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === 3) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted || req.ios?.status === 3;
}

async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function nextTriggerAt(hour: number, minute: number) {
  const now = new Date();
  const when = new Date();
  when.setHours(hour, minute, 0, 0);
  if (when <= now) when.setDate(when.getDate() + 1);
  return when;
}

export async function scheduleDailyWaterReminders() {
  const ok = await requestNotifPerms();
  if (!ok) throw new Error("Notifications permission not granted");
  await ensureAndroidChannel();

  const times = [
    { hour: 10, minute: 0 },
    { hour: 15, minute: 0 },
  ];

  const ids: string[] = [];
  for (const t of times) {
    const trigger = nextTriggerAt(t.hour, t.minute);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Hydrate check 💧",
        body: "Take a 250–500 ml glass of water.",
      },
      trigger: { date: trigger, repeats: true },
    });
    ids.push(id);
  }
  return ids;
}

export async function scheduleDailyMealReminders(times: { hour: number; minute: number; label: string }[]) {
  const ok = await requestNotifPerms();
  if (!ok) throw new Error("Notifications permission not granted");
  await ensureAndroidChannel();

  const ids: string[] = [];
  for (const t of times) {
    const trigger = nextTriggerAt(t.hour, t.minute);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${t.label} reminder 🍽️`,
        body: "Log your meal and aim for a protein‑forward plate.",
      },
      trigger: { date: trigger, repeats: true },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}