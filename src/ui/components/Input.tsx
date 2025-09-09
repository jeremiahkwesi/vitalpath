// src/ui/components/Input.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export default function Input({
  label,
  helperText,
  errorText,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const [focus, setFocus] = useState(false);
  const borderColor = errorText
    ? theme.colors.danger
    : focus
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <View style={{ marginBottom: 10 }}>
      {!!label && (
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: fonts.semiBold,
            marginBottom: 6,
            fontSize: 13,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface2,
            borderColor,
            color: theme.colors.text,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...rest}
      />
      {!!errorText && (
        <Text
          style={{
            color: theme.colors.danger,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {errorText}
        </Text>
      )}
      {!errorText && !!helperText && (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
  },
});