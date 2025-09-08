// app/AuthScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function mapAuthError(e: any): string {
  const code = e?.code || e?.message || "";
  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/user-not-found"))
    return "No account found with this email.";
  if (code.includes("auth/wrong-password")) return "Incorrect password.";
  if (code.includes("auth/too-many-requests"))
    return "Too many attempts. Try again later.";
  if (code.includes("auth/email-already-in-use"))
    return "Email already in use.";
  if (code.includes("auth/weak-password")) return "Password is too weak.";
  return "Authentication failed. Please try again.";
}

export default function AuthScreen() {
  const { theme } = useTheme();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const canSubmit = useMemo(() => {
    if (!isValidEmail(email)) return false;
    if (mode === "signin") return !!pwd;
    return pwd.length >= 6 && pwd === pwd2;
  }, [email, mode, pwd, pwd2]);

  const onSubmit = async () => {
    const e = email.trim();
    if (!isValidEmail(e)) {
      Alert.alert("Email", "Please enter a valid email address.");
      return;
    }
    if (mode === "signup") {
      if (pwd.length < 6) {
        Alert.alert("Password", "Use at least 6 characters.");
        return;
      }
      if (pwd !== pwd2) {
        Alert.alert("Password", "Passwords do not match.");
        return;
      }
    } else {
      if (!pwd) {
        Alert.alert("Password", "Please enter your password.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(e, pwd);
      } else {
        await signUp(e, pwd);
        Alert.alert("Welcome", "Account created. You are signed in.");
      }
    } catch (err: any) {
      Alert.alert("Authentication", mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    const e = email.trim();
    if (!isValidEmail(e)) {
      Alert.alert("Email", "Enter your email to reset your password.");
      return;
    }
    try {
      await resetPassword(e);
      Alert.alert("Password reset", "We sent a reset link to your email.");
    } catch (err: any) {
      Alert.alert("Reset", mapAuthError(err));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: 32,
          paddingBottom: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          VitalPath
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginBottom: 12 }}>
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>
            Password
          </Text>
          <View style={{ position: "relative" }}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  paddingRight: 44,
                },
              ]}
              secureTextEntry={!showPwd}
              value={pwd}
              onChangeText={setPwd}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              autoComplete={mode === "signin" ? "password" : "new-password"}
              textContentType={mode === "signin" ? "password" : "newPassword"}
            />
            <TouchableOpacity
              onPress={() => setShowPwd((s) => !s)}
              style={styles.eye}
              accessibilityLabel={showPwd ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPwd ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {mode === "signup" && (
            <>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Confirm password
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface2,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                      paddingRight: 44,
                    },
                  ]}
                  secureTextEntry={!showPwd2}
                  value={pwd2}
                  onChangeText={setPwd2}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textMuted}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowPwd2((s) => !s)}
                  style={styles.eye}
                  accessibilityLabel={showPwd2 ? "Hide password" : "Show password"}
                >
                  <Ionicons
                    name={showPwd2 ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity
            onPress={onSubmit}
            disabled={busy || !canSubmit}
            style={[
              styles.btn,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
                marginTop: 10,
                opacity: busy || !canSubmit ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </Text>
          </TouchableOpacity>

          {mode === "signin" && (
            <TouchableOpacity
              onPress={onForgot}
              style={{ marginTop: 10, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: fonts.semiBold,
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
          <Text style={{ color: theme.colors.textMuted }}>
            {mode === "signin"
              ? "Don't have an account?"
              : "Already have an account?"}
          </Text>
          <TouchableOpacity
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: fonts.semiBold,
              }}
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, marginBottom: 4 },
  card: { borderRadius: 12, borderWidth: 1, padding: 12 },
  label: { fontFamily: fonts.semiBold, marginTop: 6, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontFamily: fonts.regular,
  },
  btn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  eye: {
    position: "absolute",
    right: 10,
    top: 10,
    padding: 6,
  },
});