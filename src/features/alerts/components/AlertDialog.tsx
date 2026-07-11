import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type AlertSeverity } from '../storage/alertStorage';
import DialogFrame from '../../../shared/components/DialogFrame';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

export interface AlertDialogData {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  deviceName: string;
  reading?: string;
  timestamp: string;
}

interface AlertDialogProps {
  visible: boolean;
  alert: AlertDialogData | null;
  onClose: () => void;
}

function getSeverityColor(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':  return '#ef4444';
    case 'warning':   return '#f59e0b';
    case 'excellent': return '#3b82f6';
    case 'good':      return '#16a34a';
  }
}

function getSeverityBg(sev: AlertSeverity) {
  switch (sev) {
    case 'critical':  return '#fdf2f2';
    case 'warning':   return '#fef7ed';
    case 'excellent': return '#eff6ff';
    case 'good':      return '#f1fdf4';
  }
}

function getSeverityLabel(sev: AlertSeverity, lang: 'en' | 'th') {
  const key = `sev_${sev}_upper`;
  return t(lang, key);
}

export default function AlertDialog({ visible, alert, onClose }: AlertDialogProps) {
  const { lang } = useLanguage();
  // Keep last known alert so content stays visible during the close animation
  const lastAlertRef = React.useRef<AlertDialogData | null>(alert);
  if (alert) lastAlertRef.current = alert;
  const data = lastAlertRef.current;

  const sevColor = data ? getSeverityColor(data.severity) : '#6b7280';
  const sevBg    = data ? getSeverityBg(data.severity)    : '#f3f4f6';
  const sevLabel = data ? getSeverityLabel(data.severity, lang) : '';

  return (
    <DialogFrame visible={visible} onRequestClose={onClose} animationType="fade">
      {/* Header row: icon + title + severity pill (far right) */}
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: sevBg }]}>
          <Image
            source={require('../../../../assets/android-res/drawable/alert.png')}
            style={[styles.iconImg, { tintColor: sevColor }]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.titleInline} numberOfLines={2}>
          {data?.title ?? ''}
        </Text>
        <View style={[styles.severityPill, { borderColor: sevColor, backgroundColor: sevBg }]}>
          <Text style={[styles.severityPillText, { color: sevColor }]}>{sevLabel}</Text>
        </View>
      </View>

      {/* Message */}
      <Text style={styles.message}>{data?.message ?? ''}</Text>

      {/* Meta table */}
      <View style={styles.metaSection}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t(lang, 'dialog_device')}</Text>
          <Text style={styles.metaValue}>{data?.deviceName ?? ''}</Text>
        </View>
        {data?.reading ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t(lang, 'dialog_reading')}</Text>
            <Text style={[styles.metaValue, styles.metaValueReading]}>{data.reading}</Text>
          </View>
        ) : null}
        <View style={[styles.metaRow, styles.metaRowLast]}>
          <Text style={styles.metaLabel}>{t(lang, 'dialog_time')}</Text>
          <Text style={styles.metaValue}>{data?.timestamp ?? ''}</Text>
        </View>
      </View>

      {/* Close button — blue to match app primary */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
        <Text style={styles.closeBtnText}>{t(lang, 'dialog_close')}</Text>
      </TouchableOpacity>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconImg: {
    width: 20,
    height: 20,
  },
  titleInline: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 22,
  },
  severityPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  message: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 18,
  },
  metaSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
  },
  metaRowLast: {
    borderBottomWidth: 0,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  metaValueReading: {
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#064b75',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
