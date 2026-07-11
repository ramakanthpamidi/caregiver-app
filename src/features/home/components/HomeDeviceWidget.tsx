import React from 'react';
import { Image, Text, TouchableOpacity, View, StyleSheet, ImageSourcePropType } from 'react-native';

type Props = {
  icon: ImageSourcePropType;
  deviceName: string;
  valueText?: string | null;
  isConnected?: boolean;
  lastUpdate?: string;
  onPress?: () => void;
};

const HomeDeviceWidget = React.memo(function HomeDeviceWidget({
  icon,
  deviceName,
  valueText,
  isConnected = false,
  lastUpdate,
  onPress,
}: Props) {
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.container} activeOpacity={0.85} onPress={onPress}>
      {/* Left: Icon */}
      <View style={styles.iconWrap}>
        <Image source={icon} style={styles.icon} resizeMode="contain" />
      </View>

      {/* Middle: Device info */}
      <View style={styles.infoSection}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {deviceName}
        </Text>
        <Text style={styles.valueText} numberOfLines={1}>
          {valueText && String(valueText).trim().length > 0 ? valueText : '--'}
        </Text>
      </View>

      {/* Right: Status */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
          <Text style={[styles.statusText, isConnected ? styles.statusTextConnected : styles.statusTextDisconnected]}>
            {isConnected ? 'Connected' : 'Offline'}
          </Text>
        </View>
        {lastUpdate ? (
          <Text style={styles.lastUpdate} numberOfLines={1}>
            {lastUpdate}
          </Text>
        ) : null}
      </View>
    </Wrapper>
  );
});

export default HomeDeviceWidget;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    width: 28,
    height: 28,
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  statusSection: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusConnected: {
    backgroundColor: '#dcfce7',
  },
  statusDisconnected: {
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextConnected: {
    color: '#16a34a',
  },
  statusTextDisconnected: {
    color: '#9ca3af',
  },
  lastUpdate: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
