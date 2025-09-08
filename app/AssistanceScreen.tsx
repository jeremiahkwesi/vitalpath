// app/AssistanceScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../src/config/firebase";
import { useTheme } from "../src/ui/ThemeProvider";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

type Message = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
};

export default function AssistanceScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const { user, userProfile } = useAuth();
  const { todayActivity, getTodayProgress } = useActivity();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text:
        `Hello ${userProfile?.name || "there"}! 👋 I’m your AI health assistant. ` +
        `Ask about meals, workouts, macros, steps, or hydration. (Not medical advice)`,
      isUser: false,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const prog = getTodayProgress();
  const convId =
    user?.uid && `${user.uid}_${new Date().toISOString().split("T")[0]}`;

  useEffect(() => {
    (async () => {
      if (!convId) return;
      try {
        const ref = doc(db, "conversations", convId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as any) : null;
        const arr: Message[] = Array.isArray(data?.messages)
          ? data.messages
              .map((m: any) => ({
                id: String(m.id || Date.now()),
                text: String(m.text || m.content || ""),
                isUser: !!(m.isUser ?? m.role === "user"),
                timestamp: Number(m.timestamp || Date.now()),
              }))
              .filter((m: Message) => m.text.trim().length > 0)
              .slice(-50)
          : [];
        if (arr.length) setMessages(arr);
      } catch (e) {
        // Silent; keep welcome message
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const persistConversation = async (msgs: Message[]) => {
    if (!convId || !user) return;
    try {
      const ref = doc(db, "conversations", convId);
      await setDoc(
        ref,
        {
          id: convId,
          userId: user.uid,
          date: new Date().toISOString().split("T")[0],
          messages: msgs.slice(-50),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch {
      // ignore offline
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      isUser: true,
      timestamp: Date.now(),
    };

    const optimistic = [...messages, userMsg];
    setMessages(optimistic);
    setInputText("");
    setSending(true);
    h.impact("light");

    try {
      const healthContext = {
        name: userProfile?.name,
        age: userProfile?.age,
        weight: userProfile?.weight,
        height: userProfile?.height,
        gender: userProfile?.gender,
        goal: userProfile?.goal,
        dailyCalories: userProfile?.dailyCalories,
        macros: userProfile?.macros,
        todayStats: {
          caloriesConsumed: prog.caloriesConsumed,
          caloriesRemaining: prog.caloriesRemaining,
          steps: todayActivity?.steps || 0,
          waterIntake: todayActivity?.waterIntake || 0,
          mealsCount: todayActivity?.meals?.length || 0,
          workoutsCount: todayActivity?.workouts?.length || 0,
          macros: {
            protein: todayActivity?.macros?.protein || 0,
            carbs: todayActivity?.macros?.carbs || 0,
            fat: todayActivity?.macros?.fat || 0,
          },
        },
        healthConditions: userProfile?.healthConditions || [],
      };

      const history = optimistic.slice(-8).map((m) => ({
        role: m.isUser ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const call = httpsCallable(functions, "healthChat");
      const resp: any = await call({
        message: text,
        profile: healthContext,
        history,
      });

      const replyText =
        resp?.data?.reply ||
        "I’m here to help with your health journey! Ask me about nutrition, workouts, or habits. 💪";

      const aiMsg: Message = {
        id: `${Date.now()}_ai`,
        text: replyText,
        isUser: false,
        timestamp: Date.now(),
      };

      const next = [...optimistic, aiMsg];
      setMessages(next);
      await persistConversation(next);
    } catch (error: any) {
      toast.error("AI is temporarily unavailable. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    if (sending) return;
    setInputText(question);
    setTimeout(handleSend, 60);
  };

  const clearConversation = () => {
    if (!userProfile?.name && messages.length <= 1) return;
    Alert.alert("New conversation", "Clear current chat?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          const base: Message = {
            id: "welcome",
            text:
              `Hello ${userProfile?.name || "there"}! 👋 I’m your AI health assistant. ` +
              `Ask me anything.`,
            isUser: false,
            timestamp: Date.now(),
          };
          setMessages([base]);
          persistConversation([base]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.appBg }}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          AI Health Assistant
        </Text>
        <TouchableOpacity
          onPress={clearConversation}
          style={styles.clearButton}
          accessibilityLabel="Clear conversation"
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.statsBar,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {prog.caloriesConsumed}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
            calories
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {todayActivity?.steps || 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
            steps
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {todayActivity?.waterIntake || 0}ml
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
            water
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {Math.round(prog.macrosProgress.protein)}%
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
            protein
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isUser
                  ? {
                      backgroundColor: theme.colors.primary,
                      alignSelf: "flex-end",
                      borderBottomRightRadius: 6,
                    }
                  : {
                      backgroundColor: theme.colors.surface,
                      alignSelf: "flex-start",
                      borderBottomLeftRadius: 6,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    },
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: message.isUser ? "#fff" : theme.colors.text,
                  },
                ]}
              >
                {message.text}
              </Text>
              <Text
                style={[
                  styles.timestamp,
                  {
                    color: message.isUser
                      ? "rgba(255,255,255,0.85)"
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))}
          {sending && (
            <View
              style={[
                styles.messageBubble,
                {
                  backgroundColor: theme.colors.surface,
                  alignSelf: "flex-start",
                  borderBottomLeftRadius: 6,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                },
                styles.thinkingBubble,
              ]}
            >
              <View style={styles.thinkingContent}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text style={[styles.messageText, { color: theme.colors.text }]}>
                  AI is thinking...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.quickButtons,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickButtonsContent}
          >
            {[
              "How am I doing today?",
              "What should I eat next?",
              "Help me reach my step goal",
              "Am I drinking enough water?",
              "Meal ideas for my goal",
              "Quick workout suggestions",
              "How to boost my energy?",
              "Am I on track with macros?",
            ].map((q) => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.quickButton,
                  {
                    backgroundColor: theme.colors.surface2,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handleQuickQuestion(q)}
                accessibilityLabel={q}
              >
                <Text
                  style={[
                    styles.quickButtonText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {q}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about nutrition, fitness, wellness..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            accessibilityLabel="Type your question"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: theme.colors.surface2 },
              sending && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={sending}
            accessibilityLabel="Send"
          >
            <Ionicons
              name={sending ? "hourglass-outline" : "send"}
              size={24}
              color={sending ? theme.colors.textMuted : theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    flex: 1,
    textAlign: "center",
  },
  clearButton: { padding: 8 },
  statsBar: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  keyboardAvoid: { flex: 1 },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16 },
  messageBubble: {
    maxWidth: "85%",
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" as any }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
          elevation: 2,
        }),
  },
  messageText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 6,
    alignSelf: "flex-end",
  },
  thinkingBubble: { minHeight: 60, justifyContent: "center" },
  thinkingContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  quickButtons: {
    paddingVertical: 12,
    borderTopWidth: 1,
    maxHeight: 80,
  },
  quickButtonsContent: { paddingHorizontal: 16 },
  quickButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
  },
  quickButtonText: { fontSize: 14, fontFamily: fonts.medium },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontFamily: fonts.regular,
    fontSize: 16,
    borderWidth: 1,
  },
  sendButton: {
    padding: 12,
    borderRadius: 24,
  },
  sendButtonDisabled: { opacity: 0.6 },
});