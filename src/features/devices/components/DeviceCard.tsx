import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ImageSourcePropType } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

const ACTION_HIT_SLOP = { top: 6, right: 6, bottom: 10, left: 6 } as const;
const MAIN_BADGE_ACCENT = '#19c75a';

type Props = {
  icon: ImageSourcePropType;

  deviceName: string;
  deviceTypeLabel?: string;

  lastSyncText?: string | null;
  isMain?: boolean;

  onPress?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
};

export default function DeviceCard({
  icon,
  deviceName,
  deviceTypeLabel,
  lastSyncText,
  isMain = false,
  onPress,
  onRename,
  onDelete,
}: Props) {
  const { lang } = useLanguage();
  // Normalize device type label: backend may store pipe-separated tokens like
  // "Oximeter | Pressure | Glucose | Thermometer". Map to friendly names.
  let friendlyType: string | undefined;
  if (deviceTypeLabel) {
    const parts = deviceTypeLabel.split('|').map((s) => s.trim()).filter(Boolean);
    const mapped = parts.map((p) => {
      const lower = p.toLowerCase();
      if (lower === 'oximeter') return t(lang, 'device_type_oximeter');
      if (lower === 'pressure') return t(lang, 'device_type_pressure');
      if (lower === 'glucose') return t(lang, 'device_type_glucose');
      if (lower === 'thermometer') return t(lang, 'device_type_thermometer');
      if (lower === 'scale' || lower === 'weight' || lower === 'weight scale') return t(lang, 'device_type_scale');
      if (lower === 'heart') return t(lang, 'device_type_heart');
      // fallback: capitalize
      return p.charAt(0).toUpperCase() + p.slice(1);
    });
    friendlyType = mapped.join(', ');
  }

  const topContent = (
    <View style={styles.topRow}>
      <View style={styles.iconWrap}>
        <Image source={icon} style={styles.icon} resizeMode="contain" />
      </View>

      <View style={[styles.infoSection, isMain ? styles.infoSectionWithBadge : null]}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {deviceName}
        </Text>
        {friendlyType ? (
          <Text style={styles.deviceType} numberOfLines={2}>
            {friendlyType}
          </Text>
        ) : null}
        {lastSyncText ? (
          <Text style={styles.lastSyncText} numberOfLines={1}>
            {lastSyncText}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isMain ? (
        <View style={styles.mainBadge}>
          <Text style={styles.mainBadgeText}>{t(lang, 'device_main_badge')}</Text>
        </View>
      ) : null}

      {onPress ? (
        <Pressable style={styles.topPressArea} onPress={onPress}>
          {topContent}
        </Pressable>
      ) : topContent}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.leftAction]}
          onPress={onRename}
          disabled={!onRename}
          hitSlop={ACTION_HIT_SLOP}
        >
          <Image source={require('../../../../assets/android-res/drawable/edit.png')} style={styles.actionIcon} />
          <Text style={styles.actionText}>{t(lang, 'device_rename')}</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.rightAction, styles.deleteBtn]}
          onPress={onDelete}
          disabled={!onDelete}
          hitSlop={ACTION_HIT_SLOP}
        >
          <Image
            source={require('../../../../assets/android-res/drawable/delete.png')}
            style={[styles.actionIcon, styles.deleteIcon]}
          />
          <Text style={[styles.actionText, styles.deleteText]}>{t(lang, 'device_remove')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md + Spacing.xs,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  topPressArea: {
    borderRadius: Radius.md,
  },
  iconWrap: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: Spacing.md,
    paddingTop: 2,
  },
  icon: {
    width: 54,
    height: 54,
  },
  infoSection: {
    flex: 1,
    minWidth: 0,
  },
  infoSectionWithBadge: {
    paddingRight: 72,
  },
  deviceName: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  deviceType: {
    marginTop: 2,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  lastSyncText: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    // Make both actions take equal width across the card
    flex: 1,
    minWidth: 0,
  },
  actionIcon: {
    width: 16,
    height: 16,
    tintColor: Colors.text,
    marginRight: Spacing.xs + Spacing.xxs,
  },
  actionText: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.text,
    fontWeight: Typography.weight.semibold,
  },
  deleteBtn: {
    borderColor: Colors.dangerSoft,
    backgroundColor: '#FFF7F7',
  },
  leftAction: {
    marginRight: Spacing.sm,
  },
  rightAction: {
    marginLeft: Spacing.sm,
  },
  deleteIcon: {
    tintColor: Colors.danger,
  },
  deleteText: {
    color: Colors.danger,
  },
  mainBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.card,
    borderColor: MAIN_BADGE_ACCENT,
    borderWidth: BorderWidth.sm + 0.5,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xxs + 1,
    zIndex: 2,
  },
  mainBadgeText: {
    color: MAIN_BADGE_ACCENT,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
  },
});
