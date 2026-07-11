import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InfoDialog from '../../../shared/components/InfoDialog';
import AlertDialog from '../components/AlertDialog';
import AlertListItem, { type DisplayAlert } from '../components/AlertListItem';
import AlertSummaryCard from '../components/AlertSummaryCard';
import {
  getAlerts,
  markAlertRead,
  dismissAlert,
  clearAlerts,
  deleteAlertsByProfileAndPeriod,
  subscribeAlerts,
  formatAlertTimestamp,
  type LocalAlert,
} from '../storage/alertStorage';
import { getActiveProfileId, subscribeActiveProfileId } from '../../profiles/lib/profileEvents';
import { useProfileConsents } from '../../legal/hooks/useProfileConsents';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import {
  getAlertMessage,
  getAlertTitle,
  type HealthStatusLevel,
} from '../../../shared/lib/healthThresholds';
import { Layout, Spacing } from '../../../shared/theme/theme';
import alertStyles from './AlertScreen.styles';

const AlertScreen = React.memo(function AlertScreen() {
  const { lang } = useLanguage();
  const [localAlerts, setLocalAlerts] = useState<LocalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [alertsConsentDialogVisible, setAlertsConsentDialogVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DisplayAlert | null>(null);

  const activeProfileConsents = useProfileConsents(activeProfileId);
  const canViewAlerts = activeProfileConsents?.consent_granted !== false;

  // Load active profile ID
  useEffect(() => {
    getActiveProfileId().then(setActiveProfileId);
    const unsubscribe = subscribeActiveProfileId((id) => {
      setActiveProfileId(id);
    });
    return unsubscribe;
  }, []);

  // Load alerts from storage
  const loadAlerts = useCallback(async () => {
    try {
      const stored = await getAlerts();
      setLocalAlerts(stored);
    } catch (err) {
      console.error('[AlertScreen] Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load and subscribe to changes
  useEffect(() => {
    loadAlerts();
    const unsubscribe = subscribeAlerts(() => {
      loadAlerts();
    });
    return unsubscribe;
  }, [loadAlerts]);

  // Convert LocalAlert to DisplayAlert and filter by active profile
  const alerts = useMemo<DisplayAlert[]>(() => {
    // Filter alerts to only show those belonging to the active profile
    const filteredAlerts = activeProfileId 
      ? localAlerts.filter(a => a.profileId === activeProfileId)
      : localAlerts;

    const severityToStatus: Record<string, HealthStatusLevel> = {
      critical: 'Critical',
      warning: 'Warning',
      good: 'Good',
      excellent: 'Excellent',
    };
    
    return filteredAlerts.map(a => {
      const status = severityToStatus[a.severity] ?? 'Good';
      return {
        id: a.id,
        severity: a.severity,
        readingType: a.readingType,
        title: getAlertTitle(a.readingType, status, lang),
        message: getAlertMessage(a.readingType, status, a.values, lang),
        deviceName: a.deviceName,
        reading: a.reading,
        timestamp: formatAlertTimestamp(a.timestamp),
        isUnread: a.isUnread,
      };
    });
  }, [localAlerts, activeProfileId, lang]);
  const visibleAlerts = canViewAlerts ? alerts : [];

  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter(a => a.severity === 'warning').length;
  const excellentCount = visibleAlerts.filter(a => a.severity === 'excellent').length;
  const goodCount = visibleAlerts.filter(a => a.severity === 'good').length;
  const bottomSpacerHeight = Layout.bottomTabHeight + Spacing.sm;

  const handleDeleteAllAlerts = useCallback(async () => {
    try {
      if (activeProfileId) {
        await deleteAlertsByProfileAndPeriod(activeProfileId);
      } else {
        await clearAlerts();
      }
    } catch (err) {
      console.error('[AlertScreen] Failed to delete all alerts:', err);
    }
  }, [activeProfileId]);

  const handleDismiss = useCallback(async (alertId: string) => {
    try {
      await dismissAlert(alertId);
    } catch (err) {
      console.error('[AlertScreen] Failed to dismiss alert:', err);
    }
  }, []);

  const handlePress = useCallback(async (alert: DisplayAlert) => {
    if (!canViewAlerts) {
      setAlertsConsentDialogVisible(true);
      return;
    }
    setSelectedAlert(alert);
    try {
      await markAlertRead(alert.id);
    } catch (err) {
      console.error('[AlertScreen] Failed to mark read:', err);
    }
  }, [canViewAlerts]);

  const renderAlertItem = useCallback(({ item }: { item: DisplayAlert }) => (
    <AlertListItem
      alert={item}
      onPress={() => handlePress(item)}
      onDismiss={() => handleDismiss(item.id)}
    />
  ), [handlePress, handleDismiss]);

  const keyExtractor = useCallback((item: DisplayAlert) => item.id, []);

  const listHeader = useMemo(() => (
    <>
      {/* Alerts Summary */}
      <View style={alertStyles.summaryBox}>
        <View style={alertStyles.summaryHeader}>
          <View style={alertStyles.summaryHeaderText}>
            <Text style={alertStyles.summaryEyebrow}>{t(lang, 'tab_alerts')}</Text>
            <Text style={alertStyles.summaryTitle}>{t(lang, 'alerts_summary')}</Text>
            <Text style={alertStyles.summarySub}>{t(lang, 'alerts_sub')}</Text>
          </View>
          <View style={alertStyles.summaryIconWrap}>
            <Image
              source={require('../../../../assets/android-res/drawable/alert2.png')}
              style={alertStyles.summaryIcon}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={alertStyles.summaryGrid}>
          <View style={alertStyles.summaryGridItem}>
            <AlertSummaryCard label={t(lang, 'sev_critical')} count={criticalCount} color="#ef4444" bgColor="#fdf2f2" />
          </View>
          <View style={alertStyles.summaryGridItem}>
            <AlertSummaryCard label={t(lang, 'sev_warning')} count={warningCount} color="#f59e0b" bgColor="#fef7ed" />
          </View>
          <View style={alertStyles.summaryGridItem}>
            <AlertSummaryCard label={t(lang, 'sev_good')} count={goodCount} color="#16a34a" bgColor="#f1fdf4" />
          </View>
          <View style={alertStyles.summaryGridItem}>
            <AlertSummaryCard label={t(lang, 'sev_excellent')} count={excellentCount} color="#3b82f6" bgColor="#eff6ff" />
          </View>
        </View>
      </View>

      {/* All Alerts Header */}
      <View style={alertStyles.allAlertsHeader}>
        <Text style={alertStyles.allAlertsTitle}>{t(lang, 'all_alerts')}</Text>
        <TouchableOpacity
          style={[
            alertStyles.deleteAllBtn,
            !canViewAlerts ? alertStyles.deleteAllBtnDisabled : null,
          ]}
          onPress={canViewAlerts ? handleDeleteAllAlerts : () => setAlertsConsentDialogVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={alertStyles.deleteAllText}>{t(lang, 'clear_alert_cards')}</Text>
        </TouchableOpacity>
      </View>

      {!canViewAlerts ? (
        <TouchableOpacity style={alertStyles.emptyState} activeOpacity={0.85} onPress={() => setAlertsConsentDialogVisible(true)}>
          <Image
            source={require('../../../../assets/android-res/drawable/lock.png')}
            style={alertStyles.emptyIcon}
            resizeMode="contain"
          />
          <Text style={alertStyles.emptyText}>{t(lang, 'alerts_locked')}</Text>
          <Text style={alertStyles.emptySubtext}>{t(lang, 'alerts_locked_hint')}</Text>
        </TouchableOpacity>
      ) : isLoading ? (
        <View style={alertStyles.emptyState}>
          <Text style={alertStyles.emptyText}>{t(lang, 'loading_alerts')}</Text>
        </View>
      ) : visibleAlerts.length === 0 ? (
        <View style={alertStyles.emptyState}>
          <Image
            source={require('../../../../assets/android-res/drawable/alert2.png')}
            style={alertStyles.emptyIcon}
            resizeMode="contain"
          />
          <Text style={alertStyles.emptyText}>{t(lang, 'no_alerts')}</Text>
          <Text style={alertStyles.emptySubtext}>{t(lang, 'no_alerts_hint')}</Text>
        </View>
      ) : null}
    </>
  ), [lang, criticalCount, warningCount, goodCount, excellentCount, canViewAlerts, isLoading, visibleAlerts.length, handleDeleteAllAlerts]);

  return (
    <SafeAreaView style={alertStyles.container}>
      <InfoDialog
        visible={alertsConsentDialogVisible}
        title={t(lang, 'consent_required')}
        message={t(lang, 'consent_alerts_msg')}
        onClose={() => setAlertsConsentDialogVisible(false)}
      />
      <AlertDialog
        visible={selectedAlert !== null}
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
      <FlatList
        contentContainerStyle={[alertStyles.content, { paddingBottom: bottomSpacerHeight }]}
        data={canViewAlerts && !isLoading ? visibleAlerts : []}
        // data={[]}
        keyExtractor={keyExtractor}
        renderItem={renderAlertItem}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </SafeAreaView>
  );
});

export default AlertScreen;
