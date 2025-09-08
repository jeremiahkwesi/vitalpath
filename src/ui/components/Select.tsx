// src/ui/components/Select.tsx
import React, { useMemo, useState } from "react";
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  ActionSheetIOS,
  Modal,
  StyleSheet,
  FlatList,
} from "react-native";
import { fonts } from "../../constants/fonts";
import { useTheme } from "../ThemeProvider";

type Item<T extends string | number> = { label: string; value: T };

export default function Select<T extends string | number>({
  label,
  value,
  items,
  onChange,
  placeholder = "Select…",
}: {
  label?: string;
  value: T;
  items: Item<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => items.find((i) => i.value === value)?.label || placeholder,
    [items, value, placeholder]
  );

  const onPress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...items.map((i) => i.label), "Cancel"],
          cancelButtonIndex: items.length,
          userInterfaceStyle: theme.isDark ? "dark" : "light",
        },
        (buttonIndex) => {
          if (buttonIndex === items.length) return;
          const it = items[buttonIndex];
          if (it) onChange(it.value);
        }
      );
    } else {
      setOpen(true);
    }
  };

  return (
    <View style={{ marginBottom: 10 }}>
      {!!label && (
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      )}
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.box,
          {
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={{
            color:
              selected === placeholder ? theme.colors.textMuted : theme.colors.text,
            fontFamily: fonts.regular,
          }}
        >
          {selected}
        </Text>
      </TouchableOpacity>

      {Platform.OS !== "ios" && (
        <Modal visible={open} transparent animationType="fade">
          <View style={styles.overlay}>
            <View
              style={[
                styles.sheet,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {label || "Select"}
              </Text>
              <FlatList
                data={items}
                keyExtractor={(i) => String(i.value)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.row,
                      { borderColor: theme.colors.border },
                      value === item.value && {
                        backgroundColor: theme.colors.surface2,
                      },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={{ color: theme.colors.text, fontFamily: fonts.regular }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={[styles.cancel, { backgroundColor: theme.colors.surface2 }]}
              >
                <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semiBold, marginBottom: 6 },
  box: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  sheet: { borderRadius: 12, borderWidth: 1, maxHeight: "70%", padding: 12 },
  title: { fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 10 },
  row: { paddingVertical: 12, borderBottomWidth: 1 },
  cancel: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
});