import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

type Props = {
  title?: string;
  description?: string;
  progress?: number; // 0-100
  hideProgress?: boolean;
  onPress?: () => void;
};

export default function GoalSectionCard({
  title = 'Set Your Goals',
  description = 'Track your health targets',
  progress = 0,
  hideProgress = false,
  onPress,
}: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.container} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Image
          source={require('../../../../assets/android-res/drawable/goal.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.description} numberOfLines={1}>
          {description}
        </Text>
        {!hideProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        )}
      </View>

      <View style={styles.chevronWrap}>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  icon: {
    width: 36,
    height: 36,
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 999,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6b7280',
    minWidth: 32,
    textAlign: 'right',
  },
  chevronWrap: {
    paddingLeft: 8,
  },
  chevron: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '300',
  },
});
