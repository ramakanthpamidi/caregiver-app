import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

type Props = {
  title: string;
  value: string;
  unit?: string;
  icon: any;
  accentColor: string;
  badgeLabel?: string | null;
  badgeTextColor?: string;
  badgeBackgroundColor?: string;
  meta?: string;
  actionText?: string;
  onActionPress?: () => void;
  onPress?: () => void;
  disabled?: boolean;
};

export default function TrendMetricTile({
  title,
  value,
  unit,
  icon,
  accentColor,
  badgeLabel,
  badgeTextColor = accentColor,
  badgeBackgroundColor = Colors.surfaceMuted,
  meta,
  actionText,
  onActionPress,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <View style={styles.topRow}>
        <LinearGradient
          colors={[`${accentColor}1A`, Colors.surface]}
          style={styles.iconBadge}
        >
          <Image source={icon} style={[styles.icon, { tintColor: accentColor }]} resizeMode="contain" />
        </LinearGradient>
        {badgeLabel ? (
          <View style={[styles.badge, { backgroundColor: badgeBackgroundColor }]}>
            <Text style={[styles.badgeText, { color: badgeTextColor }]} numberOfLines={1}>
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text style={[styles.unit, { color: accentColor }]} numberOfLines={1}>
            {unit}
          </Text>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {meta || ' '}
        </Text>
        {actionText && onActionPress ? (
          <Pressable
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation();
              onActionPress();
            }}
            style={styles.actionTextWrap}
          >
            <Text style={styles.actionText} numberOfLines={1} ellipsizeMode="tail">
              {actionText}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 164,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  cardDisabled: {
    opacity: 1,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 22,
    height: 22,
  },
  badge: {
    minHeight: 28,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    borderRadius: Radius.pill,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
  },
  title: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSubtle,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  value: {
    flexShrink: 1,
    fontSize: Typography.size['3xl'],
    lineHeight: Typography.lineHeight['3xl'],
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  unit: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.xs,
  },
  footerRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: Spacing.sm,
  },
  meta: {
    flex: 1,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  actionTextWrap: {
    maxWidth: '68%',
    alignSelf: 'flex-end',
  },
  actionText: {
    textAlign: 'right',
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.primary,
    fontWeight: Typography.weight.bold,
  },
});
