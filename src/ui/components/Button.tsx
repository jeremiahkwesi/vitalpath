import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: Props) {
  const { theme } = useTheme();
  const colors = theme.colors;

  const base: ViewStyle = {
    borderRadius: theme.radii.md,
    paddingVertical: size === "lg" ? 14 : size === "sm" ? 8 : 12,
    paddingHorizontal: size === "lg" ? 18 : size === "sm" ? 12 : 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  };

  let bg = colors.primary;
  let border = colors.primary;
  let fg = "#fff";

  if (variant === "secondary") {
    bg = colors.surface2;
    border = colors.border;
    fg = colors.text;
  } else if (variant === "outline") {
    bg = "transparent";
    border = colors.border;
    fg = colors.text;
  } else if (variant === "ghost") {
    bg = "transparent";
    border = "transparent";
    fg = colors.text;
  }

  const opacity = disabled || loading ? 0.6 : 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
      style={[
        base,
        { backgroundColor: bg, borderColor: border, borderWidth: 1, opacity },
        style,
      ]}
    >
      {!!leftIcon && <Ionicons name={leftIcon} size={18} color={fg} />}
      <Text
        style={[styles.text, { color: fg, fontFamily: fonts.semiBold }, textStyle]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!!rightIcon && <Ionicons name={rightIcon} size={18} color={fg} />}
      {loading && (
        <View style={{ marginLeft: 8 }}>
          <ActivityIndicator color={fg} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14 },
});