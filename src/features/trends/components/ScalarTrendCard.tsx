import React from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { TrendPeriod } from '../../profiles/api/profileApi';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

export type ScalarTrendPoint = {
  ts: string;
  ts_ms?: number;
  value: number;
};

type Props = {
  title: string;
  points?: ScalarTrendPoint[];
  period: TrendPeriod;
  loading?: boolean;
  unit?: string;
  icon: any;
  iconTint?: string;
  iconColors?: [string, string];
  lineColor?: string;
  statusLabel?: string | null;
  statusColor?: string;
  noDataText?: string;
  latestMeta?: string | null;
  valueFormatter?: (value: number) => string;
  thresholds?: Array<{
    key: string;
    value: number;
    label: string;
    color: string;
  }>;
};

type PlotPoint = {
  x: number;
  y: number;
};

const CHART_HEIGHT = 188;
const VPAD = 16;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcDate(input: string): Date {
  const raw = String(input || '').trim();
  if (!raw) return new Date(NaN);

  let normalized = raw.replace(' ', 'T');
  if (/^[\d]{4}-[\d]{2}-[\d]{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  }
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`;
  }
  if (/[+-]\d{4}$/.test(normalized)) {
    normalized = `${normalized.slice(0, -5)}${normalized.slice(-5, -2)}:${normalized.slice(-2)}`;
  }

  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  if (!hasTz) {
    normalized = `${normalized}Z`;
  }

  return new Date(normalized);
}

function pointDate(ts: string, tsMs?: number): Date {
  if (typeof tsMs === 'number' && Number.isFinite(tsMs) && tsMs > 0) {
    return new Date(tsMs);
  }
  return parseUtcDate(ts);
}

function buildCatmullRomPath(points: PlotPoint[], clampY?: [number, number]): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = index === 0 ? points[0] : points[index - 1];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = index + 2 < points.length ? points[index + 2] : points[points.length - 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;

    if (clampY) {
      cp1y = Math.max(clampY[0], Math.min(clampY[1], cp1y));
      cp2y = Math.max(clampY[0], Math.min(clampY[1], cp2y));
    }

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

function formatTick(ts: string, period: TrendPeriod, tsMs: number | undefined, lang: 'en' | 'th', preferTime = false): string {
  const date = pointDate(ts, tsMs);
  if (Number.isNaN(date.getTime())) return '';

  if (period === 'Daily' || preferTime) {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  if (period === 'Weekly') {
    return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { weekday: 'short', timeZone: 'UTC' });
  }

  return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Points are already filtered by the backend for the selected period.
// Just validate, sort, and cap for display.
function filterPointsByPeriod(points: ScalarTrendPoint[], period: TrendPeriod): ScalarTrendPoint[] {
  const filtered = points
    .filter((point) => Number.isFinite(point.value) && point.value > 0)
    .sort((left, right) => pointDate(left.ts, left.ts_ms).getTime() - pointDate(right.ts, right.ts_ms).getTime());

  const maxPoints = period === 'Overall' ? 50 : 200;
  return filtered.slice(-maxPoints);
}

export default function ScalarTrendCard({
  title,
  points = [],
  period,
  loading = false,
  unit,
  icon,
  iconTint = Colors.info,
  iconColors = [`${iconTint}1A`, Colors.surface],
  lineColor = iconTint,
  statusLabel,
  statusColor = lineColor,
  noDataText,
  latestMeta,
  valueFormatter,
  thresholds = [],
}: Props) {
  const { lang } = useLanguage();
  const [chartWidth, setChartWidth] = React.useState(0);

  const normalized = React.useMemo(() => filterPointsByPeriod(points, period), [period, points]);
  const latestPoint = normalized.length > 0 ? normalized[normalized.length - 1] : null;

  const plot = React.useMemo(() => {
    if (chartWidth <= 0 || normalized.length === 0) {
      return {
        labels: [] as Array<{ x: number; text: string }>,
        points: [] as PlotPoint[],
        path: '',
        thresholds: [] as Array<{ key: string; y: number; label: string; color: string }>,
      };
    }

    const values = normalized.map((point) => point.value).concat(thresholds.map((threshold) => threshold.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.5, (max - min) * 0.15);
    const domainMin = Math.max(0, min - pad);
    const domainMax = max + pad;
    const range = Math.max(1, domainMax - domainMin);
    const usableH = Math.max(1, CHART_HEIGHT - VPAD * 2);

    const toX = (index: number) => (
      normalized.length === 1 ? chartWidth / 2 : (index / (normalized.length - 1)) * chartWidth
    );
    const toY = (value: number) => VPAD + usableH - ((value - domainMin) / range) * usableH;

    const chartPoints = normalized.map((point, index) => ({
      x: toX(index),
      y: toY(point.value),
    }));

    const spanMs = Math.max(0, pointDate(normalized[normalized.length - 1].ts, normalized[normalized.length - 1].ts_ms).getTime() - pointDate(normalized[0].ts, normalized[0].ts_ms).getTime());
    const preferTime = period === 'Overall' && spanMs < DAY_MS;
    const labelIndexes = Array.from(new Set([
      0,
      Math.floor((normalized.length - 1) / 2),
      normalized.length - 1,
    ]));
    const labels = labelIndexes.map((index) => ({
      x: toX(index),
      text: formatTick(normalized[index].ts, period, normalized[index].ts_ms, lang, preferTime),
    }));
    const thresholdLines = thresholds.map((threshold) => ({
      key: threshold.key,
      y: toY(threshold.value),
      label: threshold.label,
      color: threshold.color,
    }));

    return {
      labels,
      points: chartPoints,
      path: buildCatmullRomPath(chartPoints, [VPAD, VPAD + usableH]),
      thresholds: thresholdLines,
    };
  }, [chartWidth, lang, normalized, period, thresholds]);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  const formatValue = React.useCallback((value: number) => {
    if (valueFormatter) return valueFormatter(value);
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }, [valueFormatter]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={iconColors} style={styles.iconBadge}>
            <Image source={icon} style={[styles.icon, { tintColor: iconTint }]} resizeMode="contain" />
          </LinearGradient>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {statusLabel ? (
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {latestPoint ? (
        <View style={styles.valueBlock}>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: lineColor }]}>
              {formatValue(latestPoint.value)}
            </Text>
            {unit ? (
              <Text style={[styles.unit, { color: lineColor }]}>{unit}</Text>
            ) : null}
          </View>
          {latestMeta ? <Text style={styles.metaText}>{latestMeta}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.helperText}>{t(lang, 'chart_loading')}</Text>
      ) : normalized.length === 0 ? (
        <Text style={styles.helperText}>{noDataText || t(lang, 'no_data_available')}</Text>
      ) : (
        <View style={styles.chartOuter}>
          <View style={styles.chartInner} onLayout={onLayout}>
            <Svg width="100%" height={CHART_HEIGHT}>
              <Rect
                x={0}
                y={0}
                width={chartWidth}
                height={CHART_HEIGHT}
                rx={18}
                fill={Colors.surfaceMuted}
              />

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = VPAD + (CHART_HEIGHT - VPAD * 2) * ratio;
                return (
                  <Line
                    key={`grid-${ratio}`}
                    x1={0}
                    x2={chartWidth}
                    y1={y}
                    y2={y}
                    stroke={Colors.borderSoft}
                    strokeWidth={1}
                  />
                );
              })}

              {plot.thresholds.map((threshold) => (
                <React.Fragment key={threshold.key}>
                  <Line
                    x1={0}
                    x2={chartWidth}
                    y1={threshold.y}
                    y2={threshold.y}
                    stroke={threshold.color}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    opacity={0.45}
                  />
                  <SvgText
                    x={Math.max(0, chartWidth - 6)}
                    y={Math.max(12, threshold.y - 6)}
                    fill={threshold.color}
                    fontSize={10}
                    fontWeight="700"
                    textAnchor="end"
                    opacity={0.85}
                  >
                    {threshold.label}
                  </SvgText>
                </React.Fragment>
              ))}

              {plot.path ? (
                <Path
                  d={plot.path}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ) : null}

              {plot.labels.map((label, index) => (
                <SvgText
                  key={`${label.text}-${index}`}
                  x={label.x}
                  y={CHART_HEIGHT - 6}
                  fill={Colors.textSubtle}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {label.text}
                </SvgText>
              ))}
            </Svg>
          </View>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    width: 22,
    height: 22,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
  },
  valueBlock: {
    marginTop: Spacing.lg,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  value: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  unit: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.xs,
  },
  metaText: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  helperText: {
    marginTop: Spacing.lg,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  chartOuter: {
    marginTop: Spacing.lg,
  },
  chartInner: {
    width: '100%',
    height: CHART_HEIGHT,
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
});
