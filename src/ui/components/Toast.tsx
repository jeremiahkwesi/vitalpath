// src/ui/components/Toast.tsx
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";

type ToastKind = "success" | "error" | "info";
type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  duration?: number; // ms
};

type ToastContextType = {
  show: (kind: ToastKind, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string, duration = 2200) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setQueue((q) => [...q, { id, kind, message, duration }]);
      // Auto dismiss
      setTimeout(() => remove(id), duration + 150);
    },
    [remove]
  );

  const api = useMemo<ToastContextType>(
    () => ({
      show,
      success: (m, d) => show("success", m, d),
      error: (m, d) => show("error", m, d),
      info: (m, d) => show("info", m, d),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      <View style={{ flex: 1 }}>
        {children}
        <View pointerEvents="box-none" style={styles.overlay}>
          {queue.map((t) => (
            <ToastBubble key={t.id} item={t} onClose={() => remove(t.id)} />
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { theme } = useTheme();
  const { kind, message } = item;

  const bg =
    kind === "success"
      ? "#2ECC71"
      : kind === "error"
      ? "#FF3B30"
      : theme.colors.text;

  const icon =
    kind === "success"
      ? "checkmark-circle"
      : kind === "error"
      ? "alert-circle"
      : "information-circle";

  const anim = useRef(new Animated.Value(0)).current;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const pan = useRef(new Animated.Value(0)).current;
  const panResponder =
    Platform.OS === "web"
      ? PanResponder.create({
          onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
          onPanResponderMove: Animated.event([null, { dx: pan }], {
            useNativeDriver: false,
          }),
          onPanResponderRelease: (_, g) => {
            if (Math.abs(g.dx) > 60) onClose();
            else Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
          },
        })
      : undefined;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: bg,
          transform: [{ translateY }, { translateX: pan }],
        },
      ]}
      {...(panResponder ? panResponder.panHandlers : {})}
    >
      <Ionicons name={icon as any} size={18} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.toastText} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 12,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastText: { color: "#fff", fontWeight: "600", flex: 1, lineHeight: 18 },
  closeBtn: { marginLeft: 6, padding: 4 },
});