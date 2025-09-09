import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";
import Button from "./Button";

export default function EmptyState({
  icon = "sparkles-outline",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 20 }}>
      <Ionicons name={icon} size={32} color={theme.colors.textMuted} />
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: fonts.semiBold,
          fontSize: 16,
          marginTop: 8,
        }}
      >
        {title}
      </Text>
      {!!message && (
        <Text
          style={{
            color: theme.colors.textMuted,
            textAlign: "center",
            marginTop: 6,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      )}
      {!!actionLabel && !!onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );
}