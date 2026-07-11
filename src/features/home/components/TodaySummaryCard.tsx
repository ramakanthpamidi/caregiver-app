import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import {
  evaluateBloodPressure,
  evaluateGlucose,
  evaluateSpO2,
  evaluateTemperature,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import type { BloodPressureTrendPoint, BloodGlucoseTrendPoint } from '../../profiles/api/profileApi';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

type Period = 'Latest' | 'Daily' | 'Weekly' | 'Monthly' | 'Overall';

type RowData = {
  key: string;
  icon: any;
  label: string;
  value: string;
  sub?: string;
  status: HealthStatusLevel | null;
  count?: number;
};
type Props = {
  bpPoints: BloodPressureTrendPoint[];
  glucosePoints: BloodGlucoseTrendPoint[];
  latestTempC: number | null;
  latestTempTs?: number;   // epoch ms of the temp reading
  latestSpo2: number | null;
  latestSpo2Ts?: number;   // epoch ms of the spo2 reading
  latestPulse: number | null;
  period?: Period;
};

function statusColor(level: HealthStatusLevel | null): string {
  switch (level) {
    case 'Critical':  return Colors.danger;
    case 'Warning':   return Colors.warning;
    case 'Good':      return Colors.success;
    case 'Excellent': return Colors.info;
    default:          return Colors.textDisabled;
  }
}

function statusLabel(level: HealthStatusLevel | null, lang: 'en' | 'th'): string {
  if (!level) return '—';
  const keyMap: Record<HealthStatusLevel, string> = {
    Critical: 'sev_critical',
    Warning: 'sev_warning',
    Good: 'sev_good',
    Excellent: 'sev_excellent',
  };
  return t(lang, keyMap[level]);
}

/** Filter a list of trend points to those from today (Bangkok UTC+7 day). */
function filterToday<T extends { ts_ms?: number; ts: string }>(points: T[]): T[] {
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowBkk = Date.now() + BKK_OFFSET_MS;
  const todayBkkDate = new Date(nowBkk).toISOString().slice(0, 10); // YYYY-MM-DD
  return points.filter((p) => {
    const ms = Number(p.ts_ms ?? 0) || Date.parse(p.ts);
    if (!ms) return false;
    const bkkDate = new Date(ms + BKK_OFFSET_MS).toISOString().slice(0, 10);
    return bkkDate === todayBkkDate;
  });
}

function MetricRow({
  icon,
  label,
  value,
  sub,
  status,
  count,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  status: HealthStatusLevel | null;
  count?: number;
}) {
  const { lang } = useLanguage();
  const color = statusColor(status);
  const hasData = value !== '—';
  return (
    <View style={styles.metricRow}>
      <Image
        source={icon}
        style={[styles.metricIcon, hasData ? undefined : styles.metricIconDisabled]}
        resizeMode="contain"
      />
      <View style={styles.metricMid}>
        <Text style={styles.metricLabel}>{label}</Text>
        {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
      </View>
      <View style={styles.metricRight}>
        {count != null && count > 0 ? (
          <Text style={styles.metricCount}>{count}×</Text>
        ) : null}
        <Text style={[styles.metricValue, { color: hasData ? color : Colors.textSubtle }]}>
          {value}
        </Text>
        {hasData ? (
          <Text style={[styles.metricStatus, { color }]}>
            {statusLabel(status, lang)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// Animated wrapper for MetricRow — handles enter (fade+slide-up) on mount.
// No exit animation: rows disappear instantly when removed from currentRows,
// which avoids the state-lag empty-box bug.
const AnimatedMetricRow = React.memo(function AnimatedMetricRow({
  rowData,
  showDivider,
}: {
  rowData: RowData;
  showDivider: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
      }}
    >
      {showDivider && <View style={styles.divider} />}
      <MetricRow
        icon={rowData.icon}
        label={rowData.label}
        value={rowData.value}
        sub={rowData.sub}
        status={rowData.status}
        count={rowData.count}
      />
    </Animated.View>
  );
});

export default function TodaySummaryCard({
  bpPoints,
  glucosePoints,
  latestTempC,
  latestTempTs,
  latestSpo2,
  latestSpo2Ts,
  latestPulse,
  period = 'Daily',
}: Props) {
  const { lang } = useLanguage();
  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

  const isDaily = period === 'Daily';

  // Client-side date filter matching the server query window for each period.
  const filterForPeriod = <T extends { ts_ms?: number; ts: string }>(points: T[]): T[] => {
    if (period === 'Latest' || period === 'Overall') return [...points];
    if (period === 'Daily') return filterToday(points);
    const nowBkkMs = Date.now() + BKK_OFFSET_MS;
    const todayBkk = new Date(nowBkkMs).toISOString().slice(0, 10);
    return points.filter((p) => {
      const ms = Number(p.ts_ms ?? 0) || Date.parse(p.ts);
      if (!ms) return false;
      const dayBkk = new Date(ms + BKK_OFFSET_MS).toISOString().slice(0, 10);
      if (period === 'Weekly') {
        // Sun-Sat calendar week containing today
        const nowBkkDate = new Date(nowBkkMs);
        const dow = nowBkkDate.getUTCDay(); // 0=Sunday
        const sunBkk = new Date(nowBkkDate);
        sunBkk.setUTCDate(sunBkk.getUTCDate() - dow);
        const satBkk = new Date(sunBkk);
        satBkk.setUTCDate(sunBkk.getUTCDate() + 6);
        const weekStartStr = sunBkk.toISOString().slice(0, 10);
        const weekEndStr = satBkk.toISOString().slice(0, 10);
        return dayBkk >= weekStartStr && dayBkk <= weekEndStr;
      }
      // Monthly: current month in Bangkok time
      return dayBkk.slice(0, 7) === todayBkk.slice(0, 7);
    });
  };

  const filteredBp = filterForPeriod(bpPoints);
  const filteredGlucose = filterForPeriod(glucosePoints);

  // Check whether a raw timestamp (epoch ms) falls inside the selected period.
  const isInPeriodMs = (tsMs: number): boolean => {
    if (!tsMs) return false;
    if (period === 'Latest' || period === 'Overall') return true;
    const nowBkkMs = Date.now() + BKK_OFFSET_MS;
    const dayBkk = new Date(tsMs + BKK_OFFSET_MS).toISOString().slice(0, 10);
    if (period === 'Daily') {
      return dayBkk === new Date(nowBkkMs).toISOString().slice(0, 10);
    }
    if (period === 'Weekly') {
      const nowBkkDate = new Date(nowBkkMs);
      const dow = nowBkkDate.getUTCDay();
      const sunBkk = new Date(nowBkkDate);
      sunBkk.setUTCDate(sunBkk.getUTCDate() - dow);
      const satBkk = new Date(sunBkk);
      satBkk.setUTCDate(sunBkk.getUTCDate() + 6);
      return dayBkk >= sunBkk.toISOString().slice(0, 10) && dayBkk <= satBkk.toISOString().slice(0, 10);
    }
    // Monthly
    return dayBkk.slice(0, 7) === new Date(nowBkkMs).toISOString().slice(0, 7);
  };

  // Temp/SpO2 are scalars — only show them if their timestamp is within the period.
  const tempInPeriod = latestTempC != null && (latestTempTs ? isInPeriodMs(latestTempTs) : period === 'Daily' || period === 'Overall');
  const spo2InPeriod = latestSpo2 != null && (latestSpo2Ts ? isInPeriodMs(latestSpo2Ts) : period === 'Daily' || period === 'Overall');

  const latestBp = filteredBp.length > 0 ? filteredBp[filteredBp.length - 1] : null;
  const latestGlucose = filteredGlucose.length > 0 ? filteredGlucose[filteredGlucose.length - 1] : null;

  const bpStatus = latestBp ? evaluateBloodPressure({ sys: latestBp.sys, dia: latestBp.dia }) : null;
  const glucoseStatus = latestGlucose ? evaluateGlucose({ mgdl: latestGlucose.mgdl }) : null;
  const tempStatus = latestTempC != null ? evaluateTemperature({ celsius: latestTempC }) : null;
  const spo2Status = latestSpo2 != null ? evaluateSpO2({ spo2: latestSpo2 }) : null;

  const nowBkk = new Date(Date.now() + BKK_OFFSET_MS);

  const dateLabelForPeriod = (() => {
    const locale = lang === 'th' ? 'th-TH' : 'en-US';
    const fmtLong = (d: Date) =>
      d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const fmtShort = (d: Date) =>
      d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });

    if (period === 'Weekly') {
      // Sun-Sat calendar week containing today
      const dow = nowBkk.getUTCDay(); // 0=Sunday
      const sunBkk = new Date(nowBkk);
      sunBkk.setUTCDate(sunBkk.getUTCDate() - dow);
      const satBkk = new Date(sunBkk);
      satBkk.setUTCDate(sunBkk.getUTCDate() + 6);
      return `${fmtShort(sunBkk)} — ${fmtShort(satBkk)}`;
    }
    if (period === 'Monthly') {
      const first = new Date(Date.UTC(nowBkk.getUTCFullYear(), nowBkk.getUTCMonth(), 1));
      return `${fmtShort(first)} — ${fmtShort(nowBkk)}`;
    }
    if (period === 'Latest') {
      return t(lang, 'showing_latest_available');
    }
    if (period === 'Overall') {
      return lang === 'th' ? 'ข้อมูลทั้งหมดที่มี' : 'All recorded data';
    }
    return fmtLong(nowBkk);
  })();

  const headerTitle = isDaily
    ? t(lang, 'todays_summary')
    : period === 'Latest'
      ? t(lang, 'latest_summary')
    : period === 'Weekly'
      ? t(lang, 'this_weeks_summary')
      : period === 'Monthly'
        ? t(lang, 'this_months_summary')
        : t(lang, 'overall_summary');

  const readingsLabelKey = isDaily ? 'time_today' : period === 'Weekly' ? 'time_this_week' : period === 'Monthly' ? 'time_this_month' : 'time_all_time';

  // Build current rows from available data
  const currentRows = useMemo<RowData[]>(() => [
    latestBp && {
      key: 'bp',
      icon: require('../../../../assets/android-res/drawable/pressure.png'),
      label: t(lang, 'blood_pressure'),
      value: `${latestBp.sys}/${latestBp.dia} mmHg`,
      sub: filteredBp.length > 1 ? `${filteredBp.length} ${t(lang, 'readings')} ${t(lang, readingsLabelKey)}` : filteredBp.length === 1 ? `1 ${t(lang, 'reading')} ${t(lang, readingsLabelKey)}` : undefined,
      status: bpStatus,
      count: filteredBp.length > 0 ? filteredBp.length : undefined,
    },
    latestGlucose && {
      key: 'glucose',
      icon: require('../../../../assets/android-res/drawable/glucose.png'),
      label: t(lang, 'blood_glucose'),
      value: `${latestGlucose.mgdl} mg/dL`,
      sub: filteredGlucose.length > 1 ? `${filteredGlucose.length} ${t(lang, 'readings')} ${t(lang, readingsLabelKey)}` : filteredGlucose.length === 1 ? `1 ${t(lang, 'reading')} ${t(lang, readingsLabelKey)}` : undefined,
      status: glucoseStatus,
      count: filteredGlucose.length > 0 ? filteredGlucose.length : undefined,
    },
    latestTempC != null && tempInPeriod && {
      key: 'temp',
      icon: require('../../../../assets/android-res/drawable/temperature.png'),
      label: t(lang, 'temperature'),
      value: `${latestTempC.toFixed(1)}°C`,
      sub: undefined,
      status: tempStatus,
      count: undefined,
    },
    latestSpo2 != null && spo2InPeriod && {
      key: 'spo2',
      icon: require('../../../../assets/android-res/drawable/spo2.png'),
      label: t(lang, 'oxygen_spo2'),
      value: `${Math.round(latestSpo2)}%`,
      sub: latestPulse != null ? `${Math.round(latestPulse)} bpm` : undefined,
      status: spo2Status,
      count: undefined,
    },
  ].filter(Boolean) as RowData[], [latestBp, latestGlucose, latestTempC, latestSpo2, latestPulse, bpStatus, glucoseStatus, tempStatus, spo2Status, tempInPeriod, spo2InPeriod, filteredBp.length, filteredGlucose.length, lang, readingsLabelKey]);

  // currentRows drives rendering directly — no intermediate state, no render-cycle gap.
  const hasAnyData = currentRows.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Image
          source={require('../../../../assets/android-res/drawable/rhythm.png')}
          style={styles.headerIcon}
          resizeMode="contain"
        />
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerDate}>{dateLabelForPeriod}</Text>
        </View>
      </View>

      {hasAnyData ? (
        <View style={styles.metricsContainer}>
          {currentRows.map((row, idx) => (
            <AnimatedMetricRow
              key={`${period}-${row.key}`}
              rowData={row}
              showDivider={idx > 0}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t(lang, 'no_readings_recorded')} {t(lang, readingsLabelKey)}</Text>
          <Text style={styles.emptyHint}>{t(lang, 'connect_device_start')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + Spacing.xs,
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 22,
    height: 22,
    tintColor: Colors.textSubtle,
  },
  headerTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  headerCopy: {
    flex: 1,
  },
  headerDate: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
    marginTop: 1,
  },
  metricsContainer: {
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + Spacing.xs,
    paddingVertical: Spacing.sm + Spacing.xs,
    gap: Spacing.sm + Spacing.xs,
  },
  metricIcon: {
    width: 18,
    height: 18,
  },
  metricIconDisabled: {
    tintColor: Colors.gray300,
  },
  metricMid: {
    flex: 1,
  },
  metricLabel: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textMuted,
  },
  metricSub: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    marginTop: 1,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricCount: {
    fontSize: 10,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
    marginBottom: 1,
  },
  metricValue: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
  },
  metricStatus: {
    fontSize: 10,
    fontWeight: Typography.weight.semibold,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginHorizontal: Spacing.md + Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl + Spacing.xs,
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
});
