import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { ProfileAvatar } from '../lib/profileAvatar';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import { getInitialsFromName } from '../lib/avatarColors';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type SelectProfileCardProps = {
  name: string;
  avatar: ProfileAvatar | null;
  avatarColor: string;
  avatarSize: number;
  tileSize: number;
  hasPassword: boolean;
  onPress: () => void;
};

export default function SelectProfileCard({
  name,
  avatar,
  avatarColor,
  avatarSize,
  tileSize,
  hasPassword,
  onPress,
}: SelectProfileCardProps) {
  const initials = getInitialsFromName(name);

  const avatarRingSize = avatarSize + 8;
  const avatarRingRadius = avatarRingSize / 2;

  // Reduce lock badge/icon to a comfortable readable size
  const lockBadgeSize = Math.round(Math.max(20, avatarSize * 0.22));

  const calcBadgePosition = (badgeSize: number, angleRad: number) => {
    const badgeRadius = badgeSize / 2;
    const cx = avatarRingRadius + Math.cos(angleRad) * avatarRingRadius;
    const cy = avatarRingRadius + Math.sin(angleRad) * avatarRingRadius;
    return { left: cx - badgeRadius, top: cy - badgeRadius };
  };

  const lockBadgePos = calcBadgePosition(lockBadgeSize, -Math.PI / 4);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.card, { width: tileSize, height: tileSize }]}
    >
      {/* Card background with subtle gradient */}
      <LinearGradient
        colors={['#ffffff', '#fafbfc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardGradient}
      >

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatarRing,
              {
                width: avatarRingSize,
                height: avatarRingSize,
                borderRadius: avatarRingRadius,
              },
            ]}
          >
            <View
              style={[
                styles.avatarContainer,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  backgroundColor: avatar ? '#e5e7eb' : avatarColor,
                },
              ]}
            >
              {avatar ? (
                <CroppedAvatarImage avatar={avatar} size={avatarSize} />
              ) : (
                <Text
                  style={[
                    styles.initialsText,
                    { fontSize: Math.max(22, avatarSize * 0.38) },
                  ]}
                >
                  {initials}
                </Text>
              )}
            </View>
          </View>



          {/* Password indicator */}
          {hasPassword && (
            <View
              style={[
                styles.lockBadge,
                {
                  width: lockBadgeSize,
                  height: lockBadgeSize,
                  borderRadius: lockBadgeSize / 2,
                  ...lockBadgePos,
                },
              ]}
            >
              <Image
                source={require('../../../../assets/android-res/drawable/lock2.png')}
                style={{ width: Math.round(lockBadgeSize * 0.62), height: Math.round(lockBadgeSize * 0.62), resizeMode: 'contain' }}
              />
            </View>
          )}
        </View>

        {/* Name section */}
        <View style={styles.nameSection}>
          <Text
            style={styles.nameText}
            numberOfLines={1}
          >
            {name}
          </Text>
          {/* Removed visual "Active" label to simplify card */}
        </View>

      </LinearGradient>
    </TouchableOpacity>
  );
}

type AddProfileCardProps = {
  tileSize: number;
  avatarSize: number;
  onPress: () => void;
};

export function AddProfileCard({ tileSize, avatarSize, onPress }: AddProfileCardProps) {
  const { lang } = useLanguage();
  const avatarFrameSize = avatarSize + 8;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.card, { width: tileSize, height: tileSize }]}
    >
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.cardGradient, styles.addCardGradient]}
      >
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.addCircleFrame,
              {
                width: avatarFrameSize,
                height: avatarFrameSize,
                borderRadius: avatarFrameSize / 2,
              },
            ]}
          >
            <View
              style={[
                styles.addCircle,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            >
              <LinearGradient
                colors={['#e2e8f0', '#cbd5e1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.addCircleGradient,
                  { borderRadius: avatarSize / 2 },
                ]}
              >
                <Text
                  style={[
                    styles.addPlusText,
                    { fontSize: Math.max(32, avatarSize * 0.45) },
                  ]}
                >
                  +
                </Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.addNameText}>{t(lang, 'add_profile')}</Text>
          <Text style={styles.addHintText}>{t(lang, 'select_profile_create_new')}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
  },
  cardActive: {
    borderColor: '#0ea5e9',
    borderWidth: 2,
  },
  glowRing: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    height: 120,
    backgroundColor: 'rgba(14,165,233,0.06)',
    borderRadius: 60,
  },

  // Avatar section
  avatarSection: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarRing: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  avatarRingActive: {
    borderColor: '#0ea5e9',
    borderWidth: 2.5,
    backgroundColor: 'rgba(14,165,233,0.1)',
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initialsText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Status badges
  statusBadge: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statusDot: {
    backgroundColor: '#10b981',
  },
  lockBadge: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  lockIcon: {
    includeFontPadding: false,
  },

  // Name section
  nameSection: {
    alignItems: 'center',
    marginTop: 2,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  nameTextActive: {
    color: '#0369a1',
  },
  

  // Bottom accent
  bottomAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // Add Profile Card
  addCardGradient: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
  },
  addCircleFrame: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  addCircle: {
    overflow: 'hidden',
  },
  addCircleGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlusText: {
    color: '#64748b',
    fontWeight: '300',
    marginTop: -2,
  },
  addNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  addHintText: {
    marginTop: 4,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
