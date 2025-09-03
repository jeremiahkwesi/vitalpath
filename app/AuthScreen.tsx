// app/AuthScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { fonts } from "../src/constants/fonts";
import { useTheme } from "../src/ui/ThemeProvider";
import Segmented from "../src/ui/components/Segmented";

export default function AuthScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errorText, setErrorText] = useState("");

  const { signIn, signUp, resetPassword, sendVerificationEmail, user } =
    useAuth();

  const handleAuth = async () => {
    setErrorText("");
    if (!email || !password) {
      setErrorText("Please enter email and password.");
      return;
    }
    setSending(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        Alert.alert(
          "Welcome!",
          "Account created. Please complete your profile to personalize your plan."
        );
      }
    } catch (error: any) {
      const msg = mapAuthError(error?.code) || error?.message || "Try again.";
      setErrorText(msg);
    } finally {
      setSending(false);
    }
  };

  const handleReset = async () => {
    setErrorText("");
    if (!email) {
      setErrorText("Enter your email first.");
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert(
        "Check your inbox",
        "Password reset link has been sent to your email."
      );
    } catch (e: any) {
      const msg = mapAuthError(e?.code) || e?.message || "Try again.";
      setErrorText(msg);
    }
  };

  const handleSendVerify = async () => {
    setErrorText("");
    try {
      await sendVerificationEmail();
      Alert.alert(
        "Verification Sent",
        "Please check your email to verify your account."
      );
    } catch (e: any) {
      const msg = mapAuthError(e?.code) || e?.message || "Try again.";
      setErrorText(msg);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
    >
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.header}>
          <View
            style={[
              styles.logoWrap,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Ionicons name="fitness" size={44} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            VitalPath
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.textMuted, textAlign: "center" },
            ]}
          >
            Your Personal Health Journey
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Segmented
            items={[
              { label: "Login", value: "login" },
              { label: "Sign Up", value: "signup" },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v as "login" | "signup");
              setErrorText("");
            }}
          />
        </View>

        <View style={{ width: "100%", marginTop: 16 }}>
          {!!errorText && (
            <Text style={[styles.errorText, { color: "#D00" }]}>{errorText}</Text>
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.pwdRow}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  marginBottom: 0,
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity
              style={[
                styles.eyeBtn,
                {
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setShowPwd((s) => !s)}
              accessibilityLabel={showPwd ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPwd ? "eye" : "eye-off"}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.primary },
              sending && styles.buttonDisabled,
            ]}
            onPress={handleAuth}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "login" ? "Login" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={handleReset}>
              <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
            {user && !user.emailVerified ? (
              <TouchableOpacity onPress={handleSendVerify}>
                <Text style={[styles.linkText, { color: theme.colors.primary }]}>
                  Send verification email
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Text
            style={[
              styles.footerText,
              { color: theme.colors.textMuted, textAlign: "center" },
            ]}
          >
            By continuing you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function mapAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/email-already-in-use":
      return "Email already in use.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled in Firebase.";
    default:
      return "";
  }
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 20 },
  header: { alignItems: "center", marginBottom: 20 },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 10,
  },
  title: { fontSize: 28, fontFamily: fonts.bold },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, marginTop: 4 },
  errorText: { fontFamily: fonts.semiBold, marginBottom: 8 },
  input: {
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    borderWidth: 1,
  },
  pwdRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  eyeBtn: {
    marginLeft: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  button: {
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: fonts.semiBold },
  linksRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  linkText: { fontFamily: fonts.semiBold, fontSize: 13 },
  footer: { marginTop: 24, alignItems: "center" },
  footerText: { fontFamily: fonts.regular, fontSize: 12 },
});