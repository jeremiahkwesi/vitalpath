// src/utils/notifications.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type MealReminder = { hour: number; minute: number; label: string };
export type TimePoint = { hour: number; minute: number };

// Show in foreground too
export function configureForegroundNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return (
    req.granted ||
    req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function dailyTrigger(
  hour: number,
  minute: number
): Notifications.NotificationTriggerInput {
  return {
    repeats: true,
    hour,
    minute,
    channelId: Platform.OS === "android" ? "default" : undefined,
  };
}

async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function cancelAllReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function scheduleMealRemindersAt(items: MealReminder[]) {
  const ok = await ensurePermission();
  if (!ok) throw new Error("Notification permission not granted");
  await ensureAndroidChannel();

  // Cancel existing to avoid duplicates
  await cancelAllReminders();

  for (const it of items) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${it.label} reminder`,
        body: `It's time for ${it.label.toLowerCase()} 🍽️`,
        sound: true,
      },
      trigger: dailyTrigger(it.hour, it.minute),
    });
  }
}

export async function scheduleWaterRemindersAt(times: TimePoint[]) {
  const ok = await ensurePermission();
  if (!ok) throw new Error("Notification permission not granted");
  await ensureAndroidChannel();

  for (const t of times) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Water reminder",
        body: "Time to drink water 💧",
        sound: true,
      },
      trigger: dailyTrigger(t.hour, t.minute),
    });
  }
}