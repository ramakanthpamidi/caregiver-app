import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LineNotifySection from '../components/LineNotifySection';
import { Colors } from '../../../shared/theme/theme';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Props = {
  onCloseOverlay?: (() => void) | undefined;
};

export default function LineNotifyScreen({ onCloseOverlay }: Props) {
  const { lang } = useLanguage();
  const [profileId, setProfileId] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('activeProfileId').then((raw) => {
      const id = raw ? Number(raw) : null;
      setProfileId(id && Number.isFinite(id) && id > 0 ? id : null);
    });
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCloseOverlay} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LINE Notify</Text>        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          {t(lang, 'line_notify_hint')}
        </Text>

        {profileId ? (
          <LineNotifySection profileId={profileId} isOnline={isOnline} />
        ) : (
          <View style={styles.noProfile}>
            <Text style={styles.noProfileText}>{t(lang, 'no_active_selected')}</Text>
            <Text style={styles.noProfileSub}>{t(lang, 'go_select_profile')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 32,
    color: Colors.primary ?? '#064b75',
    lineHeight: 34,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 16,
  },
  noProfile: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  noProfileSub: {
    fontSize: 13,
    color: '#9ca3af',
  },
});
