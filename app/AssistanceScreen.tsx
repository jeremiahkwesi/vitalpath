import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import Banner from "../src/components/Banner";
import { Card, SectionHeader, Pill, StatTile } from "../src/ui/components/UKit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHealthAssistantResponse } from "../src/services/healthAI";
import { useActivity } from "../src/context/ActivityContext";
import { useNavigation } from "@react-navigation/native";

export default function AssistanceScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const { todayActivity } = useActivity();
  const nav = useNavigation<any>();

  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const missing = useMemo(() => {
    const p = userProfile || ({} as any);
    const out: string[] = [];
    if (!p.height) out.push("height");
    if (!p.weight) out.push("weight");
    if (!p.activityLevel) out.push("activity level");
    if (!p.fitnessGoal) out.push("fitness goal");
    return out;
  }, [userProfile]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        const raw = await AsyncStorage.getItem(`coach:${user.uid}`);
        if (raw) setMsgs(JSON.parse(raw));
      } catch {}
    })();
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        await AsyncStorage.setItem(`coach:${user.uid}`, JSON.stringify(msgs));
      } catch {}
    })();
  }, [user?.uid, msgs]);

  const buildContext = () => {
    const macros = todayActivity?.macros || { protein: 0, carbs: 0, fat: 0 };
    return {
      name: userProfile?.name || "",
      age: userProfile?.age,
      gender: userProfile?.gender,
      height: userProfile?.height,
      weight: userProfile?.weight,
      country: userProfile?.country,
      activityLevel: userProfile?.activityLevel,
      fitnessGoal: userProfile?.fitnessGoal,
      healthConditions: userProfile?.healthConditions || [],
      dailyCalories: userProfile?.dailyCalories,
      macros: userProfile?.macros,
      todayStats: {
        caloriesConsumed: todayActivity?.totalCalories || 0,
        steps: todayActivity?.steps || 0,
        waterIntake: todayActivity?.waterIntake || 0,
        workoutsCount: (todayActivity?.workouts || []).length,
        mealsCount: (todayActivity?.meals || []).length,
        macros,
      },
    };
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content) return;
    setMsgs((s) => [...s, { role: "user", content }]);
    setInput("");
    setBusy(true);
    try {
      const reply = await getHealthAssistantResponse(
        content,
        buildContext(),
        msgs
      );
      setMsgs((s) => [...s, { role: "assistant", content: reply }]);
    } catch {
      Alert.alert("Coach", "Failed to get a response. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const prompts = [
    "What should I eat next to hit my macros?",
    "Low-sodium dinner ideas",
    "Design a 3-day PPL routine",
    "Grocery list for high-protein week",
    "Pre‑workout snack ideas",
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}>
      <SectionHeader
        title="Coach"
        subtitle="Personalized guidance based on your profile and goals"
      />

      {!!missing.length && (
        <Banner
          variant="info"
          title="Complete profile"
          message={`Add ${missing.slice(0, 3).join(", ")} for better coaching.`}
          actionLabel="Go to Setup"
          onAction={() => nav.navigate("Profile", { screen: "Setup", params: {} })}
          style={{ marginTop: 8 }}
        />
      )}

      <Card>
        <SectionHeader title="Quick prompts" subtitle="Tap to ask the coach" />
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {prompts.map((p) => (
            <Pill key={p} label={p} onPress={() => send(p)} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Today" subtitle="Snapshot from your day" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatTile
            icon="flame-outline"
            value={`${todayActivity?.totalCalories || 0}`}
            label="kcal"
          />
          <StatTile
            icon="walk-outline"
            value={`${todayActivity?.steps || 0}`}
            label="steps"
          />
        </View>
      </Card>

      <Card style={{ flex: 1 }}>
        <SectionHeader title="Chat" />
        <ScrollView
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {msgs.length === 0 ? (
            <Text style={{ color: theme.colors.textMuted }}>
              Ask me about meals, macros, or training. I use your goals and profile to
              tailor suggestions.
            </Text>
          ) : (
            msgs.map((m, i) => (
              <View
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  backgroundColor:
                    m.role === "user" ? theme.colors.primary : theme.colors.surface2,
                  borderRadius: 12,
                  padding: 10,
                  marginVertical: 4,
                  maxWidth: "88%",
                }}
              >
                <Text
                  style={{
                    color: m.role === "user" ? "#fff" : theme.colors.text,
                    fontFamily: fonts.regular,
                  }}
                >
                  {m.content}
                </Text>
              </View>
            ))
          )}
          {busy && (
            <View style={{ padding: 8, alignItems: "center" }}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput
            style={[
              styles.input,
              {
                flex: 1,
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Type your question…"
            placeholderTextColor={theme.colors.textMuted}
            editable={!busy}
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={busy}
            style={{
              borderRadius: 10,
              paddingHorizontal: 14,
              justifyContent: "center",
              backgroundColor: theme.colors.primary,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontFamily: fonts.regular },
});