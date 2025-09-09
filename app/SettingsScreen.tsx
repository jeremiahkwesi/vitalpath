import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  Switch,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fonts } from "../src/constants/fonts";
import { useTheme } from "../src/ui/ThemeProvider";
import { useAuth } from "../src/context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../src/config/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  scheduleMealRemindersAt,
  scheduleWaterRemindersAt,
  cancelAllReminders,
  configureForegroundNotifications,
} from "../src/utils/notifications";
import Select from "../src/ui/components/Select";
import {
  getUnits,
  setUnits,
  Units,
  getIntegrations,
  setIntegrations,
  Integrations,
  getGoals,
  setGoals,
  DailyGoals,
} from "../src/utils/userSettings";
import {
  exportAll,
  importFromJson,
  clearLocalCache,
} from "../src/utils/export";
import { useNavigation } from "@react-navigation/native";
import { Card, SectionHeader } from "../src/ui/components/UKit";

export default function SettingsScreen() {
  const { theme, setScheme, scheme } = useTheme();
  const {
    user,
    logout,
    userProfile,
    updateUserProfile,
    sendVerificationEmail,
    resetPassword,
  } = useAuth();
  const nav = useNavigation<any>();

  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);

  // Units
  const [units, setUnitsState] = useState<Units>({
    weight: "kg",
    distance: "km",
  });

  // Goals & Macros quick edit (mirror)
  const [calories, setCalories] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [fat, setFat] = useState<string>("");

  // Daily Goals
  const [dGoals, setDGoals] = useState<DailyGoals>({
    stepsGoal: 8000,
    waterGoalMl: 2000,
  });

  // Integrations / privacy
  const [integrations, setIntegrationsState] = useState<Integrations>({
    fitnessSync: true,
    healthSync: false,
    analytics: false,
    crashReports: false,
  });

  // Reminders
  const [mealsEnabled, setMealsEnabled] = useState(false);
  const [waterEnabled, setWaterEnabled] = useState(false);
  const [bTime, setBTime] = useState<Date>(new Date(2025, 0, 1, 8, 0));
  const [lTime, setLTime] = useState<Date>(new Date(2025, 0, 1, 13, 0));
  const [dTime, setDTime] = useState<Date>(new Date(2025, 0, 1, 19, 0));
  const [waterTimes, setWaterTimes] = useState<Date[]>([
    new Date(2025, 0, 1, 9, 0),
    new Date(2025, 0, 1, 12, 0),
    new Date(2025, 0, 1, 15, 0),
    new Date(2025, 0, 1, 18, 0),
  ]);

  // Modals for time picking
  const [showMealsModal, setShowMealsModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);

  // Import JSON text
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    configureForegroundNotifications();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      try {
        // Units
        const u = await getUnits(user.uid);
        setUnitsState(u);

        // Goals/macros quick mirror
        if (userProfile) {
          setCalories(String(userProfile.dailyCalories || 2000));
          setProtein(String(userProfile.macros?.protein || 150));
          setCarbs(String(userProfile.macros?.carbs || 225));
          setFat(String(userProfile.macros?.fat || 67));
        }

        // Daily Goals
        const g = await getGoals(user.uid);
        setDGoals(g);

        // Integrations
        const ints = await getIntegrations(user.uid);
        setIntegrationsState(ints);

        // Reminders
        const raw = await AsyncStorage.getItem(`reminders:${user.uid}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.breakfast) setBTime(new Date(saved.breakfast));
          if (saved.lunch) setLTime(new Date(saved.lunch));
          if (saved.dinner) setDTime(new Date(saved.dinner));
          if (Array.isArray(saved.water)) {
            setWaterTimes(saved.water.map((t: string) => new Date(t)));
          }
          setMealsEnabled(!!saved.mealsEnabled);
          setWaterEnabled(!!saved.waterEnabled);
        }
      } catch {
        // no-op
      }
    })();
  }, [user?.uid, userProfile]);

  const saveReminderTimes = async () => {
    if (!user?.uid) return;
    const payload = {
      mealsEnabled,
      waterEnabled,
      breakfast: bTime.toISOString(),
      lunch: lTime.toISOString(),
      dinner: dTime.toISOString(),
      water: waterTimes.map((d) => d.toISOString()),
    };
    await AsyncStorage.setItem(`reminders:${user.uid}`, JSON.stringify(payload));
  };

  const applyReminders = async () => {
    setScheduleBusy(true);
    try {
      await cancelAllReminders();
      if (mealsEnabled) {
        await scheduleMealRemindersAt([
          { hour: bTime.getHours(), minute: bTime.getMinutes(), label: "Breakfast" },
          { hour: lTime.getHours(), minute: lTime.getMinutes(), label: "Lunch" },
          { hour: dTime.getHours(), minute: dTime.getMinutes(), label: "Dinner" },
        ]);
      }
      if (waterEnabled) {
        await scheduleWaterRemindersAt(
          waterTimes.map((t) => ({ hour: t.getHours(), minute: t.getMinutes() }))
        );
      }
      await saveReminderTimes();
      Alert.alert("Reminders", "Saved and scheduled.");
    } catch {
      Alert.alert("Reminders", "Failed to schedule reminders.");
    } finally {
      setScheduleBusy(false);
    }
  };

  const onUnitsChange = async (val: "kg" | "lb") => {
    const next = { ...units, weight: val };
    setUnitsState(next);
    await setUnits(next, user?.uid);
  };

  const saveGoals = async () => {
    const c = Math.max(0, Math.round(Number(calories) || 0));
    const p = Math.max(0, Math.round(Number(protein) || 0));
    const cb = Math.max(0, Math.round(Number(carbs) || 0));
    const f = Math.max(0, Math.round(Number(fat) || 0));
    try {
      await updateUserProfile({ dailyCalories: c, macros: { protein: p, carbs: cb, fat: f } });
      Alert.alert("Saved", "Goals & macros updated.");
    } catch {
      Alert.alert("Error", "Failed to save goals. Try again.");
    }
  };

  const toggleIntegration = async (key: keyof Integrations, val: boolean) => {
    const next = { ...integrations, [key]: val };
    setIntegrationsState(next);
    await setIntegrations(next, user?.uid);
  };

  const doDeleteAccount = async () => {
    if (!user?.email) {
      Alert.alert("Error", "No authenticated user.");
      return;
    }
    if (!pwd) {
      Alert.alert("Password required", "Please enter your password.");
      return;
    }
    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, pwd);
      await reauthenticateWithCredential(user, cred);
      const purge = httpsCallable(functions, "deleteUserData");
      await purge({});
      await deleteUser(user);
      Alert.alert("Account deleted", "Your account has been removed.");
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSendVerification = async () => {
    try {
      await sendVerificationEmail();
      Alert.alert("Email", "Verification email sent.");
    } catch (e: any) {
      Alert.alert("Email", e?.message || "Failed to send verification email.");
    }
  };

  const onResetPassword = async () => {
    if (!user?.email) return Alert.alert("Reset", "No email on account.");
    try {
      await resetPassword(user.email);
      Alert.alert("Reset", "Password reset link sent to your email.");
    } catch (e: any) {
      Alert.alert("Reset", e?.message || "Failed to send reset email.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader title="Settings" subtitle="Account, preferences, and data" />

      <Card>
        <SectionHeader title="Profile & Goals" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity
            onPress={() => nav.navigate("EditProfile")}
            style={[styles.btn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => nav.navigate("EditGoals")}
            style={[styles.btn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>Edit Goals</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionSmall, { color: theme.colors.text, marginTop: 10 }]}>
          Goals & Macros (quick edit)
        </Text>

        <Text style={[styles.label, { color: theme.colors.text }]}>Daily calories (kcal)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
          ]}
          keyboardType="numeric"
          value={calories}
          onChangeText={setCalories}
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Protein (g)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              keyboardType="numeric"
              value={protein}
              onChangeText={setProtein}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Carbs (g)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              keyboardType="numeric"
              value={carbs}
              onChangeText={setCarbs}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Fat (g)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              keyboardType="numeric"
              value={fat}
              onChangeText={setFat}
            />
          </View>
        </View>

        <TouchableOpacity onPress={saveGoals} style={[styles.apply, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Save Goals</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionHeader title="Appearance" />
        <Select
          label="Theme"
          value={scheme}
          items={[
            { label: "System", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          onChange={(v) => setScheme(v as any)}
        />
      </Card>

      <Card>
        <SectionHeader title="Units" />
        <Select
          label="Weight unit"
          value={units.weight}
          items={[
            { label: "Kilograms (kg)", value: "kg" },
            { label: "Pounds (lb)", value: "lb" },
          ]}
          onChange={(v) => onUnitsChange(v as "kg" | "lb")}
        />
      </Card>

      <Card>
        <SectionHeader title="Daily Goals" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Steps goal</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              keyboardType="numeric"
              value={String(dGoals.stepsGoal)}
              onChangeText={(t) =>
                setDGoals((s) => ({ ...s, stepsGoal: Math.max(0, parseInt(t || "0", 10)) }))
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Water goal (ml)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              keyboardType="numeric"
              value={String(dGoals.waterGoalMl)}
              onChangeText={(t) =>
                setDGoals((s) => ({ ...s, waterGoalMl: Math.max(0, parseInt(t || "0", 10)) }))
              }
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await setGoals(dGoals, user?.uid);
            Alert.alert("Saved", "Daily goals updated.");
          }}
          style={[styles.apply, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Save Daily Goals</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionHeader title="Reminders" />
        <View style={styles.switchRow}>
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Meal reminders</Text>
          <Switch value={mealsEnabled} onValueChange={setMealsEnabled} />
        </View>
        <TouchableOpacity
          disabled={!mealsEnabled}
          onPress={() => setShowMealsModal(true)}
          style={[
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              opacity: mealsEnabled ? 1 : 0.6,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.colors.text }]}>Set meal times</Text>
        </TouchableOpacity>

        <View style={[styles.switchRow, { marginTop: 10 }]}>
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Water reminders</Text>
          <Switch value={waterEnabled} onValueChange={setWaterEnabled} />
        </View>
        <TouchableOpacity
          disabled={!waterEnabled}
          onPress={() => setShowWaterModal(true)}
          style={[
            styles.btn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              opacity: waterEnabled ? 1 : 0.6,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: theme.colors.text }]}>Set water times</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={applyReminders}
          style={[
            styles.apply,
            { backgroundColor: theme.colors.primary, opacity: scheduleBusy ? 0.7 : 1 },
          ]}
          disabled={!user?.uid || scheduleBusy}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>
            {scheduleBusy ? "Scheduling…" : "Save & Schedule"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            await cancelAllReminders();
            Alert.alert("Reminders", "Canceled all reminders.");
          }}
          style={[
            styles.apply,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Cancel All</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionHeader title="Integrations & Privacy" />
        <ToggleRow
          label="Fitness sync (steps)"
          value={integrations.fitnessSync}
          onChange={(v) => toggleIntegration("fitnessSync", v)}
        />
        <ToggleRow
          label="Health sync (iOS Health / Google Fit)"
          value={integrations.healthSync}
          onChange={(v) => toggleIntegration("healthSync", v)}
        />
        <ToggleRow
          label="Analytics"
          value={integrations.analytics}
          onChange={(v) => toggleIntegration("analytics", v)}
        />
        <ToggleRow
          label="Crash reports"
          value={integrations.crashReports}
          onChange={(v) => toggleIntegration("crashReports", v)}
        />
      </Card>

      <Card>
        <SectionHeader title="Data" />
        <TouchableOpacity
          onPress={async () => {
            if (!user?.uid) return Alert.alert("Sign in required");
            try {
              await exportAll(user.uid);
            } catch {
              Alert.alert("Export", "Failed to export data.");
            }
          }}
          style={[styles.apply, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Export data</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowImport((s) => !s)}
          style={[
            styles.apply,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
            {showImport ? "Hide import" : "Import from pasted JSON"}
          </Text>
        </TouchableOpacity>
        {showImport && (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  height: 140,
                  textAlignVertical: "top",
                  backgroundColor: theme.colors.surface2,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              multiline
              placeholder="Paste export JSON here"
              placeholderTextColor={theme.colors.textMuted}
              value={importText}
              onChangeText={setImportText}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!user?.uid) return Alert.alert("Sign in required");
                if (!importText.trim()) return Alert.alert("Import", "Paste a valid JSON first.");
                try {
                  const res = await importFromJson(user.uid, importText.trim());
                  Alert.alert(
                    "Import complete",
                    `Activities: ${res.activities}\nCustom items: ${res.customs}\nRoutines: ${res.routines}`
                  );
                  setImportText("");
                } catch (e: any) {
                  Alert.alert("Import failed", e?.message || "Invalid JSON.");
                }
              }}
              style={[styles.apply, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Import JSON</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={async () => {
            await clearLocalCache(user?.uid || null);
            Alert.alert("Cache cleared", "Local caches removed.");
          }}
          style={[
            styles.apply,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Clear local cache</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionHeader title="Security" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity
            onPress={onSendVerification}
            style={[styles.btn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>Send verification email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onResetPassword}
            style={[styles.btn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.btnText, { color: theme.colors.text }]}>Reset password</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: theme.colors.text, marginTop: 10 }]}>Password (for delete)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border, color: theme.colors.text },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={pwd}
          onChangeText={setPwd}
        />
        <TouchableOpacity
          disabled={busy}
          onPress={() =>
            Alert.alert("Delete Account", "This will permanently remove your data. Continue?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: doDeleteAccount },
            ])
          }
          style={[styles.dangerBtn, { backgroundColor: theme.colors.danger, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={styles.dangerText}>{busy ? "Deleting..." : "Delete my account"}</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionHeader title="Session" />
        <TouchableOpacity
          onPress={logout}
          style={[styles.btn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.btnText, { color: theme.colors.text }]}>Sign out</Text>
        </TouchableOpacity>
      </Card>

      {/* Meals modal */}
      <MealsTimesModal
        visible={showMealsModal}
        onClose={() => setShowMealsModal(false)}
        bTime={bTime}
        lTime={lTime}
        dTime={dTime}
        onChange={(key, d) => {
          if (!d) return;
          if (key === "b") setBTime(d);
          if (key === "l") setLTime(d);
          if (key === "d") setDTime(d);
        }}
      />

      {/* Water modal */}
      <WaterTimesModal
        visible={showWaterModal}
        onClose={() => setShowWaterModal(false)}
        times={waterTimes}
        onAdd={() => setWaterTimes((s) => (s.length < 8 ? [...s, new Date(2025, 0, 1, 21, 0)] : s))}
        onRemove={(idx) => setWaterTimes((s) => s.filter((_, i) => i !== idx))}
        onChange={(idx, d) => {
          if (!d) return;
          setWaterTimes((s) => {
            const copy = [...s];
            copy[idx] = d;
            return copy;
          });
        }}
      />
    </ScrollView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function MealsTimesModal({
  visible,
  onClose,
  bTime,
  lTime,
  dTime,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  bTime: Date;
  lTime: Date;
  dTime: Date;
  onChange: (key: "b" | "l" | "d", d?: Date) => void;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalBody,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          ]}
        >
          <SectionHeader title="Meal times" />
          <LabeledTime label="Breakfast" value={bTime} onChange={(d) => onChange("b", d)} />
          <LabeledTime label="Lunch" value={lTime} onChange={(d) => onChange("l", d)} />
          <LabeledTime label="Dinner" value={dTime} onChange={(d) => onChange("d", d)} />
          <TouchableOpacity onPress={onClose} style={[styles.apply, { backgroundColor: theme.colors.primary, marginTop: 8 }]}>
            <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function WaterTimesModal({
  visible,
  onClose,
  times,
  onAdd,
  onRemove,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  times: Date[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, d?: Date) => void;
}) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalBody,
            { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          ]}
        >
          <SectionHeader title="Water times" />
          {times.map((t, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <LabeledTime label={`Reminder #${i + 1}`} value={t} onChange={(d) => onChange(i, d)} />
              </View>
              <TouchableOpacity
                onPress={() => onRemove(i)}
                style={[styles.smallBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
              >
                <Text style={{ color: theme.colors.text }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={onAdd}
              style={[styles.smallBtn, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}
            >
              <Text style={{ color: theme.colors.text }}>Add time</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.apply, { backgroundColor: theme.colors.primary, flex: 1 }]}>
              <Text style={{ color: "#fff", fontFamily: fonts.semiBold }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LabeledTime({ label, value, onChange }: { label: string; value: Date; onChange: (d?: Date) => void }) {
  const { theme } = useTheme();
  const [local, setLocal] = useState<Date>(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <DateTimePicker
        value={local}
        mode="time"
        is24Hour
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={(_, d) => {
          if (!d) return;
          setLocal(d);
          onChange(d);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionSmall: { fontFamily: fonts.semiBold, fontSize: 14 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, marginBottom: 6 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
  btn: { paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  btnText: { fontFamily: fonts.semiBold },
  apply: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  dangerBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  dangerText: { fontFamily: fonts.semiBold, color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  smallBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalBody: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, padding: 16, maxHeight: "85%" },
});