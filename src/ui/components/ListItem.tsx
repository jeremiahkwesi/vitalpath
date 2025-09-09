import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";

type Props = {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export default function ListItem({
  title,
  subtitle,
  leftIcon,
  right,
  onPress,
  style,
}: Props) {
  const { theme } = useTheme();
  const Cmp = onPress ? TouchableOpacity : View;
  return (
    <Cmp
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {!!leftIcon && (
          <Ionicons name={leftIcon} size={20} color={theme.colors.text} />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: fonts.semiBold,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: 12,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {!!right && <View style={{ marginLeft: 8 }}>{right}</View>}
    </Cmp>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});