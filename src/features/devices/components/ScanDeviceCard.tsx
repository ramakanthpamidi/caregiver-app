import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { BorderWidth, Colors, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';
import { isWeightScaleText } from '../../../shared/lib/ailinkScale';

export type DeviceSummary = {
  id: number;
  device_type?: string;
  device_uuid?: string;
  device_id?: string;
  device_name?: string;
  factory_name?: string;
  display_name?: string;
  medical_device_type?: string;
  platform?: string;
  endpoint_uuid?: string;
  status?: string;
  granted_at?: string;
  granted_by?: number | null;
  can_rename?: boolean;
};

type Props = {
  device: DeviceSummary;
  onPress?: (device: DeviceSummary) => void;
};

// Map device type keywords to bundled static icons
const TYPE_ICONS: { [k: string]: any } = {
  oximeter: require('../../../../assets/android-res/drawable/oximeter.png'),
  pressure: require('../../../../assets/android-res/drawable/pressure_monitor.png'),
  thermometer: require('../../../../assets/android-res/drawable/thermometer.png'),
  glucose: require('../../../../assets/android-res/drawable/glucose_monitor.png'),
  scale: require('../../../../assets/android-res/drawable/weight_scale.png'),
  default: require('../../../../assets/android-res/drawable/WellScreen512BG.png'),
};

export function getIconForDevice(d: DeviceSummary) {
  const text = (
    `${d.medical_device_type || ''} ${d.device_type || ''} ${d.display_name || ''} ${d.device_name || ''} ${d.factory_name || ''}`
  ).toLowerCase();
  // Model codes like BO-YX310 do not contain the word "oximeter"
  if (text.includes('oximeter') || /\bbo[-\s]?yx/i.test(text) || /\byx\d{2,}/i.test(text)) return TYPE_ICONS.oximeter;
  if (text.includes('pressure')) return TYPE_ICONS.pressure;
  if (text.includes('thermometer')) return TYPE_ICONS.thermometer;
  if (text.includes('glucose')) return TYPE_ICONS.glucose;
  if (isWeightScaleText(text)) return TYPE_ICONS.scale;
  return TYPE_ICONS.default;
}

const ScanDeviceCard = React.memo(function ScanDeviceCard({ device, onPress }: Props) {
  return (
    <View style={styles.subCard}>
      <TouchableOpacity
        style={[styles.rowItemInner, styles.rowItemInnerLast]}
        activeOpacity={0.8}
        onPress={() => onPress?.(device)}
      >
        <View style={styles.actionLeftRow}>
          <View style={styles.actionIconWrap}>
            <Image source={getIconForDevice(device)} style={styles.actionIcon} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.actionTitle}>{device.device_name || device.factory_name || device.device_id || 'Device'}</Text>
            <Text style={styles.actionSubtitle}>{device.granted_at ? ` ${device.granted_at}` : ''}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
});

export default ScanDeviceCard;

const styles = StyleSheet.create({
  subCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: 0,
    ...Shadows.soft,
  },
  rowItemInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md + Spacing.xs,
    borderBottomWidth: BorderWidth.sm,
    borderBottomColor: Colors.borderSoft,
  },
  rowItemInnerLast: { borderBottomWidth: 0 },
  actionLeftRow: { flexDirection: 'row', alignItems: 'center' },
  textWrap: { marginLeft: Spacing.md },
  actionIconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 36, height: 36, resizeMode: 'contain' },
  actionTitle: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  actionSubtitle: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    marginTop: Spacing.xs,
  },
  chevron: {
    color: Colors.gray300,
    fontSize: 20,
  },
});
