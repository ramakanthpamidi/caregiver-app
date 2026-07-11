import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeaderBackButton } from '@react-navigation/elements';
import { getMedicalDataSummary, deleteMedicalData, type MedicalDataSummary, type DeleteMedicalDataPeriod } from '../api/profileApi';
import { Colors, Layout, Spacing } from '../../../shared/theme/theme';
import { showToast } from '../../../shared/ui/toast';
import DialogFrame from '../../../shared/components/DialogFrame';
import { deleteAlertsByProfileAndPeriod } from '../../alerts/storage/alertStorage';
import { purgeOutboxForProfileDataDeletion } from '../../../shared/sync/syncOutbox';
import styles from './DataManagementScreen.styles';
import { getProfileAvatar, type ProfileAvatar } from '../lib/profileAvatar';
import { getSavedAvatarColor, getInitialsFromName } from '../lib/avatarColors';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Props = {
  navigation?: any;
  route?: any;
  onCloseOverlay?: (() => void) | undefined;
};

type DataGroupKey = 'general' | 'medical_data' | 'alerts' | 'all_data';

const DataManagementScreen = React.memo(function DataManagementScreen({ navigation, route, onCloseOverlay: onCloseOverlayProp }: Props) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const bottomContentPadding = Layout.bottomTabHeight + Spacing.lg;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSummary, setDataSummary] = useState<MedicalDataSummary | null>(null);
  const [profileLabel, setProfileLabel] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<ProfileAvatar | null>(null);
  const [profileAvatarColor, setProfileAvatarColor] = useState<string>('#9ca3af');
  const [deleting, setDeleting] = useState(false);
  const [periodDialogVisible, setPeriodDialogVisible] = useState(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<DataGroupKey | null>(null);
  const [pendingPeriod, setPendingPeriod] = useState<DeleteMedicalDataPeriod>('all');

  const onCloseOverlay = onCloseOverlayProp ?? route?.params?.onCloseOverlay;

  const HeaderBack = (
    <HeaderBackButton
      onPress={() => onCloseOverlay?.()}
      tintColor="#064b75"
      style={styles.headerBack}
      pressColor="rgba(6,75,117,0.12)"
    />
  );

  const loadData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const rawProfileId = await AsyncStorage.getItem('activeProfileId');
      const profileId = rawProfileId ? Number(rawProfileId) : null;

      if (!token || !profileId || !Number.isFinite(profileId)) {
        showToast(lang === 'th' ? 'กรุณาเลือกโปรไฟล์ก่อน' : 'Please select a profile first', 'error');
        if (onCloseOverlay) onCloseOverlay();
        return;
      }

      const summary = await getMedicalDataSummary(token, profileId);
      setDataSummary(summary);
      setProfileLabel(summary.profile_label || `Profile ${profileId}`);
      try {
        const av = await getProfileAvatar(profileId);
        setProfileAvatar(av);
        const color = await getSavedAvatarColor(profileId, summary.profile_label || `Profile ${profileId}`);
        setProfileAvatarColor(color);
      } catch {
        // avatar is optional
      }
    } catch (err: any) {
      console.error('Failed to load medical data summary:', err);
      showToast(err?.message || (lang === 'th' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Failed to load data'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCloseOverlay]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getGroupLabel = (group: DataGroupKey) => {
    switch (group) {
      case 'general':
        return t(lang, 'group_general');
      case 'medical_data':
        return t(lang, 'group_medical_data');
      case 'alerts':
        return t(lang, 'group_alerts');
      case 'all_data':
        return t(lang, 'group_all_data');
      default:
        return group;
    }
  };

  const getPeriodLabel = (period: DeleteMedicalDataPeriod) => {
    switch (period) {
      case 'all':
        return t(lang, 'period_all_time');
      case 'last_7_days':
        return t(lang, 'period_last_7');
      case 'last_30_days':
        return t(lang, 'period_last_30');
      case 'last_90_days':
        return t(lang, 'period_last_90');
      case 'custom':
        return t(lang, 'period_custom');
      default:
        return t(lang, 'period_all_time');
    }
  };

  const getPeriodRange = (period: DeleteMedicalDataPeriod): { fromTs: number | null; toTs: number | null } => {
    if (period === 'all') {
      return { fromTs: null, toTs: null };
    }

    const now = Date.now();
    if (period === 'last_7_days') {
      return { fromTs: now - 7 * 24 * 60 * 60 * 1000, toTs: now };
    }
    if (period === 'last_30_days') {
      return { fromTs: now - 30 * 24 * 60 * 60 * 1000, toTs: now };
    }
    if (period === 'last_90_days') {
      return { fromTs: now - 90 * 24 * 60 * 60 * 1000, toTs: now };
    }

    return { fromTs: null, toTs: null };
  };

  const applyLocalDeletion = useCallback(async (profileId: number, group: DataGroupKey, period: DeleteMedicalDataPeriod) => {
    const { fromTs, toTs } = getPeriodRange(period);

    if (group === 'general') {
      await purgeOutboxForProfileDataDeletion({
        profileId,
        categories: ['general'],
        fromTs,
        toTs,
      });
      return;
    }

    if (group === 'medical_data') {
      await purgeOutboxForProfileDataDeletion({
        profileId,
        categories: ['medical_data'],
        fromTs,
        toTs,
      });
      return;
    }

    if (group === 'alerts') {
      await deleteAlertsByProfileAndPeriod(profileId, { fromTs, toTs });
      await purgeOutboxForProfileDataDeletion({
        profileId,
        categories: ['alerts'],
        fromTs,
        toTs,
      });
      return;
    }

    if (group === 'all_data') {
      if (period === 'all') {
        await deleteAlertsByProfileAndPeriod(profileId, { fromTs: null, toTs: null });
        await purgeOutboxForProfileDataDeletion({
          profileId,
          categories: ['general', 'medical_data', 'alerts'],
          fromTs: null,
          toTs: null,
        });
      } else {
        await deleteAlertsByProfileAndPeriod(profileId, { fromTs, toTs });
        await purgeOutboxForProfileDataDeletion({
          profileId,
          categories: ['medical_data', 'alerts'],
          fromTs,
          toTs,
        });
      }
    }
  }, []);

  const runDelete = useCallback(async (group: DataGroupKey, period: DeleteMedicalDataPeriod) => {
    if (deleting) return;

    setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const rawProfileId = await AsyncStorage.getItem('activeProfileId');
      const profileId = rawProfileId ? Number(rawProfileId) : null;

      if (!token || !profileId) {
        showToast(lang === 'th' ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' : 'Session expired, please log in again', 'error');
        return;
      }

      if (group === 'all_data') {
        const categories: Array<'general' | 'medical_data' | 'alerts'> =
          period === 'all' ? ['general', 'medical_data', 'alerts'] : ['medical_data', 'alerts'];

        for (const category of categories) {
          await deleteMedicalData(token, profileId, category, { period });
        }

        await applyLocalDeletion(profileId, group, period);

        if (period === 'all') {
          showToast(lang === 'th' ? 'ลบข้อมูลโปรไฟล์ทั้งหมดแล้ว' : 'All profile data deleted', 'success');
        } else {
          showToast(lang === 'th' ? `ลบข้อมูลทางการแพทย์และการแจ้งเตือนสำหรับ${getPeriodLabel(period)}แล้ว` : `Medical data and alerts deleted for ${getPeriodLabel(period)}`, 'success');
        }
      } else {
        await deleteMedicalData(token, profileId, group, { period });
        await applyLocalDeletion(profileId, group, period);
        showToast(lang === 'th' ? `ลบ${getGroupLabel(group)}สำหรับ${getPeriodLabel(period)}แล้ว` : `${getGroupLabel(group)} deleted for ${getPeriodLabel(period)}`, 'success');
      }

      await loadData();
      setConfirmDialogVisible(false);
      setPeriodDialogVisible(false);
      setPendingGroup(null);
      setPendingPeriod('all');
    } catch (err: any) {
      console.error('Failed to delete medical data:', err);
      showToast(err?.message || (lang === 'th' ? 'ลบข้อมูลไม่สำเร็จ' : 'Failed to delete data'), 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleting, loadData, applyLocalDeletion]);

  const openDeletePeriodDialog = useCallback((group: DataGroupKey) => {
    if (deleting) return;
    setPendingGroup(group);
    setPendingPeriod('all');
    setPeriodDialogVisible(true);
  }, [deleting]);

  const selectPeriod = useCallback((period: DeleteMedicalDataPeriod) => {
    setPendingPeriod(period);
    setPeriodDialogVisible(false);
    setConfirmDialogVisible(true);
  }, []);

  const closeDialogs = useCallback(() => {
    if (deleting) return;
    setPeriodDialogVisible(false);
    setConfirmDialogVisible(false);
    setPendingGroup(null);
    setPendingPeriod('all');
  }, [deleting]);

  const getCategoryIcon = (group: DataGroupKey) => {
    switch (group) {
      case 'general':
        return require('../../../../assets/android-res/drawable/profile.png');
      case 'medical_data':
        return require('../../../../assets/android-res/drawable/data.png');
      case 'alerts':
      case 'all_data':
        return require('../../../../assets/android-res/drawable/alert.png');
      default:
        return require('../../../../assets/android-res/drawable/data.png');
    }
  };

  const renderDataCategory = (group: DataGroupKey, count: number, description: string) => {
    return (
      <View key={group} style={styles.categoryCard}>
        <View style={styles.categoryLeft}>
          <Image source={getCategoryIcon(group)} style={styles.categoryIcon} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.categoryTitle}>{getGroupLabel(group)}</Text>
            <Text style={styles.categoryDescription}>{description}</Text>
            <Text style={styles.categoryCount}>
              {count} {count === 1 ? t(lang, 'item_count') : t(lang, 'items_count')}
            </Text>
            {count > 0 && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => openDeletePeriodDialog(group)}
                activeOpacity={0.7}
                disabled={deleting}
              >
                <Text style={styles.deleteButtonText}>{deleting ? t(lang, 'deleting') : t(lang, 'delete_action')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={[styles.headerSafeArea, { paddingTop: insets.top }]}>
          <StatusBar
            translucent={false}
            backgroundColor={Colors.card}
            barStyle="dark-content"
          />
          <View style={styles.header}>
            {HeaderBack}
            <Text style={styles.headerTitle}>{t(lang, 'data_management')}</Text>
            <View style={styles.headerPlaceholder} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#064b75" />
          <Text style={styles.loadingText}>{t(lang, 'loading_data')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={[styles.headerSafeArea, { paddingTop: insets.top }]}>
        <StatusBar
          translucent={false}
          backgroundColor={Colors.card}
          barStyle="dark-content"
        />
        <View style={styles.header}>
          {HeaderBack}
          <Text style={styles.headerTitle}>{t(lang, 'data_management')}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          {
            flexGrow: 1,
            paddingBottom: bottomContentPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#064b75']} />}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ marginRight: 14 }}>
              {profileAvatar ? (
                <CroppedAvatarImage avatar={profileAvatar} size={44} />
              ) : (
                <View style={[styles.infoAvatarFallback, { backgroundColor: profileAvatarColor }]}>
                  <Text style={styles.infoAvatarInitial}>{getInitialsFromName(profileLabel)}</Text>
                </View>
              )}
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>{t(lang, 'data_for')} {profileLabel}</Text>
              <Text style={styles.infoSubtitle}>{t(lang, 'manage_profile_data')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'data_categories')}</Text>
        </View>

        {dataSummary && (
          <>
            {renderDataCategory('general', dataSummary.general_info_count, t(lang, 'desc_general'))}
            {renderDataCategory(
              'medical_data',
              dataSummary.raw_data_count + dataSummary.daily_data_count + dataSummary.archive_data_count,
              t(lang, 'desc_medical')
            )}
            {renderDataCategory('alerts', dataSummary.events_archive_count, t(lang, 'desc_alerts'))}
          </>
        )}

        {!dataSummary && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t(lang, 'no_data_available')}</Text>
          </View>
        )}

        <View style={styles.warningCard}>
          <Image source={require('../../../../assets/android-res/drawable/alert.png')} style={styles.warningIcon} resizeMode="contain" />
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>{t(lang, 'caution')}</Text>
            <Text style={styles.warningSubtitle}>
              {t(lang, 'caution_subtitle')}
            </Text>
            <TouchableOpacity
              style={styles.deleteAllButton}
              onPress={() => openDeletePeriodDialog('all_data')}
              activeOpacity={0.8}
              disabled={deleting}
            >
              <Text style={styles.deleteAllButtonText}>{deleting ? t(lang, 'deleting') : t(lang, 'delete_all_data')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <DialogFrame visible={periodDialogVisible} onRequestClose={closeDialogs} disableBackdropClose={deleting}>
        <Text style={styles.dialogTitle}>{t(lang, 'delete_action')} {getGroupLabel(pendingGroup || 'medical_data')}</Text>
        <Text style={styles.dialogMessage}>{t(lang, 'select_period_to_delete')}</Text>

        <View style={styles.dialogOptionsContainer}>
          <TouchableOpacity style={styles.dialogOptionButton} onPress={() => selectPeriod('last_7_days')} disabled={deleting}>
            <Text style={styles.dialogOptionTitle}>{t(lang, 'last_7_days')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dialogOptionButton} onPress={() => selectPeriod('last_30_days')} disabled={deleting}>
            <Text style={styles.dialogOptionTitle}>{t(lang, 'last_30_days')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dialogOptionButton} onPress={() => selectPeriod('last_90_days')} disabled={deleting}>
            <Text style={styles.dialogOptionTitle}>{t(lang, 'last_90_days')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dialogOptionButton, styles.dialogOptionDanger]} onPress={() => selectPeriod('all')} disabled={deleting}>
            <Text style={[styles.dialogOptionTitle, styles.dialogOptionDangerText]}>{t(lang, 'all_time')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dialogButtonsRow}>
          <TouchableOpacity style={styles.dialogSecondaryButton} onPress={closeDialogs} disabled={deleting}>
            <Text style={styles.dialogSecondaryText}>{t(lang, 'cancel')}</Text>
          </TouchableOpacity>
        </View>
      </DialogFrame>

      <DialogFrame visible={confirmDialogVisible} onRequestClose={closeDialogs} disableBackdropClose={deleting}>
        <Text style={styles.dialogTitle}>{t(lang, 'delete_action')} {getGroupLabel(pendingGroup || 'medical_data')}?</Text>
        <Text style={styles.dialogMessage}>
          {lang === 'th'
            ? `การดำเนินการนี้จะลบ${getGroupLabel(pendingGroup || 'medical_data')}ของ ${profileLabel} จาก${getPeriodLabel(pendingPeriod)} อย่างถาวร ไม่สามารถยกเลิกได้`
            : `This will permanently delete ${getGroupLabel(pendingGroup || 'medical_data').toLowerCase()} for ${profileLabel} from ${getPeriodLabel(pendingPeriod)}. This action cannot be undone.`}
        </Text>

        <View style={styles.dialogButtonsRow}>
          <TouchableOpacity style={styles.dialogSecondaryButton} onPress={closeDialogs} disabled={deleting}>
            <Text style={styles.dialogSecondaryText}>{t(lang, 'cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dialogDangerButton, deleting ? styles.dialogButtonDisabled : null]}
            onPress={() => pendingGroup && runDelete(pendingGroup, pendingPeriod)}
            disabled={deleting || !pendingGroup}
          >
            {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.dialogPrimaryText}>{t(lang, 'delete_action')}</Text>}
          </TouchableOpacity>
        </View>
      </DialogFrame>
    </SafeAreaView>
  );
});

export default DataManagementScreen;
