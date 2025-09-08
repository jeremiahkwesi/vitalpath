// app/FoodSearchScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ListRenderItemInfo,
  Platform,
} from "react-native";
import { useTheme } from "../src/ui/ThemeProvider";
import { fonts } from "../src/constants/fonts";
import { useAuth } from "../src/context/AuthContext";
import { searchFoods, FoodItem } from "../src/services/foodDb";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function FoodSearchScreen() {
  const { theme } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoodItem[]>([]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const s = q.trim();
      if (!s) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await searchFoods(s, {
          uid: user?.uid || undefined,
          limit: 60,
        });
        if (active) setResults(data);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, user?.uid]);

  const goAdd = (it: FoodItem) => {
    const origin = route.params?.origin;
    nav.navigate("FoodAdd", { food: it, origin });
  };

  const renderItem = ({ item }: ListRenderItemInfo<FoodItem>) => (
    <TouchableOpacity
      onPress={() => goAdd(item)}
      style={[styles.row, { borderBottomColor: theme.colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name}`}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.name, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text
          style={{ color: theme.colors.textMuted, fontSize: 12 }}
          numberOfLines={2}
        >
          {item.serving} • {Math.round(item.calories)} kcal • P{item.protein} C
          {item.carbs} F{item.fat}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.appBg, padding: 16 }}
    >
      <Text style={[styles.header, { color: theme.colors.text }]}>
        Search Food
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
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
          placeholder="Search (e.g., chicken, rice, yogurt)"
          placeholderTextColor={theme.colors.textMuted}
          value={q}
          onChangeText={setQ}
          autoFocus={Platform.OS !== "web"}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={() => nav.navigate("Scan" as never)}
          style={[
            styles.iconBtn,
            {
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
          accessibilityLabel="Open scanner"
          accessibilityRole="button"
        >
          <Ionicons name="scan-outline" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          Searching…
        </Text>
      ) : results.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>
          Try typing “banana”, “oats”, “chicken breast”…
        </Text>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontFamily: fonts.bold, fontSize: 22, marginBottom: 8 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
  },
  iconBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  name: { fontFamily: fonts.semiBold, fontSize: 14 },
});