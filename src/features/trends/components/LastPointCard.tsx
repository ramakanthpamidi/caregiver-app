import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import type { HealthStatusLevel } from '../../../shared/lib/healthThresholds';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

export type LastPointSummary = {
  label: string;
  value: string;
  unit: string;
  secondary?: string;
  status: HealthStatusLevel;
  timestampLabel?: string;
  deviceLabel?: string;
  icon: any;
};

function getStatusPalette(status: HealthStatusLevel) {
  switch (status) {
    case 'Critical':
      return { color: Colors.danger, background: Colors.dangerSoft };
    case 'Warning':
      return { color: Colors.warning, background: Colors.warningSoft };
    case 'Good':
      return { color: Colors.success, background: Colors.successSoft };
    default:
      return { color: Colors.info, background: Colors.infoSoft };
  }
}

function getStatusKey(status: HealthStatusLevel) {
  switch (status) {
    case 'Critical':
      return 'sev_critical';
    case 'Warning':
      return 'sev_warning';
    case 'Good':
      return 'sev_good';
    default:
      return 'sev_excellent';
  }
}

export default function LastPointCard({ summary }: { summary: LastPointSummary }) {
  const { lang } = useLanguage();
  const palette = getStatusPalette(summary.status);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t(lang, 'last_reading')}</Text>
          <Text style={styles.title}>{t(lang, 'no_readings_today')}</Text>
          <Text style={styles.subtitle}>{t(lang, 'showing_latest_available')}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: palette.background }]}>
          <View style={[styles.statusDot, { backgroundColor: palette.color }]} />
          <Text style={[styles.statusText, { color: palette.color }]}>
            {t(lang, getStatusKey(summary.status))}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.iconWrap, { backgroundColor: palette.background }]}>
          <Image source={summary.icon} style={[styles.icon, { tintColor: palette.color }]} resizeMode="contain" />
        </View>
        <View style={styles.metricCopy}>
          <Text style={styles.metricLabel}>{summary.label}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.metricValue}>{summary.value}</Text>
            <Text style={styles.metricUnit}>{summary.unit}</Text>
          </View>
          {summary.secondary ? <Text style={styles.metricSecondary}>{summary.secondary}</Text> : null}
        </View>
      </View>

      {summary.timestampLabel || summary.deviceLabel ? (
        <View style={styles.metaRow}>
          {summary.timestampLabel ? <Text style={styles.metaText}>{summary.timestampLabel}</Text> : null}
          {summary.timestampLabel && summary.deviceLabel ? <View style={styles.metaDot} /> : null}
          {summary.deviceLabel ? <Text style={styles.metaText}>{summary.deviceLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  eyebrow: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  metricCopy: {
    flex: 1,
    gap: Spacing.xs,
  },
  metricLabel: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  metricValue: {
    fontSize: Typography.size['3xl'],
    lineHeight: Typography.lineHeight['3xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  metricUnit: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSubtle,
    paddingBottom: Spacing.xs,
  },
  metricSecondary: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  metaText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderStrong,
  },
});
