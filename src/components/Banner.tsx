// src/components/Banner.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

type Variant = 'info' | 'warning' | 'error' | 'success';

type Props = {
  variant?: Variant;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  style?: ViewStyle;
};

const COLORS: Record<
  Variant,
  { border: string; bg: string; text: string; accent: string }
> = {
  info: {
    border: '#377CF6',
    bg: '#EAF2FF',
    text: '#0B3B8F',
    accent: '#377CF6',
  },
  warning: {
    border: '#F5A524',
    bg: '#FFF5E6',
    text: '#7A4D00',
    accent: '#F5A524',
  },
  error: {
    border: '#EF4444',
    bg: '#FDECEC',
    text: '#7A0D0D',
    accent: '#EF4444',
  },
  success: {
    border: '#22C55E',
    bg: '#EAF8F0',
    text: '#0B5C2B',
    accent: '#22C55E',
  },
};

export default function Banner({
  variant = 'info',
  title,
  message,
  actionLabel,
  onAction,
  onClose,
  style,
}: Props) {
  const palette = COLORS[variant];

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: palette.border,
          backgroundColor: palette.bg,
        },
        style,
      ]}
    >
      <View style={styles.textWrap}>
        {!!title && (
          <Text
            style={[
              styles.title,
              { color: palette.text },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
        <Text style={[styles.msg, { color: palette.text }]}>
          {message}
        </Text>
      </View>

      <View style={styles.actions}>
        {!!actionLabel && !!onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={[
              styles.actionBtn,
              { borderColor: palette.accent },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                { color: palette.accent },
              ]}
            >
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
        {!!onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeText, { color: palette.text }]}>
              ×
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  msg: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.5,
  },
});