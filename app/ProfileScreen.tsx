// app/ProfileScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { fonts } from "../src/constants/fonts";
import Card from "../src/ui/components/Card";
import { useTheme } from "../src/ui/ThemeProvider";
import { useNavigation } from "@react-navigation/native";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const { user, userProfile } = useAuth();
  const { todayActivity } = useActivity();

  const initials = (userProfile?.name || "User")
    .split(" ")
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  const macro = userProfile?.macros || { protein: 0, carbs: 0, fat: 0 };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text }]}>
            {initials || "U"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {userProfile?.name || "Your Name"}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            {user?.email || "No email"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => nav.navigate("Settings")}>
          <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Goals */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Daily Targets
        </Text>
        <View style={styles.rowBetween}>
          <Metric
            icon="flame"
            label="Calories"
            value={`${Math.round(userProfile?.dailyCalories || 0)} kcal`}
            color={theme.colors.primary}
          />
          <Metric
            icon="barbell-outline"
            label="Protein"
            value={`${Math.round(macro.protein)} g`}
            color="#FF6B6B"
          />
          <Metric
            icon="leaf-outline"
            label="Carbs"
            value={`${Math.round(macro.carbs)} g`}
            color="#4ECDC4"
          />
          <Metric
            icon="water-outline"
            label="Fat"
            value={`${Math.round(macro.fat)} g`}
            color="#45B7D1"
          />
        </View>
      </Card>

      {/* Today summary */}
      <Card style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Today
        </Text>
        <View style={styles.rowBetween}>
          <SmallStat
            icon="restaurant-outline"
            label="Meals"
            value={`${todayActivity?.meals?.length || 0}`}
            color={theme.colors.text}
          />
          <SmallStat
            icon="walk-outline"
            label="Steps"
            value={`${todayActivity?.steps || 0}`}
            color={theme.colors.text}
          />
          <SmallStat
            icon="water-outline"
            label="Water"
            value={`${todayActivity?.waterIntake || 0} ml`}
            color={theme.colors.text}
          />
          <SmallStat
            icon="moon-outline"
            label="Sleep"
            value={`${todayActivity?.sleepHours || 0} h`}
            color={theme.colors.text}
          />
        </View>
      </Card>

      {/* Actions */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Actions
        </Text>
        <TouchableOpacity
          style={[
            styles.actionRow,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
          onPress={() => nav.navigate("Settings")}
        >
          <Ionicons name="settings-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>
            Open Settings
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionRow,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
          onPress={() => nav.navigate("Settings")}
        >
          <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>
            Edit profile & goals
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

function Metric({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.metricLabel]}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SmallStat({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.smallValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontFamily: fonts.bold },
  name: { fontSize: 20, fontFamily: fonts.semiBold },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 12 },
  rowBetween: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  metricLabel: { fontSize: 12, fontFamily: fonts.regular, color: "#8E8E93", marginTop: 4 },
  metricValue: { fontSize: 14, fontFamily: fonts.semiBold, marginTop: 2 },
  smallLabel: { fontSize: 11, fontFamily: fonts.regular, color: "#8E8E93", marginTop: 4 },
  smallValue: { fontSize: 13, fontFamily: fonts.semiBold, marginTop: 2 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  actionText: { flex: 1, fontFamily: fonts.semiBold },
});