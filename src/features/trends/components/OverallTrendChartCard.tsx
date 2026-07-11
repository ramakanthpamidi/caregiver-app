import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Line, Path, Rect } from 'react-native-svg';
import type {
  BloodGlucoseTrendPoint,
  BloodPressureTrendPoint,
  SpO2TrendPoint,
  TemperatureTrendPoint,
} from '../../profiles/api/profileApi';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

type Props = {
  bpPoints?: BloodPressureTrendPoint[];
  glucosePoints?: BloodGlucoseTrendPoint[];
  tempPoints?: TemperatureTrendPoint[];
  spo2Points?: SpO2TrendPoint[];
  loading?: boolean;
};

type ScorePoint = {
  ts: string;
  ts_ms: number;
  score: number;
};

type PlotPoint = {
  x: number;
  y: number;
};

const CHART_HEIGHT = 196;
const VPAD = 16;
const MAX_OVERVIEW_POINTS = 40;
const MAX_RECENT_POINTS_PER_METRIC = 10;
const OVERALL_LINE_COLOR = '#2ab6d7';
const OVERALL_FILL_COLOR = 'rgba(42,182,215,0.18)';

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

function toPointTsMs(point: { ts: string; ts_ms?: number }): number {
  const tsMs = Number(point.ts_ms);
  if (Number.isFinite(tsMs) && tsMs > 0) return tsMs;
  const parsed = parseUtcDate(String(point.ts || '')).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * clamp01(ratio);
}

function distanceToRange(value: number, min: number, max: number): number {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function scoreBloodPressureSystolic(sys: number): number {
  if (!Number.isFinite(sys) || sys <= 0) return 0;
  if (sys < 90) return lerp(0, 30, (sys - 60) / 30);
  if (sys < 120) return lerp(80, 100, (sys - 90) / 30);
  if (sys < 130) return lerp(80, 60, (sys - 120) / 10);
  if (sys < 140) return lerp(60, 30, (sys - 130) / 10);
  return lerp(30, 0, (sys - 140) / 60);
}

function scoreBloodPressureDiastolic(dia: number): number {
  if (!Number.isFinite(dia) || dia <= 0) return 0;
  if (dia < 60) return lerp(0, 30, (dia - 40) / 20);
  if (dia < 80) return lerp(80, 100, (dia - 60) / 20);
  if (dia < 90) return lerp(60, 30, (dia - 80) / 10);
  return lerp(30, 0, (dia - 90) / 40);
}

function scoreBloodPressure(sys: number, dia: number): { baseScore: number; distance: number } | null {
  if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia <= 0) return null;
  const sysScore = scoreBloodPressureSystolic(Number(sys));
  const diaScore = scoreBloodPressureDiastolic(Number(dia));
  const baseScore = Math.min(sysScore, diaScore);
  const distance = distanceToRange(Number(sys), 90, 120) + distanceToRange(Number(dia), 60, 80);
  return { baseScore: clampScore(baseScore), distance };
}

function scoreGlucose(mgdl: number): { baseScore: number; distance: number } | null {
  if (!Number.isFinite(mgdl) || mgdl <= 0) return null;
  let baseScore = 0;
  if (mgdl < 70) {
    baseScore = lerp(0, 30, (mgdl - 40) / 30);
  } else if (mgdl < 100) {
    baseScore = lerp(80, 100, (mgdl - 70) / 30);
  } else if (mgdl < 126) {
    baseScore = lerp(80, 60, (mgdl - 100) / 26);
  } else if (mgdl <= 180) {
    baseScore = lerp(60, 30, (mgdl - 126) / 54);
  } else {
    baseScore = lerp(30, 0, (mgdl - 180) / 80);
  }
  return {
    baseScore: clampScore(baseScore),
    distance: distanceToRange(Number(mgdl), 70, 100),
  };
}

function scoreTemperature(celsius: number): { baseScore: number; distance: number } | null {
  if (!Number.isFinite(celsius) || celsius <= 0) return null;
  let baseScore = 0;
  if (celsius < 35) {
    baseScore = lerp(0, 30, (celsius - 33) / 2);
  } else if (celsius < 35.5) {
    baseScore = lerp(30, 50, (celsius - 35) / 0.5);
  } else if (celsius < 36.1) {
    baseScore = lerp(50, 75, (celsius - 35.5) / 0.6);
  } else if (celsius <= 37.2) {
    const center = 36.65;
    const distanceFromCenter = Math.abs(celsius - center);
    baseScore = 100 - clamp01(distanceFromCenter / 0.55) * 25;
  } else if (celsius <= 37.7) {
    baseScore = lerp(75, 50, (celsius - 37.2) / 0.5);
  } else if (celsius <= 38.5) {
    baseScore = lerp(50, 30, (celsius - 37.7) / 0.8);
  } else {
    baseScore = lerp(30, 0, (celsius - 38.5) / 1.5);
  }
  return {
    baseScore: clampScore(baseScore),
    distance: distanceToRange(Number(celsius), 36.1, 37.2),
  };
}

function scoreSpo2(spo2: number): { baseScore: number; distance: number } | null {
  if (!Number.isFinite(spo2) || spo2 <= 0) return null;
  let baseScore = 0;
  if (spo2 < 90) {
    baseScore = lerp(0, 30, (spo2 - 80) / 10);
  } else if (spo2 < 95) {
    baseScore = lerp(30, 60, (spo2 - 90) / 5);
  } else if (spo2 < 98) {
    baseScore = lerp(60, 80, (spo2 - 95) / 3);
  } else if (spo2 <= 100) {
    baseScore = lerp(80, 100, (spo2 - 98) / 2);
  } else {
    baseScore = 100;
  }
  return {
    baseScore: clampScore(baseScore),
    distance: distanceToRange(Number(spo2), 98, 100),
  };
}

function normalizeScorePoints<T extends { ts: string; ts_ms?: number }>(
  points: T[],
  getMetric: (point: T) => { baseScore: number; distance: number } | null
): ScorePoint[] {
  const normalized = points
    .map((point) => {
      const metric = getMetric(point);
      const ts_ms = toPointTsMs(point);
      if (!metric || !ts_ms) return null;
      return {
        ts: String(point.ts || new Date(ts_ms).toISOString()),
        ts_ms,
        baseScore: clampScore(Number(metric.baseScore)),
        distance: Math.max(0, Number(metric.distance) || 0),
      };
    })
    .filter((point): point is ScorePoint => point != null)
    .sort((left, right) => left.ts_ms - right.ts_ms)
    .slice(-MAX_RECENT_POINTS_PER_METRIC) as Array<{ ts: string; ts_ms: number; baseScore: number; distance: number }>;

  if (!normalized.length) return [];

  const baselineDistance = Math.max(normalized[0].distance, 1);

  return normalized.map((point) => {
    const improvementRatio = clamp01((baselineDistance - point.distance) / baselineDistance);
    const worseningRatio = clamp01((point.distance - baselineDistance) / baselineDistance);
    const trendBoost = (improvementRatio * 35) - (worseningRatio * 35);
    return {
      ts: point.ts,
      ts_ms: point.ts_ms,
      score: clampScore(point.baseScore + trendBoost),
    };
  });
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

function buildAreaPath(linePath: string, points: PlotPoint[], baselineY: number): string {
  if (!linePath || points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function averageAvailableScores(seriesList: ScorePoint[][], tsMs: number): number | null {
  if (seriesList.length === 0) return null;

  const scores = seriesList.map((series) => {
    let latestScore = series[0].score;
    for (const point of series) {
      if (point.ts_ms > tsMs) break;
      latestScore = point.score;
    }
    return latestScore;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scorePillColors(score: number) {
  if (score >= 88) return { background: Colors.infoSoft, text: Colors.info };
  if (score >= 63) return { background: Colors.successSoft, text: Colors.success };
  if (score >= 38) return { background: Colors.warningSoft, text: Colors.warning };
  return { background: Colors.dangerSoft, text: Colors.danger };
}

export default function OverallTrendChartCard({
  bpPoints = [],
  glucosePoints = [],
  tempPoints = [],
  spo2Points = [],
  loading = false,
}: Props) {
  const { lang } = useLanguage();
  const [chartWidth, setChartWidth] = React.useState(0);
  const clipId = React.useRef(`overall-trend-clip-${Math.random().toString(36).slice(2)}`).current;

  const metricSeries = React.useMemo(() => {
    const bp = normalizeScorePoints(bpPoints, (point) => scoreBloodPressure(Number(point.sys), Number(point.dia)));
    const glucose = normalizeScorePoints(glucosePoints, (point) => scoreGlucose(Number(point.mgdl)));
    const temp = normalizeScorePoints(tempPoints, (point) => scoreTemperature(Number(point.celsius)));
    const spo2 = normalizeScorePoints(spo2Points, (point) => scoreSpo2(Number(point.spo2)));

    return [bp, glucose, temp, spo2].filter((series) => series.length > 0);
  }, [bpPoints, glucosePoints, tempPoints, spo2Points]);

  const overallSeries = React.useMemo<ScorePoint[]>(() => {
    if (metricSeries.length === 0) return [];

    const timeline = Array.from(
      new Set(metricSeries.flatMap((series) => series.map((point) => point.ts_ms)))
    )
      .sort((left, right) => left - right)
      .slice(-MAX_OVERVIEW_POINTS);

    const commonStartTs = Math.max(...metricSeries.map((series) => series[0].ts_ms));
    const weightedTimeline = timeline.filter((ts) => ts >= commonStartTs);
    const effectiveTimeline = weightedTimeline.length > 0 ? weightedTimeline : timeline;

    return effectiveTimeline
      .slice(-MAX_OVERVIEW_POINTS)
      .map((ts_ms) => {
        const score = averageAvailableScores(metricSeries, ts_ms);
        if (score == null) return null;
        return {
          ts: new Date(ts_ms).toISOString(),
          ts_ms,
          score: clampScore(Number(score)),
        };
      })
      .filter((point): point is ScorePoint => point != null);
  }, [metricSeries]);

  const latestScore = overallSeries.length > 0 ? overallSeries[overallSeries.length - 1].score : null;
  const pillColors = latestScore != null ? scorePillColors(latestScore) : null;

  const plot = React.useMemo(() => {
    if (chartWidth <= 0 || overallSeries.length === 0) {
      return {
        points: [] as PlotPoint[],
        path: '',
        areaPath: '',
      };
    }

    const usableH = Math.max(1, CHART_HEIGHT - VPAD * 2);
    const toX = (index: number) => (
      overallSeries.length <= 1 ? chartWidth / 2 : (index / (overallSeries.length - 1)) * chartWidth
    );
    const toY = (score: number) => VPAD + usableH - (score / 100) * usableH;
    const baselineY = VPAD + usableH;

    const points = overallSeries.map((point, index) => ({
      x: toX(index),
      y: toY(point.score),
    }));

    const path = buildCatmullRomPath(points, [VPAD, VPAD + usableH]);

    return {
      points,
      path,
      areaPath: buildAreaPath(path, points, baselineY),
    };
  }, [chartWidth, overallSeries]);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t(lang, 'overall_trend')}</Text>
          <Text style={styles.subtitle}>{t(lang, 'overall_trend_hint')}</Text>
        </View>
        <View style={[styles.tag, pillColors ? { backgroundColor: pillColors.background } : null]}>
          <Text style={[styles.tagText, pillColors ? { color: pillColors.text } : null]}>
            {latestScore != null ? `${Math.round(latestScore)}%` : t(lang, 'time_all_time')}
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.helperText}>{t(lang, 'chart_loading')}</Text>
      ) : overallSeries.length === 0 ? (
        <Text style={styles.helperText}>{t(lang, 'no_data_available')}</Text>
      ) : (
        <View style={styles.chartOuter}>
          <View style={styles.chartInner} onLayout={onLayout}>
            <Svg width="100%" height={CHART_HEIGHT}>
              <Defs>
                <ClipPath id={clipId}>
                  <Rect x={0} y={0} width={chartWidth} height={CHART_HEIGHT} rx={18} />
                </ClipPath>
              </Defs>

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

              {plot.areaPath ? (
                <Path
                  d={plot.areaPath}
                  fill={OVERALL_FILL_COLOR}
                  stroke="none"
                  clipPath={`url(#${clipId})`}
                />
              ) : null}

              {plot.path ? (
                <Path
                  d={plot.path}
                  fill="none"
                  stroke={OVERALL_LINE_COLOR}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  clipPath={`url(#${clipId})`}
                />
              ) : null}

              {plot.points.length === 1 ? (
                <Circle
                  cx={plot.points[0].x}
                  cy={plot.points[0].y}
                  r={5}
                  fill={OVERALL_LINE_COLOR}
                />
              ) : null}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  tag: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    backgroundColor: Colors.secondarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tagText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.secondary,
    fontWeight: Typography.weight.bold,
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
  helperText: {
    marginTop: Spacing.lg,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
});
