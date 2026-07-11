import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type AlertSeverity = 'critical' | 'warning' | 'good' | 'excellent';

interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  message: string;
  deviceName?: string;
  reading?: string;
  timestamp: string;
  onViewDetails?: () => void;
  onDismiss?: () => void;
}

export default function AlertCard({
  severity,
  title,
  message,
  deviceName,
  reading,
  timestamp,
  onViewDetails,
  onDismiss,
}: AlertCardProps) {
  const { lang } = useLanguage();
  const containerStyle = [styles.card, getCardStyle(severity)];
  const iconStyle = [styles.icon, getIconStyle(severity)];
  const iconTint = getSeverityTint(severity);
  const iconSource = require('../../../../assets/android-res/drawable/alert.png');

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={iconStyle}>
            <Image source={iconSource} style={[styles.iconImage, { tintColor: iconTint }]} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            {deviceName && <Text style={styles.deviceName}>{deviceName}</Text>}
          </View>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.dismissButton}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.message}>{message}</Text>

      {reading && (
        <View style={styles.readingBadge}>
          <Text style={styles.readingText}>{reading}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.timestamp}>{timestamp}</Text>
        {onViewDetails && (
          <TouchableOpacity onPress={onViewDetails}>
            <Text style={[styles.viewDetailsButton, getButtonTextStyle(severity)]}>{t(lang, 'view_details')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function getCardStyle(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return { backgroundColor: '#fef2f2', borderLeftWidth: 4, borderLeftColor: '#ef4444' };
    case 'warning':
      return { backgroundColor: '#fffbeb', borderLeftWidth: 4, borderLeftColor: '#f59e0b' };
    case 'good':
      return { backgroundColor: '#f0fdf4', borderLeftWidth: 4, borderLeftColor: '#16a34a' };
    case 'excellent':
      return { backgroundColor: '#eff6ff', borderLeftWidth: 4, borderLeftColor: '#3b82f6' };
  }
}

function getIconStyle(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return { backgroundColor: '#fee2e2' };
    case 'warning':
      return { backgroundColor: '#fef3c7' };
    case 'good':
      return { backgroundColor: '#dcfce7' };
    case 'excellent':
      return { backgroundColor: '#dbeafe' };
  }
}

function getIconText(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return '⚠️';
    case 'warning':
      return '⚡';
    case 'good':
      return '✓';
    case 'excellent':
      return '★';
  }
}

function getSeverityTint(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'good':
      return '#16a34a';
    case 'excellent':
      return '#3b82f6';
  }
}

function getButtonTextStyle(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return { color: '#ef4444' };
    case 'warning':
      return { color: '#f59e0b' };
    case 'good':
      return { color: '#16a34a' };
    case 'excellent':
      return { color: '#3b82f6' };
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  iconImage: {
    width: 22,
    height: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 13,
    color: '#6b7280',
  },
  dismissButton: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '400',
  },
  message: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  readingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  readingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  viewDetailsButton: {
    fontSize: 14,
    fontWeight: '600',
  },
});
