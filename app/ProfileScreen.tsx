// app/ProfileScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const nav = useNavigation<any>();

  const missingBasics =
    !userProfile?.name ||
    !userProfile?.height ||
    !userProfile?.weight ||
    !userProfile?.goal;

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>Profile</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
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
            <Text
              style={[
                styles.name,
                { color: theme.colors.text, marginBottom: 4 },
              ]}
            >
              {userProfile?.name || "User"}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              {user?.email || user?.uid}
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Goal: {userProfile?.goal || "maintain"} • Calories:{" "}
              {userProfile?.dailyCalories || 2000}
            </Text>
            {missingBasics && (
              <TouchableOpacity
                onPress={() => nav.navigate("Setup", { initialStep: 0 })}
                style={[
                  styles.smallBtn,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                    marginTop: 8,
                  },
                ]}
              >
                <Text
                  style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}
                >
                  Complete profile
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => nav.navigate("EditProfile")}
            style={[
              styles.btn,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
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
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
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
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12 },
  name: { fontFamily: fonts.semiBold, fontSize: 18 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  smallBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
});