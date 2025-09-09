import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { loadAllLiftStats, LiftStats } from "../src/utils/lifts";
import { getUnits } from "../src/utils/userSettings";
import { Card, SectionHeader, Pill } from "../src/ui/components/UKit";

function BarChart({
  samples,
  height = 140,
  barColor = "#2962FF",
}: {
  samples: { date: string; volume: number }[];
  height?: number;
  barColor?: string;
}) {
  const max = samples.reduce((a, s) => Math.max(a, s.volume), 0);
  if (!samples.length || max <= 0)
    return <Text style={{ color: "#8E8E93" }}>No volume yet.</Text>;
  const w = Math.max(10, Math.floor(260 / samples.length));
  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end" }}>
      {samples.map((s, i) => {
        const h = Math.max(2, Math.round((s.volume / max) * (height - 20)));
        return (
          <View
            key={`${s.date}-${i}`}
            style={{
              width: w,
              height: h,
              backgroundColor: barColor,
              marginRight: 4,
              borderRadius: 4,
            }}
          />
        );
      })}
    </View>
  );
}

export default function StrengthStatsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [map, setMap] = useState<Map<string, LiftStats>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [unitLabel, setUnitLabel] = useState<"kg" | "lb">("kg");

  useEffect(() => {
    (async () => {
      if (!user?.uid) return;
      const m = await loadAllLiftStats(user.uid, 365);
      setMap(m);
      if (!selected) {
        const first = Array.from(m.keys())[0] || null;
        setSelected(first);
      }
      try {
        const u = await getUnits(user.uid);
        if (u?.weight === "lb" || u?.weight === "kg") setUnitLabel(u.weight);
      } catch {}
    })();
  }, [user?.uid]);

  const names = useMemo(() => {
    const arr = Array.from(map.keys());
    const q = query.trim().toLowerCase();
    return arr
      .filter((n) => (!q ? true : n.toLowerCase().includes(q)))
      .sort((a, b) => a.localeCompare(b));
  }, [map, query]);

  const stats = selected ? map.get(selected) : undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.appBg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        title="Strength stats"
        subtitle={`Personal bests and volume trends (Units: ${unitLabel})`}
      />

      <Card>
        <SectionHeader title="Choose exercise" />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          placeholder="Search e.g., bench, squat, pull-up"
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {names.slice(0, 20).map((n) => {
            const active = selected === n;
            return (
              <Pill
                key={n}
                label={n}
                selected={active}
                onPress={() => setSelected(n)}
              />
            );
          })}
        </View>
      </Card>

      {!stats ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          No lifts yet. Complete a session to see stats.
        </Text>
      ) : (
        <>
          <Card>
            <SectionHeader title={`Personal bests — ${stats.name}`} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PB label="PB weight" value={stats.pbWeight} unit={unitLabel} />
              <PB label="PB 1RM (est.)" value={stats.pb1RM} unit={unitLabel} />
              <PB label="Best volume" value={stats.bestVolume} unit="" />
            </View>
            <Text style={{ color: theme.colors.textMuted, marginTop: 6 }}>
              Note: PBs are displayed with your current unit.
            </Text>
          </Card>

          <Card>
            <SectionHeader
              title={`Volume (last ${Math.min(
                10,
                stats.samples.length
              )} sessions)`}
            />
            <BarChart
              samples={stats.samples.slice(-10)}
              barColor="#2962FF"
            />
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function PB({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: fonts.medium }}>{label}</Text>
      <Text style={{ fontFamily: fonts.semiBold, fontSize: 18 }}>
        {value != null ? `${value} ${unit}` : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontFamily: fonts.regular,
    marginBottom: 8,
  },
});