// src/ui/components/Input.tsx
import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { useTheme } from "../ThemeProvider";

export default function Input({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && (
        <Text style={{ color: theme.colors.textMuted, marginBottom: 6 }}>{label}</Text>
      )}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text },
        ]}
        {...props}
      />
      {!!error && (
        <Text style={{ color: theme.colors.danger, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});