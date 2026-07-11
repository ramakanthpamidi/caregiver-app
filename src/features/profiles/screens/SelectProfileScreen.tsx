import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import type { CachedProfile } from '../storage/profileCache';
import type { ProfileAvatar } from '../lib/profileAvatar';
import { getAvatarColorForProfile, getCachedAvatarColor, getSavedAvatarColor } from '../lib/avatarColors';
import ProfilePasswordDialog from '../components/ProfilePasswordDialog';
import SelectProfileCard, { AddProfileCard } from '../components/SelectProfileCard';
import { API_BASE_URL } from '../../../shared/config/api';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Props = {
  profiles: CachedProfile[];
  avatarMap: Record<string, ProfileAvatar>;
  activeProfileId: number | null;
  onSelectProfile: (profileId: number) => void | Promise<void>;
  onAddProfile: () => void;
  onLogout?: () => void;
};

export default React.memo(function SelectProfileScreen({
  profiles,
  avatarMap,
  onSelectProfile,
  onAddProfile,
  onLogout,
}: Props) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<CachedProfile | null>(null);
  const [avatarColors, setAvatarColors] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {};
    for (const p of profiles) {
      const defaultProfileName = t(lang, 'profile_default_name');
      const name = (p.profile_label || defaultProfileName).trim() || defaultProfileName;
      seeded[String(p.id)] = getCachedAvatarColor(p.id) || getAvatarColorForProfile(name);
    }
    return seeded;
  });

  const gridHorizontalPadding = 20;
  const gridGap = 16;
  const columns = width >= 900 ? 4 : width >= 560 ? 3 : 2;
  const availableGridWidth = Math.max(0, width - gridHorizontalPadding * 2);
  const tileSize = Math.floor((availableGridWidth - (columns - 1) * gridGap) / columns);
  const avatarSize = Math.min(96, Math.max(60, Math.floor(tileSize * 0.42)));

  // Load avatar colors for all profiles
  useEffect(() => {
    const loadColors = async () => {
      // Seed immediately so we don't flash the fallback color while AsyncStorage loads.
      setAvatarColors((prev) => {
        const next = { ...prev };
        for (const p of profiles) {
          const idKey = String(p.id);
          if (next[idKey]) continue;
          const defaultProfileName = t(lang, 'profile_default_name');
          const name = (p.profile_label || defaultProfileName).trim() || defaultProfileName;
          next[idKey] = getAvatarColorForProfile(name);
        }
        return next;
      });

      const colorMap: Record<string, string> = {};
      for (const p of profiles) {
        const color = await getSavedAvatarColor(p.id, p.profile_label || t(lang, 'profile_default_name'));
        colorMap[String(p.id)] = color;
      }
      setAvatarColors((prev) => ({ ...prev, ...colorMap }));
    };
    loadColors();
  }, [lang, profiles]);

  const handleProfilePress = useCallback(async (profile: CachedProfile) => {
    const id = Number(profile.id);

    // Check if profile has a password
    if (profile.has_access_password) {
      setSelectedProfile(profile);
      setPasswordDialogVisible(true);
    } else {
      // No password, proceed directly
      await onSelectProfile(id);
    }
  }, [onSelectProfile]);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!selectedProfile) return false;

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert(t(lang, 'error_title'), t(lang, 'auth_token_not_found'));
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/profiles/${selectedProfile.id}/verify-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        Alert.alert(t(lang, 'error_title'), data.error || t(lang, 'verify_password_failed'));
        return false;
      }

      if (data.valid) {
        // Password correct, switch to profile
        await onSelectProfile(Number(selectedProfile.id));
        setPasswordDialogVisible(false);
        setSelectedProfile(null);
        return true;
      } else {
        // Password incorrect
        return false;
      }
    } catch (error) {
      console.error('Password verification error:', error);
      Alert.alert(t(lang, 'error_title'), t(lang, 'verify_password_failed_retry'));
      return false;
    }
  }, [lang, selectedProfile, onSelectProfile]);

  const handlePasswordCancel = useCallback(() => {
    setPasswordDialogVisible(false);
    setSelectedProfile(null);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#064b75" />
      <View style={{ flex: 1 }}>
        {/* Hero Header */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#064b75', '#0b6aa0', '#0d7cb5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGradient, { paddingTop: insets.top + 20 }]}
          >
            {/* Decorative circles */}
            <View style={styles.heroDecor1} />
            <View style={styles.heroDecor2} />
            
            <View style={styles.heroContent}>
              <Text style={styles.heroEmoji}>👋</Text>
              <Text style={styles.heroTitle}>{t(lang, 'select_profile_welcome_back')}</Text>
              <Text style={styles.heroSubtitle}>{t(lang, 'select_profile_subtitle')}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Section header (sticky) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t(lang, 'all_profiles')}</Text>
          <Text style={styles.sectionCount}>
            {profiles.length} {profiles.length === 1 ? t(lang, 'profile_count_singular') : t(lang, 'profile_count_plural')}
          </Text>
        </View>

        {/* Cards scroll only */}
        <ScrollView
          style={styles.cardsScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {profiles.map((p) => {
              const id = Number(p.id);
              const avatar = avatarMap[String(p.id)] || null;
              const defaultProfileName = t(lang, 'profile_default_name');
              const name = (p.profile_label || defaultProfileName).trim() || defaultProfileName;
              const avatarColor = avatarColors[String(p.id)] || getCachedAvatarColor(id) || getAvatarColorForProfile(name);

              return (
                <SelectProfileCard
                  key={String(p.id)}
                  name={name}
                  avatar={avatar}
                  avatarColor={avatarColor}
                  avatarSize={avatarSize}
                  tileSize={tileSize}
                  hasPassword={!!p.has_access_password}
                  onPress={() => handleProfilePress(p)}
                />
              );
            })}

            <AddProfileCard
              tileSize={tileSize}
              avatarSize={avatarSize}
              onPress={onAddProfile}
            />
          </View>

          <View style={styles.scrollBottomSpacer} />
        </ScrollView>

        {onLogout ? (
          <View style={styles.footer}>
            <TouchableOpacity activeOpacity={0.85} onPress={onLogout} style={styles.logoutBtn}>
              <LinearGradient
                colors={['#064b75', '#0b6aa0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.logoutGradient}
              />
              <Text style={styles.logoutText}>{t(lang, 'logout')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ProfilePasswordDialog
        visible={passwordDialogVisible}
        profileId={selectedProfile?.id ?? null}
        profileName={selectedProfile?.profile_label || t(lang, 'profile_default_name')}
        onSubmit={verifyPassword}
        onCancel={handlePasswordCancel}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // Hero section
  heroContainer: {
    position: 'relative',
    marginBottom: 0,
    overflow: 'hidden',
    // borderBottomLeftRadius: 22,
    // borderBottomRightRadius: 22,
  },
  heroGradient: {
    paddingBottom: 50,
    paddingHorizontal: 24,
    overflow: 'hidden',
    // borderBottomLeftRadius: 22,
    // borderBottomRightRadius: 22,
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: 20,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },
  heroCurve: {
    height: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 0,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: 0.2,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Content area
  cardsScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 16,
    columnGap: 16,
  },
  scrollBottomSpacer: {
    height: Platform.OS === 'android' ? 24 : 16,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  logoutBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoutGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
