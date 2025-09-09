// src/ui/components/Skeleton.tsx
import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { useTheme } from "../ThemeProvider";

export default function Skeleton({
  style,
  radius = 10,
}: {
  style?: ViewStyle;
  radius?: number;
}) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: theme.colors.surface2,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
}