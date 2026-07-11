import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, ClipPath, Rect, Line, Text as SvgText } from 'react-native-svg';
import type { BloodGlucoseTrendPoint, TrendPeriod } from '../../profiles/api/profileApi';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

type Props = {
  title?: string;
  points?: BloodGlucoseTrendPoint[];
  period: TrendPeriod;
  loading?: boolean;
  goal?: { value: number };
};

type PlotPoint = { x: number; y: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const GLUCOSE_LOW_THRESHOLD = 70;
const GLUCOSE_NORMAL_THRESHOLD = 99;
const GLUCOSE_GOOD_THRESHOLD = 125;

function parseUtcDate(input: string): Date {
  const raw = String(input || '').trim();
  if (!raw) return new Date(NaN);

  let normalized = raw.replace(' ', 'T');

  if (/^[\d]{4}-[\d]{2}-[\d]{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  }

  // Handle timezone suffix variations from backend/postgres.
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
  if (typeof tsMs === 'number' && Number.isFinite(tsMs)) {
    return new Date(tsMs);
  }
  return parseUtcDate(ts);
}

/** Build an SVG path string for a smooth Catmull-Rom curve through pts.
 * Uses the direct Catmull-Rom → cubic Bézier conversion, so only one
 * SVG <Path> is needed — fully anti-aliased, no View segment gaps.
 * clampY clamps the Bézier control-point Y values to [min, max] so the
 * curve never escapes the visible plot area when points jump sharply. */
function buildCatmullRomPath(pts: PlotPoint[], clampY?: [number, number]): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? pts[0] : pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < n ? pts[i + 2] : pts[n - 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    let cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    let cp2y = p2.y - (p3.y - p1.y) / 6;
    if (clampY) {
      cp1y = Math.max(clampY[0], Math.min(clampY[1], cp1y));
      cp2y = Math.max(clampY[0], Math.min(clampY[1], cp2y));
    }
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function formatTick(ts: string, period: TrendPeriod, tsMs?: number, preferTime = false): string {
  const d = pointDate(ts, tsMs);
  if (Number.isNaN(d.getTime())) return '';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (period === 'Daily' || preferTime) {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  if (period === 'Weekly') {
    return dayNames[d.getUTCDay()] || '';
  }

  if (period === 'Latest') {
    return `${monthNames[d.getUTCMonth()] || ''} ${d.getUTCDate()}`;
  }

  if (period === 'Overall') {
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${monthNames[d.getUTCMonth()] || ''} ${d.getUTCDate()} '${year}`;
  }

  return `${monthNames[d.getUTCMonth()] || ''} ${d.getUTCDate()}`;
}
export default function BloodGlucoseTrendCard({ title, points = [], period, loading = false, goal }: Props) {
  const { lang } = useLanguage();
  const cardTitle = title ?? t(lang, 'glucose_trends_title');
  const clipId = React.useRef(`clip-glucose-${Math.random().toString(36).slice(2)}`).current;
  const [plotSize, setPlotSize] = React.useState({ w: 0, h: 0 });

  // Points are already filtered by the backend for the selected period.
  // Just validate, sort, and cap for display.
  const normalized = React.useMemo(() => {
    const filtered = points
      .filter((p) => Number.isFinite(p.mgdl) && p.mgdl > 0)
      .sort((a, b) => pointDate(a.ts, a.ts_ms).getTime() - pointDate(b.ts, b.ts_ms).getTime());

    const maxPoints = period === 'Overall' ? 50 : period === 'Latest' ? 1 : 200;
    return filtered.slice(-maxPoints);
  }, [points, period]);

  const avg = React.useMemo(() => {
    if (!normalized.length) return null;
    const sum = normalized.reduce((acc, p) => acc + p.mgdl, 0);
    return Math.round(sum / normalized.length);
  }, [normalized]);

  const { plot, labels, thresholdLines, goalLine } = React.useMemo(() => {
    const emptyGoalLine: Array<{ key: string; y: number; color: string; label: string }> = [];
    if (!normalized.length || plotSize.w <= 0 || plotSize.h <= 0) {
      return {
        plot: [] as PlotPoint[],
        labels: [] as Array<{ x: number; text: string }>,
        thresholdLines: [] as Array<{ key: string; y: number; color: string; label: string }>,
        goalLine: emptyGoalLine,
      };
    }

    const goalVals = goal ? [goal.value] : [];
    const referenceVals = goal
      ? goalVals
      : [GLUCOSE_LOW_THRESHOLD, GLUCOSE_NORMAL_THRESHOLD, GLUCOSE_GOOD_THRESHOLD];
    const vals = normalized
      .map((p) => p.mgdl)
      .concat(referenceVals);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const pad = Math.max(12, Math.round((maxVal - minVal) * 0.15));
    const domainMin = Math.max(0, minVal - pad);
    const domainMax = maxVal + pad;
    const range = Math.max(1, domainMax - domainMin);

    const toX = (index: number) => {
      if (normalized.length === 1) return plotSize.w / 2;
      return (index / (normalized.length - 1)) * plotSize.w;
    };
    const VPAD = 14;
    const usableH = Math.max(1, plotSize.h - VPAD * 2);
    const toY = (value: number) => VPAD + usableH - ((value - domainMin) / range) * usableH;

    const p = normalized.map((item, i) => ({ x: toX(i), y: toY(item.mgdl) }));

    const spanMs = Math.max(0, pointDate(normalized[normalized.length - 1].ts, normalized[normalized.length - 1].ts_ms).getTime() - pointDate(normalized[0].ts, normalized[0].ts_ms).getTime());
    const preferTime = period === 'Overall' && spanMs < DAY_MS;
    const labelIndexes = Array.from(new Set([0, Math.floor((normalized.length - 1) / 2), normalized.length - 1]));
    const labelItems = labelIndexes.map((i) => ({ x: toX(i), text: formatTick(normalized[i].ts, period, normalized[i].ts_ms, preferTime) }));
    const thresholdItems = goal
      ? []
      : [
          { key: 'good', y: toY(GLUCOSE_GOOD_THRESHOLD), color: Colors.info, label: `${t(lang, 'chart_line_good')} ${GLUCOSE_GOOD_THRESHOLD}` },
          { key: 'normal', y: toY(GLUCOSE_NORMAL_THRESHOLD), color: Colors.success, label: `${t(lang, 'chart_line_normal')} ${GLUCOSE_NORMAL_THRESHOLD}` },
          { key: 'low', y: toY(GLUCOSE_LOW_THRESHOLD), color: Colors.warning, label: `${t(lang, 'chart_line_low')} ${GLUCOSE_LOW_THRESHOLD}` },
        ];

    const computedGoalLine = goal
      ? [{ key: 'goal', y: toY(goal.value), color: Colors.primary, label: `${t(lang, 'chart_line_goal')} ${goal.value}` }]
      : emptyGoalLine;

    return { plot: p, labels: labelItems, thresholdLines: thresholdItems, goalLine: computedGoalLine };
  }, [normalized, plotSize, period, goal, lang]);

  const lastPoint = normalized.length > 0 ? normalized[normalized.length - 1] : null;
  const statusLabel = lastPoint
    ? (lastPoint.mgdl >= 180 ? t(lang, 'status_high') : lastPoint.mgdl < 70 ? t(lang, 'status_low') : t(lang, 'metric_normal'))
    : null;
  const statusColor = lastPoint
    ? (lastPoint.mgdl >= 180 ? Colors.danger : lastPoint.mgdl < 70 ? Colors.warning : Colors.success)
    : Colors.success;

  return (
    <View style={styles.card}>
      {/* Header with icon badge */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[Colors.infoSoft, '#F4F8FF']}
            style={styles.iconBadge}
          >
            <Image
              source={require('../../../../assets/android-res/drawable/glucose.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </LinearGradient>
          <View>
            <Text style={styles.title}>{cardTitle}</Text>
            {statusLabel && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            )}
          </View>
        </View>
        {goal ? (
          <View style={styles.avgBox}>
            <Text style={styles.avgValue}>{goal.value}</Text>
            <Text style={styles.avgUnit}>{t(lang, 'mgdl_goal')}</Text>
          </View>
        ) : avg !== null ? (
          <View style={styles.avgBox}>
            <Text style={styles.avgValue}>{avg}</Text>
            <Text style={styles.avgUnit}>{t(lang, 'mgdl_avg')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
          <Text style={styles.legendText}>{t(lang, 'legend_glucose')}</Text>
        </View>
        <Text style={styles.pointCount}>
          {normalized.length} {normalized.length === 1 ? t(lang, 'reading') : t(lang, 'readings')}
        </Text>
      </View>

      <View style={styles.chartWrap}>
        <View style={[styles.gridRow, styles.gridRow25]} />
        <View style={[styles.gridRow, styles.gridRow50]} />
        <View style={[styles.gridRow, styles.gridRow75]} />

        {loading ? (
          <Text style={styles.placeholderText}>{t(lang, 'chart_loading')}</Text>
        ) : normalized.length === 0 ? (
          <Text style={styles.placeholderText}>{t(lang, 'no_glucose_data')}</Text>
        ) : (
          <>
            <View
              style={styles.plotArea}
              onLayout={(e) => {
                setPlotSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
              }}
            >
              {plotSize.w > 0 && plotSize.h > 0 && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Svg width={plotSize.w} height={plotSize.h}>
                    <Defs>
                      <ClipPath id={clipId}>
                        <Rect x={0} y={0} width={plotSize.w} height={plotSize.h} />
                      </ClipPath>
                    </Defs>
                    {thresholdLines.map((line) => (
                      <React.Fragment key={line.key}>
                        <Line
                          x1={0}
                          y1={line.y}
                          x2={plotSize.w}
                          y2={line.y}
                          stroke={line.color}
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          opacity={0.45}
                        />
                        <SvgText
                          x={plotSize.w - 6}
                          y={Math.max(12, line.y - 6)}
                          fill={line.color}
                          fontSize={10}
                          fontWeight="700"
                          textAnchor="end"
                          opacity={0.85}
                        >
                          {line.label}
                        </SvgText>
                      </React.Fragment>
                    ))}
                    {goalLine.map((line) => (
                      <React.Fragment key={line.key}>
                        <Line
                          x1={0}
                          y1={line.y}
                          x2={plotSize.w}
                          y2={line.y}
                          stroke={line.color}
                          strokeWidth={2}
                          opacity={0.9}
                        />
                        <SvgText
                          x={plotSize.w - 6}
                          y={Math.max(12, line.y - 6)}
                          fill={line.color}
                          fontSize={10}
                          fontWeight="700"
                          textAnchor="end"
                          opacity={0.9}
                        >
                          {line.label}
                        </SvgText>
                      </React.Fragment>
                    ))}
                    <Path d={buildCatmullRomPath(plot, [0, plotSize.h])} stroke={Colors.info} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clipId})`} />
                  </Svg>
                </View>
              )}
            </View>

            <View style={styles.labelsRow}>
              {labels.map((l, i) => (
                <Text key={`lbl-${i}`} style={[styles.labelText, { left: Math.max(0, l.x - 18) }]}>
                  {l.text}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
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
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  title: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.semibold,
  },
  avgBox: {
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  avgValue: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  avgUnit: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  icon: {
    width: 24,
    height: 24,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm + Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
  },
  pointCount: {
    marginLeft: 'auto',
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  chartWrap: {
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 28,
  },
  plotArea: {
    width: '100%',
    height: '100%',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.borderSoft,
    opacity: 1,
  },
  gridRow25: { top: '25%' },
  gridRow50: { top: '50%' },
  gridRow75: { top: '75%' },
  placeholderText: {
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },

  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 5,
  },
  dotSelected: {
    borderWidth: 2,
    borderColor: Colors.surface,
    zIndex: 10,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.sm - Spacing.xxs,
    zIndex: 20,
    alignItems: 'center',
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
  },
  tooltipValue: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  tooltipTime: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
    marginTop: 2,
  },
  labelsRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 6,
    height: 18,
  },
  labelText: {
    position: 'absolute',
    fontSize: 10,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
  },
});
