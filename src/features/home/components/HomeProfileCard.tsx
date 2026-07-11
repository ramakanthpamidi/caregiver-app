import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileAvatar } from '../../profiles/lib/profileAvatar';

export type HomeProfileCardProps = {
  profileName: string;
  greeting?: string;
  dateLabel?: string;
  avatarSource?: any;
  initials?: string;
  onPress?: () => void;
  onClosePress?: () => void;
  collapsedHeight?: number;
  showCloseButton?: boolean;
};

export default function HomeProfileCard({
  profileName,
  greeting,
  dateLabel,
  avatarSource,
  initials,
  onPress,
  onClosePress,
  collapsedHeight = 180,
  showCloseButton = false,
}: HomeProfileCardProps) {
  const displayInitials = useMemo(() => {
    if (initials) return initials;
    const name = (profileName || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profileName, initials]);

  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <LinearGradient
      colors={['#064b75', '#0b6aa0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.container,
        {
          height: collapsedHeight,
          paddingTop: 12 + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 12),
        },
      ]}
    >
      <Wrapper
        activeOpacity={onPress ? 0.85 : 1}
        style={styles.content}
        onPress={onPress}
      >
        <View style={styles.textSection}>
          {greeting && <Text style={styles.greeting}>{greeting}</Text>}
          <Text style={styles.name} numberOfLines={1}>
            {profileName || 'Select Profile'}
          </Text>
          {dateLabel && <Text style={styles.dateText}>{dateLabel}</Text>}
        </View>
        <View style={styles.avatarSection}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.initialsWrap}>
              <Text style={styles.initialsText}>{displayInitials}</Text>
            </View>
          )}
        </View>
      </Wrapper>

      {showCloseButton && onClosePress && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onClosePress}
          style={[
            styles.closeButton,
            {
              top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 54,
            },
          ]}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textSection: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    marginBottom: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
  },
  avatarSection: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatar: {
    width: 64,
    height: 64,
  },
  initialsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: -1,
  },
});
