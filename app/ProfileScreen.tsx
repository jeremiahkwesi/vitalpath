import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import Banner from "../src/components/Banner";
import { Card, SectionHeader, StatTile } from "../src/ui/components/UKit";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const nav = useNavigation<any>();

  const missingBasics =
    !userProfile?.name ||
    !userProfile?.height ||
    !userProfile?.weight ||
    !userProfile?.goal;

  const { heightM, weightKg, bmi } = useMemo(() => {
    let h = Number(userProfile?.height || 0);
    let w = Number(userProfile?.weight || 0);
    if (h > 3 && h <= 300) h = Math.round((h / 100) * 100) / 100; // cm -> m
    const bmiVal = h > 0 ? Math.round((w / (h * h)) * 10) / 10 : 0;
    return { heightM: h, weightKg: w, bmi: bmiVal };
  }, [userProfile?.height, userProfile?.weight]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}>
      <SectionHeader title="Profile" />

      {missingBasics && (
        <Banner
          variant="warning"
          title="Complete profile"
          message="A few basics are missing for accurate targets."
          actionLabel="Go to Setup"
          onAction={() => nav.navigate("Setup", { initialStep: 0 })}
          style={{ marginTop: 8 }}
        />
      )}

      <Card>
        <SectionHeader title="Overview" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              borderWidth: 1,
              overflow: "hidden",
            }}
          >
            {userProfile?.avatarUrl ? (
              <Image
                source={{ uri: userProfile.avatarUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : null}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {userProfile?.name || "User"}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {user?.email || user?.uid}
            </Text>
            <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
              Goal: {userProfile?.goal || "maintain"} • Calories:{" "}
              {userProfile?.dailyCalories || 2000}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => nav.navigate("EditProfile")}
                style={[
                  styles.btn,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => nav.navigate("EditGoals")}
                style={[
                  styles.btn,
                  { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
                ]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  Edit Goals
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => nav.navigate("Settings")}
                style={[styles.btn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Stats" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile value={heightM ? `${heightM} m` : "—"} label="Height" />
          <StatTile value={weightKg ? `${weightKg} kg` : "—"} label="Weight" />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <StatTile value={bmi ? String(bmi) : "—"} label="BMI" />
          <StatTile
            value={userProfile?.activityLevel || "—"}
            label="Activity"
          />
        </View>
      </Card>

      <Card>
        <SectionHeader title="Goals & Preferences" />
        <Text style={{ color: theme.colors.text }}>
          Fitness goal: {userProfile?.fitnessGoal || "general_health"}
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
          Dietary: {(userProfile?.dietaryPreferences || []).join(", ") || "—"}
        </Text>
        {!!(userProfile?.allergies || []).length && (
          <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
            Allergies: {(userProfile?.allergies || []).join(", ")}
          </Text>
        )}
        {!!(userProfile?.healthConditions || []).length && (
          <Text style={{ color: theme.colors.textMuted, marginTop: 2 }}>
            Conditions: {(userProfile?.healthConditions || []).join(", ")}
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.semiBold, fontSize: 18 },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
});