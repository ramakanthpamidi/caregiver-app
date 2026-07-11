import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

type Props = {
  title?: string;
  description?: string;
  count?: number;
  onPress?: () => void;
};

export default function ReminderSectionCard({
  title = 'Reminders',
  description = 'Manage your health reminders',
  count = 0,
  onPress,
}: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.container} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Image
          source={require('../../../../assets/android-res/drawable/reminder.png')}
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
      </View>

      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
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
    fontWeight: '500',
  },
  badge: {
    minWidth: 30,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#064b75',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
