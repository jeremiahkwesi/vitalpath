// app/HistoryScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { useActivity } from "../src/context/ActivityContext";
import { db } from "../src/config/firebase";
import { fonts } from "../src/constants/fonts";
import { useTheme } from "../src/ui/ThemeProvider";
import Segmented from "../src/ui/components/Segmented";
import Card from "../src/ui/components/Card";
import { useToast } from "../src/ui/components/Toast";
import { useHaptics } from "../src/ui/hooks/useHaptics";

type RangeKey = "7" | "14" | "30";

type DayData = {
  dateISO: string;
  calories: number;
  caloriesGoal?: number;
  steps: number;
  waterIntake: number;
  mealsCount: number;
  workoutsCount: number;
  meals?: Array<{
    name: string;
    calories: number;
    macros?: { protein: number; carbs: number; fat: number };
    type?: "breakfast" | "lunch" | "dinner" | "snack";
  }>;
};

const ROW_HEIGHT = 140;

function formatISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function HistoryScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const h = useHaptics();

  const { user, userProfile } = useAuth();
  const { addMeal } = useActivity();

  const [range, setRange] = useState<RangeKey>("14");
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(false);

  const todayISO = formatISO(new Date());

  const loadRange = useCallback(
    async (r: RangeKey) => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const n = Number(r);
        const out: DayData[] = [];
        const base = startOfToday();
        for (let i = 0; i < n; i++) {
          const d = new Date(base);
          d.setDate(base.getDate() - i);
          const dateISO = formatISO(d);
          const id = `${user.uid}_${dateISO}`;
          const ref = doc(db, "activities", id);
          const snap = await getDoc(ref);
          const data: any = snap.exists() ? snap.data() : null;

          const mealsArr = Array.isArray(data?.meals) ? data.meals : [];
          const workoutsArr = Array.isArray(data?.workouts) ? data.workouts : [];

          out.push({
            dateISO,
            calories: Math.round(data?.totalCalories || 0),
            caloriesGoal: Math.round(userProfile?.dailyCalories || 0),
            steps: Math.round(data?.steps || 0),
            waterIntake: Math.round(data?.waterIntake || 0),
            mealsCount: mealsArr.length || 0,
            workoutsCount: workoutsArr.length || 0,
            meals: mealsArr.map((m: any) => ({
              name: m?.name || "Meal",
              calories: Math.round(m?.calories || 0),
              macros: m?.macros || { protein: 0, carbs: 0, fat: 0 },
              type: m?.type || "lunch",
            })),
          });
        }
        setDays(out);
      } catch (e) {
        console.error("History load error:", e);
        toast.error("Failed to load history. Try again later.");
      } finally {
        setLoading(false);
      }
    },
    [toast, user?.uid, userProfile?.dailyCalories]
  );

  useEffect(() => {
    loadRange(range);
  }, [loadRange, range]);

  const summary = useMemo(() => {
    if (!days.length) return null;
    const totalKcal = days.reduce((a, d) => a + (d.calories || 0), 0);
    const avgKcal = Math.round(totalKcal / days.length);
    const daysLogged = days.filter((d) => d.calories > 0 || d.mealsCount > 0 || d.steps > 0).length;
    return { totalKcal, avgKcal, daysLogged };
  }, [days]);

  const copyDayToToday = useCallback(
    async (d: DayData) => {
      const today = formatISO(new Date());
      if (d.dateISO === today) {
        toast.info("This is already today");
        return;
      }
      if (!d.meals?.length) {
        toast.info("This day has no meals to copy");
        return;
      }
      try {
        for (const m of d.meals) {
          await addMeal({
            name: m.name,
            calories: m.calories,
            macros: m.macros || { protein: 0, carbs: 0, fat: 0 },
            micros: {},
            type: m.type || "lunch",
          });
        }
        h.impact("light");
        toast.success(`Copied ${d.meals.length} meal(s) to today`);
      } catch (e) {
        console.error("copyDayToToday error:", e);
        toast.error("Failed to copy meals");
      }
    },
    [addMeal, h, toast]
  );

  const keyExtractor = useCallback((item: DayData) => item.dateISO, []);
  const getItemLayout = useCallback(
    (_: DayData[] | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item: d }: ListRenderItemInfo<DayData>) => {
      const isToday = d.dateISO === todayISO;
      return (
        <Card style={{ marginTop: 10 }}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayTitle, { color: theme.colors.text }]}>
              {new Date(d.dateISO).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {isToday ? " • Today" : ""}
            </Text>
            <TouchableOpacity
              style={[
                styles.copyBtn,
                {
                  backgroundColor: isToday ? theme.colors.surface2 : theme.colors.primary,
                  borderColor: theme.colors.border,
                  opacity: isToday ? 0.6 : 1,
                },
              ]}
              disabled={isToday}
              onPress={() => copyDayToToday(d)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${d.dateISO} meals to today`}
            >
              <Ionicons
                name="copy-outline"
                size={16}
                color={isToday ? theme.colors.textMuted : "#fff"}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  { color: isToday ? theme.colors.textMuted : "#fff" },
                ]}
              >
                Copy to Today
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricsRow}>
            <Metric
              icon="flame-outline"
              label="Calories"
              value={`${d.calories}/${d.caloriesGoal || 0}`}
              sub="consumed/goal"
              color={theme.colors.text}
              muted={theme.colors.textMuted}
            />
            <Metric
              icon="walk-outline"
              label="Steps"
              value={`${d.steps}`}
              sub="today"
              color={theme.colors.text}
              muted={theme.colors.textMuted}
            />
            <Metric
              icon="water-outline"
              label="Water"
              value={`${d.waterIntake} ml`}
              sub="today"
              color={theme.colors.text}
              muted={theme.colors.textMuted}
            />
          </View>

          <View style={styles.metricsRow}>
            <SmallBadge
              icon="restaurant-outline"
              label={`${d.mealsCount} meals`}
              color={theme.colors.text}
              muted={theme.colors.textMuted}
            />
            <SmallBadge
              icon="barbell-outline"
              label={`${d.workoutsCount} workouts`}
              color={theme.colors.text}
              muted={theme.colors.textMuted}
            />
          </View>
        </Card>
      );
    },
    [copyDayToToday, theme.colors.border, theme.colors.primary, theme.colors.text, theme.colors.textMuted, todayISO]
  );

  const header = (
    <View>
      <Text style={[styles.title, { color: theme.colors.text }]}>History</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        Review your past days and quickly copy meals to today.
      </Text>

      <View style={{ marginTop: 12 }}>
        <Segmented
          items={[
            { label: "7 days", value: "7" },
            { label: "14 days", value: "14" },
            { label: "30 days", value: "30" },
          ]}
          value={range}
          onChange={(v) => setRange(v as RangeKey)}
        />
      </View>

      <Card style={{ marginTop: 12 }}>
        {!days.length ? (
          <Text style={{ color: theme.colors.textMuted }}>
            {loading ? "Loading…" : "No history yet."}
          </Text>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Summary ({range} days)
            </Text>
            <View style={styles.summaryRow}>
              <SummaryItem
                label="Total kcal"
                value={String(summary?.totalKcal || 0)}
                color={theme.colors.text}
              />
              <SummaryItem
                label="Avg kcal/day"
                value={String(summary?.avgKcal || 0)}
                color={theme.colors.text}
              />
              <SummaryItem
                label="Days logged"
                value={String(summary?.daysLogged || 0)}
                color={theme.colors.text}
              />
            </View>
          </>
        )}
      </Card>
    </View>
  );

  return (
    <FlatList
      data={days}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => loadRange(range)} />
      }
      removeClippedSubviews
      windowSize={8}
      initialNumToRender={10}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="History list of days"
    />
  );
}

function SummaryItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  color,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.metricBox}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={16} color="#007AFF" />
      </View>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={[styles.metricSub, { color: muted }]}>{sub}</Text> : null}
    </View>
  );
}

function SmallBadge({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.badgeRow} accessible accessibilityLabel={`${label}`} accessibilityRole="text">
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: fonts.bold },
  subtitle: { fontFamily: fonts.regular, marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 8 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontFamily: fonts.bold },
  summaryLabel: { fontSize: 12, fontFamily: fonts.regular, color: "#8E8E93", marginTop: 2 },

  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dayTitle: { fontFamily: fonts.semiBold },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  copyBtnText: { fontFamily: fonts.semiBold, fontSize: 12 },

  metricsRow: { flexDirection: "row", alignItems: "stretch", gap: 10, marginTop: 8 },
  metricBox: { flex: 1, alignItems: "center" },
  metricIcon: { backgroundColor: "#007AFF10", padding: 6, borderRadius: 10, marginBottom: 6 },
  metricLabel: { fontSize: 12, fontFamily: fonts.regular },
  metricValue: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: 2 },
  metricSub: { fontSize: 10, marginTop: 2 },

  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 12 },
});