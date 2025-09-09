// src/ui/components/ModalSheet.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeProvider";
import { fonts } from "../../constants/fonts";

export default function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={[
            styles.body,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.header}>
            {!!title && (
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: fonts.semiBold,
                  fontSize: 16,
                }}
              >
                {title}
              </Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons
                name="close"
                size={22}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    padding: 16,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});