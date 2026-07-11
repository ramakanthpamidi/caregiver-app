import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Colors, Radius, Shadows, Spacing, Typography } from '../theme/theme';

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  leftAccessory?: React.ReactNode;
  rightAccessory?: React.ReactNode;
};

export default function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  labelStyle,
  leftAccessory,
  rightAccessory,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? Colors.textOnPrimary : Colors.primary} />
      ) : (
        <View style={styles.contentRow}>
          <View style={styles.sideSlot}>{leftAccessory}</View>
          <Text
            style={[
              styles.label,
              isPrimary ? styles.primaryLabel : styles.secondaryLabel,
              labelStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View style={styles.sideSlot}>{rightAccessory}</View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: {
    width: 28,
    minHeight: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  disabled: {
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.9,
  },
  label: {
    flex: 1,
    fontSize: Typography.bodyLg,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  primaryLabel: {
    color: Colors.textOnPrimary,
  },
  secondaryLabel: {
    color: Colors.primary,
  },
});
