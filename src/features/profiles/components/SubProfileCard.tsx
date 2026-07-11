import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ProfileAvatar } from '../lib/profileAvatar';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import { getAvatarColorForProfile, getCachedAvatarColor, getInitialsFromName, getSavedAvatarColor } from '../lib/avatarColors';

function formatLastUsed(lastUsed?: string | null): string {
  if (!lastUsed) return 'Never used';
  try {
    const date = new Date(lastUsed);
    if (isNaN(date.getTime())) return 'Never used';
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `Last used: ${day} ${month} ${year}`;
  } catch {
    return 'Never used';
  }
}

type Props = {
  profileId: number | string;
  profileName: string;
  lastUsed?: string | null;
  onPress?: () => void;
  isActive?: boolean;
  avatar?: ProfileAvatar | null;
};

export default function SubProfileCard({
  profileId,
  profileName,
  lastUsed = null,
  onPress,
  isActive = false,
  avatar = null,
}: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const initials = getInitialsFromName(profileName);
  const [avatarColor, setAvatarColor] = useState<string>(() => {
    const name = (profileName || '').trim();
    return getCachedAvatarColor(profileId) || (name ? getAvatarColorForProfile(name) : '#3B82F6');
  });

  useEffect(() => {
    const name = (profileName || '').trim();
    const cached = getCachedAvatarColor(profileId);
    if (cached) setAvatarColor(cached);
    else if (name) setAvatarColor(getAvatarColorForProfile(name));
    getSavedAvatarColor(profileId, profileName).then(setAvatarColor);
  }, [profileId, profileName]);

  return (
    <Wrapper style={[styles.container, isActive ? styles.containerActive : null]} activeOpacity={0.85} onPress={onPress}>
      {/* Profile Avatar */}
      <View style={[styles.avatarWrap, !avatar?.uri && { backgroundColor: avatarColor }]}>
        {avatar?.uri ? (
          <CroppedAvatarImage avatar={avatar} size={62} />
        ) : (
          <Text style={styles.avatarInitials}>{initials}</Text>
        )}
      </View>

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <Text style={styles.profileName} numberOfLines={1}>
          {profileName}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatLastUsed(lastUsed)}
        </Text>
      </View>

      {isActive ? (
        <View style={styles.activePill}>
          <Text style={styles.activePillText}>Active</Text>
        </View>
      ) : (
        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>›</Text>
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  containerActive: {
    borderWidth: 2,
    borderColor: '#3358FF',
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  chevronWrap: {
    paddingLeft: 8,
  },
  chevron: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '300',
  },
  activePill: {
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activePillText: {
    color: '#3358FF',
    fontWeight: '900',
    fontSize: 12,
  },
});
