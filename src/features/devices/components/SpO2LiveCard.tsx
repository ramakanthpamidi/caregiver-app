import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { evaluateSpO2, type HealthStatusLevel } from '../../../shared/lib/healthThresholds';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

type Props = {
  spo2: number | null;
  /** pulse rate in bpm (from oximeter), null if unavailable */
  pulse: number | null;
  /** epoch ms of the last live reading (0 = no reading) */
  ts: number;
};

function formatTs(ts: number, lang: 'en' | 'th'): string {
  if (!ts) return t(lang, 'no_reading_yet');
  const diff = Date.now() - ts;
  if (diff < 60_000) return t(lang, 'just_now');
  if (diff < 3_600_000) return lang === 'th' ? `${Math.floor(diff / 60_000)} นาทีที่แล้ว` : `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return lang === 'th' ? `${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว` : `${Math.floor(diff / 3_600_000)} h ago`;
  const days = Math.floor(diff / 86_400_000);
  return lang === 'th' ? `${days} วันที่แล้ว` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function statusTheme(level: HealthStatusLevel | null, lang: 'en' | 'th') {
  switch (level) {
    case 'Critical':  return { color: Colors.danger, bg: Colors.dangerSoft, label: t(lang, 'sev_critical_upper') };
    case 'Warning':   return { color: Colors.warning, bg: Colors.warningSoft, label: t(lang, 'sev_warning_upper') };
    case 'Good':      return { color: Colors.success, bg: Colors.successSoft, label: t(lang, 'sev_good_upper') };
    case 'Excellent': return { color: Colors.info, bg: Colors.infoSoft, label: t(lang, 'sev_excellent_upper') };
    default:          return { color: Colors.textSubtle, bg: Colors.gray100, label: '' };
  }
}

export default function SpO2LiveCard({ spo2, pulse, ts }: Props) {
  const { lang } = useLanguage();
  const status     = spo2 != null ? evaluateSpO2({ spo2 }) : null;
  const theme      = statusTheme(status, lang);
  const hasReading = spo2 != null;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <LinearGradient colors={[Colors.secondarySoft, Colors.surface]} style={styles.iconBadge}>
          <Image
            source={require('../../../../assets/android-res/drawable/spo2.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </LinearGradient>
        <Text style={styles.title}>{t(lang, 'oxygen_level')} (SpO₂)</Text>
        {hasReading && theme.label ? (
          <View style={[styles.badge, { backgroundColor: theme.bg, borderColor: theme.color }]}>
            <Text style={[styles.badgeText, { color: theme.color }]}>{theme.label}</Text>
          </View>
        ) : null}
      </View>

      {/* Value area */}
      {hasReading ? (
        <View style={styles.valueArea}>
          <View style={styles.valueRow}>
            <Text style={[styles.valuePrimary, { color: theme.color }]}>
              {Math.round(spo2!)}
            </Text>
            <Text style={[styles.valueUnit, { color: theme.color }]}>%</Text>
          </View>
          {pulse != null && pulse > 0 ? (
            <View style={styles.pulseRow}>
              <View style={[styles.heartDot, { backgroundColor: theme.color }]} />
              <Text style={styles.pulseText}>{Math.round(pulse)} bpm</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyArea}>
          <Text style={styles.emptyText}>{t(lang, 'no_spo2_reading')}</Text>
          <Text style={styles.emptyHint}>{t(lang, 'connect_oximeter')}</Text>
        </View>
      )}

      {/* Footer row */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>{t(lang, 'normal_range')}</Text>
          <Text style={styles.footerValue}>95 – 100 %</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>{t(lang, 'last_reading')}</Text>
          <Text style={styles.footerValue}>{formatTs(ts, lang)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  badge: {
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.sm,
  },
  badgeText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
  },
  valueArea: {
    alignItems: 'center',
    paddingVertical: Spacing.xl - Spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  valuePrimary: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 60,
  },
  valueUnit: {
    fontSize: 22,
    fontWeight: Typography.weight.bold,
    marginBottom: 6,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 6,
  },
  heartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseText: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSubtle,
  },
  emptyArea: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
  },
  emptyHint: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textDisabled,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  footerItem: {
    flex: 1,
    paddingVertical: Spacing.sm + Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  footerDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  footerLabel: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
    marginBottom: 3,
  },
  footerValue: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textMuted,
  },
});
