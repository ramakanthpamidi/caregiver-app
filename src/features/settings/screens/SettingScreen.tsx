import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BackHandler, View, Text, TouchableOpacity, Image, Pressable, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../../../shared/i18n';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import LogoutDialog from '../../profiles/components/LogoutDialog';
import SettingModal, { type SettingModalHandle } from '../components/SettingModal';
import { clearUserSession } from '../../auth/services/session';
import { deleteMyAccount } from '../../profiles/api/profileApi';
import { Colors, Layout, Spacing } from '../../../shared/theme/theme';
import { clearModalVisualProgress, popModal, pushModal, setModalVisualProgress } from '../../../shared/ui/statusBarManager';
import { useDialogPortal } from '../../../shared/components/DialogPortalProvider';
import styles, { modalStyles } from './SettingScreen.styles';

const SettingScreen = React.memo(function SettingScreen({
  setIsLoggedIn,
  openTermScreen,
  openDataManagementScreen,
  openLineNotifyScreen,
}: {
  setIsLoggedIn?: (v: boolean) => void;
  openTermScreen?: (profileId?: number | null) => void;
  openDataManagementScreen?: (profileId?: number | null) => void;
  openLineNotifyScreen?: (profileId?: number | null) => void;
}) {
  const { lang, setLang } = useLanguage();
  const bottomSpacerHeight = Layout.bottomTabHeight + Spacing.lg;

  const appVersion = useMemo(() => {
    try {
      const pkg = require('../../../../package.json') as { version?: string };
      return pkg?.version ?? '1.0.8';
    } catch {
      return '1.0.8';
    }
  }, []);

  const appUpdated = useMemo(() => {
    try {
      const d = new Date();
      if (lang === 'th') {
        const thaiMonths = [
          'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
          'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
          'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
        ];
        const day = d.getDate();
        const month = thaiMonths[d.getMonth()];
        const year = d.getFullYear() + 543;
        return `${day} ${month} ${year}`;
      }
      // Force English regardless of device locale
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, [lang]);

  const [helpModalVisible, setHelpModalVisible] = useState(false);

  const helpRef = useRef<SettingModalHandle | null>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const portal = useDialogPortal();
  const [languageSwitching, setLanguageSwitching] = useState(false);
  const languageSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langOverlayIdRef = useRef(`lang-switch-overlay-${Math.random().toString(36).slice(2)}`);
  const langNavVisualIdRef = useRef(`lang-switch-nav-${Math.random().toString(36).slice(2)}`);
  const langPushedRef = useRef(false);

  const languageOptions: ReadonlyArray<{ value: 'th' | 'en'; label: string }> = [
    { value: 'th', label: 'ไทย' },
    { value: 'en', label: 'English' },
  ];

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Session expired. Please log in again.');

      await deleteMyAccount(token);
      await clearUserSession();

      setDeleteAccountModalVisible(false);
      if (typeof setIsLoggedIn === 'function') setIsLoggedIn(false);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Failed to delete account';
      Alert.alert('Delete account failed', msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  const openTermsOfService = () => {
    if (typeof openTermScreen === 'function') {
      openTermScreen(undefined);
    }
  };

  const closeLanguageSwitchOverlay = useCallback(() => {
    if (languageSwitchTimeoutRef.current) {
      clearTimeout(languageSwitchTimeoutRef.current);
      languageSwitchTimeoutRef.current = null;
    }
    setLanguageSwitching(false);
  }, []);

  // Show/hide language overlay via portal (same window — no separate Android Modal window)
  useEffect(() => {
    if (languageSwitching) {
      if (!langPushedRef.current) {
        langPushedRef.current = true;
        try { pushModal(); } catch {}
      }
      setModalVisualProgress(langNavVisualIdRef.current, 1);
      portal?.setEntry(langOverlayIdRef.current,
        <View style={styles.languageSwitchOverlay}>
          <ActivityIndicator size="large" color={Colors.textOnPrimary} />
        </View>
      );
      portal?.setBackHandler(langOverlayIdRef.current, () => {
        closeLanguageSwitchOverlay();
        return true;
      });
    } else {
      portal?.removeBackHandler(langOverlayIdRef.current);
      portal?.removeEntry(langOverlayIdRef.current);
      clearModalVisualProgress(langNavVisualIdRef.current);
      if (langPushedRef.current) {
        langPushedRef.current = false;
        try { popModal(); } catch {}
      }
    }
  }, [closeLanguageSwitchOverlay, languageSwitching, portal]);

  // Direct hardware back binding for settings dialogs. Register on the next frame
  // so it sits above navigator listeners and calls the close setters directly.
  useEffect(() => {
    if (!logoutModalVisible && !deleteAccountModalVisible) return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (deleteAccountModalVisible) {
          if (deletingAccount) return true;
          setDeleteAccountModalVisible(false);
          return true;
        }
        if (logoutModalVisible) {
          setLogoutModalVisible(false);
          return true;
        }
        return false;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      sub?.remove();
    };
  }, [deleteAccountModalVisible, deletingAccount, logoutModalVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (languageSwitchTimeoutRef.current) {
        clearTimeout(languageSwitchTimeoutRef.current);
        languageSwitchTimeoutRef.current = null;
      }
      portal?.removeBackHandler(langOverlayIdRef.current);
      portal?.removeEntry(langOverlayIdRef.current);
      clearModalVisualProgress(langNavVisualIdRef.current);
      if (langPushedRef.current) {
        langPushedRef.current = false;
        try { popModal(); } catch {}
      }
    };
  }, [portal]);

  const handleLanguageChange = (value: 'th' | 'en') => {
    if (value === lang || languageSwitching) return;

    setLanguageSwitching(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLang(value);

        if (languageSwitchTimeoutRef.current) {
          clearTimeout(languageSwitchTimeoutRef.current);
        }

        languageSwitchTimeoutRef.current = setTimeout(() => {
          setLanguageSwitching(false);
          languageSwitchTimeoutRef.current = null;
        }, 280);
      });
    });
  };

  return (
      <SafeAreaView style={styles.container}>
        {/* StatusBar handled globally in App via statusBarManager */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* App info (matches Home "Health Trends" card style) */}
        <View style={styles.appInfoCard}>
          <View style={styles.appInfoRow}>
            <Image source={require('../../../../assets/android-res/drawable/WellScreen512BG.png')} style={styles.appInfoIcon} />
            <View style={styles.appInfoText}>
              <Text style={styles.appInfoTitle}>Well Screen</Text>
              <Text style={styles.appInfoVersion}>{t(lang, 'version')} {appVersion}</Text>
              <Text style={styles.appInfoUpdated}>{t(lang, 'updated')} {appUpdated}</Text>
            </View>
          </View>
        </View>

        {/* Preferences & Support */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'preferences_support')}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.rowItem}>
            <View style={styles.rowLeft}>
              <Image source={require('../../../../assets/android-res/drawable/language.png')} style={styles.iconImage} />
              <Text style={styles.rowTitle}>{t(lang, 'language')}</Text>
            </View>
            <View style={styles.languageToggle}>
              {languageOptions.map((option) => {
                const selected = lang === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.85}
                    onPress={() => handleLanguageChange(option.value)}
                    disabled={languageSwitching}
                    style={[styles.languageToggleOption, selected ? styles.languageToggleOptionActive : null]}
                  >
                    <Text style={[styles.languageToggleText, selected ? styles.languageToggleTextActive : null]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={[styles.rowItem, styles.rowItemLast]} activeOpacity={0.7} onPress={() => setHelpModalVisible(true)}>
            <View style={styles.rowLeft}>
              <Image source={require('../../../../assets/android-res/drawable/support.png')} style={styles.iconImage} />
              <Text style={styles.rowTitle}>{t(lang, 'help')}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account & Profile */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'account_profile')}</Text>
        </View>

        <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={async () => {
              try {
                const raw = await AsyncStorage.getItem('activeProfileId');
                const id = raw ? Number(raw) : null;
                if (!Number.isFinite(id as any) || (id as any) <= 0) {
                  Alert.alert(t(lang, 'no_active_profile'), t(lang, 'no_active_profile_msg'));
                  return;
                }
                if (typeof openLineNotifyScreen === 'function') {
                  openLineNotifyScreen(id as any);
                }
              } catch {
                Alert.alert(t(lang, 'no_active_profile'), t(lang, 'no_active_profile_msg'));
              }
            }}>
              <View style={styles.rowLeft}>
                <Image source={require('../../../../assets/android-res/drawable/line.png')} style={styles.iconImage} />
                <Text style={styles.rowTitle}>{t(lang, 'line_notifications')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={() => {}}>
              <View style={styles.rowLeft}>
                <Image source={require('../../../../assets/android-res/drawable/billing.png')} style={styles.iconImage} />
                <Text style={styles.rowTitle}>{t(lang, 'billing_payments')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity> */}

            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={async () => {
              try {
                const raw = await AsyncStorage.getItem('activeProfileId');
                const id = raw ? Number(raw) : null;
                if (!Number.isFinite(id as any) || (id as any) <= 0) {
                  Alert.alert(t(lang, 'no_active_profile'), t(lang, 'no_active_profile_msg'));
                  return;
                }
                if (typeof openDataManagementScreen === 'function') {
                  openDataManagementScreen(id as any);
                }
              } catch {
                Alert.alert(t(lang, 'no_active_profile'), t(lang, 'no_active_profile_msg'));
              }
            }}>
              <View style={styles.rowLeft}>
                <Image source={require('../../../../assets/android-res/drawable/data.png')} style={styles.iconImage} />
                <Text style={styles.rowTitle}>{t(lang, 'data_management')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.rowItem} activeOpacity={0.7} onPress={openTermsOfService}>
              <View style={styles.rowLeft}>
                <Image source={require('../../../../assets/android-res/drawable/information.png')} style={styles.iconImage} />
                <Text style={styles.rowTitle}>{t(lang, 'terms_of_service')}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowItem}
            activeOpacity={0.7}
            onPress={() => setDeleteAccountModalVisible(true)}
          >
            <View style={styles.rowLeft}>
              <Image source={require('../../../../assets/android-res/drawable/delete2.png')} style={styles.iconImage} />
              <Text style={[styles.rowTitle, styles.logoutText]}>{t(lang, 'delete_account')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rowItem, styles.rowItemLast]}
            activeOpacity={0.7}
            onPress={() => {
              // Safety: ensure no other sheet/backdrop can sit above the dialog.
              try { helpRef.current?.close(); } catch {}
              setHelpModalVisible(false);
              setLogoutModalVisible(true);
            }}
          >
            <View style={styles.rowLeft}>
              <Image source={require('../../../../assets/android-res/drawable/logout.png')} style={styles.iconImage} />
              <Text style={[styles.rowTitle, styles.logoutText]}>{t(lang, 'logout')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Help Modal */}
        <SettingModal ref={helpRef} visible={helpModalVisible} onRequestClose={() => setHelpModalVisible(false)}>
          <Text style={modalStyles.sheetTitle}>{t(lang, 'help')}</Text>
          <View style={styles.helpWrap}>
            <Text style={styles.helpTitle}>{t(lang, 'bps_command_center')}</Text>
            <Text style={styles.helpPhone}>{t(lang, 'phone_number')}</Text>
            <TouchableOpacity
              style={styles.helpCallButton}
              activeOpacity={0.75}
              onPress={() => Linking.openURL('tel:021201977')}
            >
              <Text style={styles.helpCallButtonText}>{t(lang, 'call_number')} {t(lang, 'phone_number')}</Text>
            </TouchableOpacity>
          </View>
          <Pressable style={modalStyles.close} onPress={() => helpRef.current?.close()}>
            <Text style={modalStyles.closeText}>{t(lang, 'close')}</Text>
          </Pressable>
        </SettingModal>

        <LogoutDialog
          visible={deleteAccountModalVisible}
          title={t(lang, 'delete_account_title')}
          message={t(lang, 'delete_account_message')}
          cancelText={t(lang, 'cancel')}
          confirmText={deletingAccount ? t(lang, 'deleting') : t(lang, 'delete_account_title')}
          onRequestClose={() => {
            if (deletingAccount) return;
            setDeleteAccountModalVisible(false);
          }}
          onConfirm={handleDeleteAccount}
        />

        <LogoutDialog
          visible={logoutModalVisible}
          title={t(lang, 'confirm_logout')}
          message={t(lang, 'confirm_logout_message')}
          cancelText={t(lang, 'cancel')}
          confirmText={t(lang, 'log_out')}
          onRequestClose={() => setLogoutModalVisible(false)}
          onConfirm={async () => {
            setLogoutModalVisible(false);
            if (typeof setIsLoggedIn === 'function') setIsLoggedIn(false);
            try {
              await clearUserSession();
            } catch (e) {
              console.warn('Logout failed', e);
            }
          }}
        />

        {/* Spacer to ensure consistent gap above bottom nav */}
        <View style={[styles.bottomSpacer, { height: bottomSpacerHeight }]} />

      </ScrollView>



    </SafeAreaView>
  );
});

export default SettingScreen;

// styles moved to SettingScreen.styles.ts
