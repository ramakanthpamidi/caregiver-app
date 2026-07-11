import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { StyleSheet } from 'react-native';
import { Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

export const HOME_STATUS_COLORS = {
  excellent: Colors.info,
  excellentSoft: Colors.infoSoft,
  normal: Colors.success,
  normalSoft: Colors.successSoft,
  warning: Colors.warning,
  warningSoft: Colors.warningSoft,
  alert: Colors.danger,
  alertSoft: Colors.dangerSoft,
  muted: Colors.gray400,
  mutedStrong: Colors.gray500,
  mutedSoft: Colors.gray300,
} as const;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: Spacing.lg,
    position: 'relative',
    ...Shadows.soft,
  },
  containerLocked: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  title: {
    fontSize: Typography.size.xl,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: 2,
  },
  titleDisabled: {
    color: Colors.textSubtle,
  },
  trendIconDisabled: {
    opacity: 0.45,
  },
  lockedMessage: {
    fontSize: 14,
    color: Colors.textSubtle,
    fontWeight: '700',
    marginTop: 6,
  },
  lockedHint: {
    fontSize: 12,
    color: Colors.textDisabled,
    fontWeight: '600',
    marginTop: 6,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(243,244,246,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    width: 44,
    height: 44,
    tintColor: Colors.textSubtle,
  },
  trendIcon: {
    width: 32,
    height: 32,
    tintColor: Colors.textSubtle,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeExcellent: {
    backgroundColor: HOME_STATUS_COLORS.excellentSoft,
  },
  badgeGood: {
    backgroundColor: HOME_STATUS_COLORS.normalSoft,
  },
  badgeWarning: {
    backgroundColor: HOME_STATUS_COLORS.warningSoft,
  },
  badgeAlert: {
    backgroundColor: HOME_STATUS_COLORS.alertSoft,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextExcellent: {
    color: HOME_STATUS_COLORS.excellent,
  },
  badgeTextGood: {
    color: HOME_STATUS_COLORS.normal,
  },
  badgeTextWarning: {
    color: HOME_STATUS_COLORS.warning,
  },
  badgeTextAlert: {
    color: HOME_STATUS_COLORS.alert,
  },
  message: {
    fontSize: 14,
    color: Colors.textSubtle,
    lineHeight: 20,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 12,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textSubtle,
    marginBottom: 2,
  },
  metricStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
});


export type HealthStatus =
  | 'Excellent'
  | 'Normal'
  | 'Warning'
  | 'Alert'
  | 'No Device'
  | 'Waiting';

export type MetricItem = {
  label: string;
  status: HealthStatus;
};

export type HealthTrendWidgetProps = {
  overallStatus?: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'ALERT';
  message?: string;
  metrics?: MetricItem[];
  locked?: boolean;
  onPress?: () => void;
};

const defaultHealthMetrics: MetricItem[] = [
  { label: 'Blood Pressure', status: 'No Device' },
  { label: 'Blood Sugar', status: 'No Device' },
  { label: 'Temperature', status: 'No Device' },
  { label: 'Oxygen Level', status: 'No Device' },
];

const HealthTrendWidget = React.memo(function HealthTrendWidget({
  overallStatus = 'GOOD',
  message = 'Your health metrics are within normal range today',
  metrics = defaultHealthMetrics,
  locked = false,
  onPress,
}: HealthTrendWidgetProps) {
  const { lang } = useLanguage();

  const translateOverallStatus = (
    status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'ALERT',
  ) => {
    if (status === 'EXCELLENT') return t(lang, 'status_excellent');
    if (status === 'GOOD') return t(lang, 'status_good');
    if (status === 'WARNING') return t(lang, 'status_warning');
    if (status === 'ALERT') return t(lang, 'status_alert');
    return status;
  };

  const translateMetricLabel = (label: string) => {
    if (label === 'Blood Pressure') return t(lang, 'blood_pressure');
    if (label === 'Blood Sugar') return t(lang, 'blood_sugar');
    if (label === 'Temperature') return t(lang, 'temperature');
    if (label === 'Oxygen Level') return t(lang, 'oxygen_level');
    return label;
  };

  const translateMetricStatus = (status: HealthStatus) => {
    if (status === 'Excellent') return t(lang, 'metric_excellent');
    if (status === 'Normal') return t(lang, 'metric_normal');
    if (status === 'Warning') return t(lang, 'metric_warning');
    if (status === 'Alert') return t(lang, 'metric_alert');
    if (status === 'No Device') return t(lang, 'metric_no_device');
    if (status === 'Waiting') return t(lang, 'metric_waiting');
    return status;
  };

  const hasActualReadings = metrics.some(
    metric => metric.status !== 'No Device' && metric.status !== 'Waiting',
  );

  const getStatusBadgeStyle = (
    status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'ALERT',
  ) => {
    switch (status) {
      case 'EXCELLENT':
        return styles.badgeExcellent;
      case 'GOOD':
        return styles.badgeGood;
      case 'WARNING':
        return styles.badgeWarning;
      case 'ALERT':
        return styles.badgeAlert;
      default:
        return styles.badgeGood;
    }
  };

  const getStatusTextStyle = (
    status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'ALERT',
  ) => {
    switch (status) {
      case 'EXCELLENT':
        return styles.badgeTextExcellent;
      case 'GOOD':
        return styles.badgeTextGood;
      case 'WARNING':
        return styles.badgeTextWarning;
      case 'ALERT':
        return styles.badgeTextAlert;
      default:
        return styles.badgeTextGood;
    }
  };

  const getMetricStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'Excellent':
        return HOME_STATUS_COLORS.excellent;
      case 'Normal':
        return HOME_STATUS_COLORS.normal;
      case 'Warning':
        return HOME_STATUS_COLORS.warning;
      case 'Alert':
        return HOME_STATUS_COLORS.alert;
      case 'No Device':
        return HOME_STATUS_COLORS.muted;
      case 'Waiting':
        return HOME_STATUS_COLORS.mutedStrong;
      default:
        return HOME_STATUS_COLORS.muted;
    }
  };

  const getMetricDotColor = (status: HealthStatus) => {
    switch (status) {
      case 'Excellent':
        return HOME_STATUS_COLORS.excellent;
      case 'Normal':
        return HOME_STATUS_COLORS.normal;
      case 'Warning':
        return HOME_STATUS_COLORS.warning;
      case 'Alert':
        return HOME_STATUS_COLORS.alert;
      case 'No Device':
        return HOME_STATUS_COLORS.mutedSoft;
      case 'Waiting':
        return HOME_STATUS_COLORS.muted;
      default:
        return HOME_STATUS_COLORS.mutedSoft;
    }
  };

  if (locked) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.containerLocked]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, styles.titleDisabled]}>
              {t(lang, 'health_trends')}
            </Text>
          </View>
          <Image
            source={require('../../../../assets/android-res/drawable/rhythm.png')}
            style={[styles.trendIcon, styles.trendIconDisabled]}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.lockedMessage}>{t(lang, 'consent_required')}</Text>
        <Text style={styles.lockedHint}>
          {t(lang, 'update_policy_consent')}
        </Text>

        <View style={styles.lockOverlay} pointerEvents="none">
          <Image
            source={require('../../../../assets/android-res/drawable/lock.png')}
            style={styles.lockIcon}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t(lang, 'health_trends')}</Text>
          {hasActualReadings && (
            <View
              style={[styles.statusBadge, getStatusBadgeStyle(overallStatus)]}
            >
              <Text style={[styles.statusText, getStatusTextStyle(overallStatus)]}>
                {translateOverallStatus(overallStatus)}
              </Text>
            </View>
          )}
        </View>
        <Image
          source={require('../../../../assets/android-res/drawable/rhythm.png')}
          style={styles.trendIcon}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.metricsGrid}>
        {metrics.map((metric, index) => (
          <View key={index} style={styles.metricItem}>
            <View
              style={[
                styles.metricDot,
                { backgroundColor: getMetricDotColor(metric.status) },
              ]}
            />
            <View>
              <Text style={styles.metricLabel}>
                {translateMetricLabel(metric.label)}
              </Text>
              <Text
                style={[
                  styles.metricStatus,
                  { color: getMetricStatusColor(metric.status) },
                ]}
              >
                {translateMetricStatus(metric.status)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

export default HealthTrendWidget;
