import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import type { AlertSeverity } from '../storage/alertStorage';
import { Theme, Shadows } from '../../../shared/theme/theme';

export interface DisplayAlert {
  id: string;
  severity: AlertSeverity;
  readingType: 'bp' | 'spo2' | 'glucose' | 'temp' | 'bmi';
  title: string;
  message: string;
  deviceName: string;
  reading?: string;
  timestamp: string;
  isUnread?: boolean;
}

type Props = {
  alert: DisplayAlert;
  onPress: () => void;
  onDismiss: () => void;
};

function getSeverityLabel(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':
      return 'CRITICAL';
    case 'warning':
      return 'WARNING';
    case 'excellent':
      return 'EXCELLENT';
    case 'good':
      return 'GOOD';
  }
}

function getSeverityColor(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'excellent':
      return '#3b82f6';
    case 'good':
      return '#16a34a';
  }
}

function getSeverityBg(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':
      return '#fdf2f2';
    case 'warning':
      return '#fef7ed';
    case 'excellent':
      return '#eff6ff';
    case 'good':
      return '#f1fdf4';
  }
}

function splitReading(
  reading?: string,
  readingType?: DisplayAlert['readingType']
): { value: string; unit: string; detail: string } {
  if (!reading) return { value: '--', unit: '', detail: '' };

  const trimmed = reading.trim();
  if (readingType === 'spo2') {
    const spo2Match = trimmed.match(/^([0-9.]+)\s*%\s*(?:\/\s*(.*))?$/);
    if (spo2Match) {
      return {
        value: spo2Match[1] || '--',
        unit: '%',
        detail: spo2Match[2] || '',
      };
    }
  }

  if (readingType === 'bmi') {
    // formatReadingText's 'bmi' case produces "BMI 24.3 • 68.5 kg" (or
    // just "BMI 24.3" without a weight) — it starts with letters, so the
    // generic digit-first regex below never matches it.
    const bmiMatch = trimmed.match(/^BMI\s+([0-9.]+)(?:\s*•\s*(.*))?$/i);
    if (bmiMatch) {
      return {
        value: bmiMatch[1] || '--',
        unit: 'BMI',
        detail: bmiMatch[2] || '',
      };
    }
  }

  const match = trimmed.match(/^([0-9./]+)\s*(.*)$/);
  if (!match) return { value: trimmed, unit: '', detail: '' };

  return {
    value: match[1] || trimmed,
    unit: match[2] || '',
    detail: '',
  };
}

const AlertListItem = React.memo(function AlertListItem({
  alert,
  onPress,
  onDismiss,
}: Props) {
  const { lang } = useLanguage();
  const sevColor = getSeverityColor(alert.severity);
  const sevBg = getSeverityBg(alert.severity);
  const readingDisplay = splitReading(alert.reading, alert.readingType);
  const isInlineUnit = alert.readingType === 'spo2' && readingDisplay.unit === '%';

  const severityLabel: Record<string, string> = {
    critical: t(lang, 'sev_critical_upper'),
    warning: t(lang, 'sev_warning_upper'),
    excellent: t(lang, 'sev_excellent_upper'),
    good: t(lang, 'sev_good_upper'),
  };

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      activeOpacity={0.85}
      onPress={onDismiss}
    >
      <Text style={styles.deleteActionText}>{t(lang, 'clear_alert_cards')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.cardShadowWrap}>
      <Swipeable
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
        containerStyle={styles.swipeContainer}
      >
        <View style={styles.alertCard}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.cardTapArea}
            onPress={onPress}
          >
            <View style={styles.alertRow}>
              <View style={styles.metricColumn}>
                <View
                  style={[
                    styles.metricSeverityPill,
                    { backgroundColor: sevBg, borderColor: sevBg },
                  ]}
                >
                  <Text style={[styles.metricSeverityText, { color: sevColor }]}> 
                    {severityLabel[alert.severity] ?? getSeverityLabel(alert.severity)}
                  </Text>
                </View>
                <View style={styles.metricValueGroup}>
                  <View style={[styles.metricPrimaryRow, isInlineUnit ? styles.metricPrimaryRowInline : null]}>
                    <Text style={[styles.metricValue, { color: sevColor }]}> 
                      {readingDisplay.value}
                    </Text>
                    {!!readingDisplay.unit && (
                      <Text
                        style={[
                          styles.metricUnit,
                          isInlineUnit ? styles.metricUnitInline : null,
                          isInlineUnit ? { color: sevColor } : null,
                        ]}
                      >
                        {readingDisplay.unit}
                      </Text>
                    )}
                  </View>
                  {!!readingDisplay.detail && (
                    <Text style={styles.metricDetail}>{readingDisplay.detail}</Text>
                  )}
                </View>
              </View>

              <View style={styles.alertMain}>
                <View style={styles.alertTopLine}>
                  <Text numberOfLines={1} style={styles.alertTitle}>
                    {alert.title}
                  </Text>
                  {!!alert.isUnread && <View style={styles.unreadDot} />}
                </View>

                <Text numberOfLines={4} style={styles.alertMessage}>
                  {alert.message}
                </Text>

                <View style={styles.alertMeta}>
                  {/* <Text style={styles.metaText}>{alert.deviceName}</Text> */}
                  {/* <Text style={styles.metaDivider}>•</Text>
                  {alert.reading ? (
                    <>
                      <Text style={styles.metaReading}>{alert.reading}</Text>
                      <Text style={styles.metaDivider}>•</Text>
                    </>
                  ) : null} */}
                  <Text style={styles.metaText}>{alert.timestamp}</Text>
                </View>
              </View>

              <View style={styles.alertRight} />
            </View>
          </TouchableOpacity>
        </View>
      </Swipeable>
    </View>
  );
});

export default AlertListItem;

const styles = StyleSheet.create({
  cardShadowWrap: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    ...Shadows.soft,
  },
  swipeContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardTapArea: {
    padding: 10,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  metricColumn: {
    width: 100,
    minHeight: 112,
    // paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 14,
    justifyContent: 'space-between',
  },
  metricValueGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricPrimaryRow: {
    alignItems: 'center',
  },
  metricPrimaryRowInline: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  alertMain: {
    flex: 1,
    paddingTop: 1,
    minHeight: 112,
    justifyContent: 'flex-start',
  },
  alertRight: {
    width: 0,
  },
  alertTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: Theme.typography.size.lg,
    lineHeight: 24,
    fontWeight: '800',
    color: '#1A2433',
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#0D7AA5',
    marginLeft: 10,
    marginTop: 7,
    borderWidth: 2,
    borderColor: '#EAF7FD',
  },
  metricSeverityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  metricSeverityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  metricUnit: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: '#7B899A',
    fontWeight: '700',
    textAlign: 'center',
  },
  metricUnitInline: {
    marginTop: 0,
    alignSelf: 'center',
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  metricDetail: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    color: '#7B899A',
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteAction: {
    width: 132,
    borderRadius: 22,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2495B',
    paddingHorizontal: 14,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  alertMessage: {
    fontSize: 14,
    color: '#607186',
    marginTop: 0,
    paddingTop: 0,
    textAlignVertical: 'top',
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    marginTop: 'auto',
  },
  metaText: {
    fontSize: 13,
    color: '#8391A3',
    lineHeight: 18,
  },
  metaReading: {
    fontSize: 13,
    color: '#2A3444',
    fontWeight: '700',
    lineHeight: 18,
  },
  metaDivider: {
    fontSize: 12,
    color: '#D1DAE5',
    marginHorizontal: 7,
  },
});
