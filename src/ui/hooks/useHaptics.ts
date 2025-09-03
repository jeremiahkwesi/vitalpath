// src/ui/hooks/useHaptics.ts
import * as Haptics from "expo-haptics";

export function useHaptics() {
  return {
    impact: async (style: "light" | "medium" | "heavy" = "light") => {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      try {
        await Haptics.impactAsync(map[style]);
      } catch {}
    },
    success: async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    },
    error: async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    },
  };
}