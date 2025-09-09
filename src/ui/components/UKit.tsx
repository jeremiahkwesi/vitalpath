import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const Cmp: any = onPress ? TouchableOpacity : View;
  return (
    <Cmp
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      activeOpacity={0.85}
    >
      {children}
    </Cmp>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!right && <View style={{ marginLeft: 8 }}>{right}</View>}
    </View>
  );
}

export function Pill({
  label,
  icon,
  onPress,
  selected = false,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  selected?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.pill,
        {
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected
            ? theme.colors.primary + "22"
            : theme.colors.surface2,
        },
      ]}
    >
      {!!icon && (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? theme.colors.primary : theme.colors.text}
          style={{ marginRight: 6 }}
        />
      )}
      <Text
        style={[
          styles.pillText,
          { color: selected ? theme.colors.primary : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.surface2,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {!!icon && (
        <Ionicons
          name={icon}
          size={18}
          color={color || theme.colors.text}
          style={{ marginRight: 8 }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16 },
  subtitle: { fontFamily: fonts.regular, fontSize: 12 },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  pillText: { fontFamily: fonts.semiBold, fontSize: 12 },
  stat: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  statValue: { fontFamily: fonts.semiBold, fontSize: 16 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12 },
});