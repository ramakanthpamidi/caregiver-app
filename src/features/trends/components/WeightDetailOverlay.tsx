import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import WeightBmiTile from './WeightBmiTile';
import {
  useWeightBmiHistory,
  evaluateBmi,
  type LatestWeightBmi,
  type WeightPoint,
} from '../lib/weightBmi';
import { getStatusColor } from '../../../shared/lib/healthThresholds';
import {
  BorderWidth,
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '../../../shared/theme/theme';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Period = 'Overall' | 'Daily' | 'Weekly' | 'Monthly';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'Overall', label: 'overall' },
  { key: 'Daily', label: 'daily' },
  { key: 'Weekly', label: 'weekly' },
  { key: 'Monthly', label: 'monthly' },
];

function cutoffFor(period: Period): number {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  if (period === 'Daily') return now - day;
  if (period === 'Weekly') return now - 7 * day;
  if (period === 'Monthly') return now - 30 * day;
  return 0;
}

function BmiChart({ points }: { points: WeightPoint[] }) {
  const { lang } = useLanguage();
  const series = points.filter((p) => p.bmi != null) as (WeightPoint & { bmi: number })[];
  const W = 320;
  const H = 150;
  const padX = 16;
  const padY = 20;

  if (series.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>{t(lang, 'weight_bmi_trend_empty')}</Text>
      </View>
    );
  }

  const xs = series.map((p) => p.ts);
  const ys = series.map((p) => p.bmi);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys) - 1;
  const maxY = Math.max(...ys) + 1;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const coords = series.map((p) => ({
    x: padX + ((p.ts - minX) / spanX) * (W - padX * 2),
    y: padY + (1 - (p.bmi - minY) / spanY) * (H - padY * 2),
    color: getStatusColor(evaluateBmi(p.bmi)),
  }));

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke={Colors.border} strokeWidth={1} />
      <SvgText x={padX} y={padY - 6} fontSize={10} fill={Colors.textSubtle}>
        {maxY.toFixed(0)}
      </SvgText>
      <SvgText x={padX} y={H - padY + 12} fontSize={10} fill={Colors.textSubtle}>
        {minY.toFixed(0)}
      </SvgText>
      <Polyline
        points={coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={Colors.primary}
        strokeWidth={2}
      />
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={3} fill={c.color} />
      ))}
    </Svg>
  );
}

/**
 * Weight & BMI history (SpO2-style).
 *
 * mode="page"  — replaces the host screen (Home). No blue header underneath.
 * mode="overlay" — absolute cover for Trends list.
 */
export default function WeightDetailOverlay({
  visible,
  onClose,
  profileId,
  latest,
  mode = 'overlay',
}: {
  visible: boolean;
  onClose: () => void;
  profileId: number | null;
  latest: LatestWeightBmi | null;
  mode?: 'page' | 'overlay';
}) {
  const { lang } = useLanguage();
  const [period, setPeriod] = useState<Period>('Overall');
  const history = useWeightBmiHistory(visible ? profileId : null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const filtered = useMemo(() => {
    const c = cutoffFor(period);
    return history.filter((p) => p.ts >= c);
  }, [history, period]);

  const close = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (visible) setPeriod('Overall');
  }, [visible]);

  // Android system back button + edge back-swipe. Registered LIFO, so this runs
  // before the app shell's handler and closes the detail instead of navigating.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={mode === 'page' ? styles.page : styles.overlay} pointerEvents="auto">
      <SafeAreaView style={styles.safe} edges={mode === 'page' ? ['top'] : ['top']}>
        {/* Fixed header — always visible, not inside ScrollView */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.overline}>{t(lang, 'health_trends')}</Text>
            <Text style={styles.title}>{t(lang, 'weight_bmi_trend_title')}</Text>
            <Text style={styles.subtitle}>{t(lang, 'time_period')}</Text>
          </View>
          <Pressable
            style={styles.backBtn}
            onPress={close}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t(lang, 'back')}
          >
            <Text style={styles.backText}>{t(lang, 'back')}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.hero}>
            <WeightBmiTile latest={latest} />
          </View>

          <View style={styles.periodCard}>
            <View style={styles.periodHeader}>
              <Text style={styles.periodTitle}>{t(lang, 'time_period')}</Text>
              <Image
                source={require('../../../../assets/android-res/drawable/calendar.png')}
                style={styles.calendarIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.periodSwitch}>
              {PERIODS.map((p) => {
                const active = period === p.key;
                return (
                  <Pressable
                    key={p.key}
                    style={[styles.periodTab, active && styles.periodTabActive]}
                    onPress={() => setPeriod(p.key)}
                  >
                    <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                      {t(lang, p.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {`${t(lang, 'bmi_label')} · ${t(lang, 'weight_scale')}`}
            </Text>
            <BmiChart points={filtered} />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 10000,
    elevation: 10000,
  },
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  headerText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  overline: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSubtle,
  },
  backBtn: {
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  hero: {
    marginBottom: Spacing.lg,
  },
  periodCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  periodTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  calendarIcon: {
    width: 22,
    height: 22,
    tintColor: Colors.textSubtle,
  },
  periodSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 999,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: Colors.surface,
    ...Shadows.soft,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSubtle,
  },
  periodTabTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadows.soft,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  chartEmpty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    fontSize: 12,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: Layout.bottomTabHeight + Spacing.sm,
  },
});
