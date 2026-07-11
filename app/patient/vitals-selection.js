// app/patient/vitals-selection.js — Vitals Device Selection
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../../constants/theme';
import { usePatient } from '../../context/PatientContext';

export const VITAL_DEVICES = [
  {
    id:           'oximeter',
    name:         'Pulse Oximeter',
    shortName:    'SpO₂',
    emoji:        '🫁',
    color:        COLORS.deviceOximeter,
    description:  'Blood oxygen & heart rate',
    icon:         'pulse-outline',
  },
  {
    id:           'bp-monitor',
    name:         'BP Monitor',
    shortName:    'Blood Pressure',
    emoji:        '💓',
    color:        COLORS.deviceBP,
    description:  'Systolic & diastolic pressure',
    icon:         'fitness-outline',
  },
  {
    id:           'weight-scale',
    name:         'Weight Scale',
    shortName:    'Weight',
    emoji:        '⚖️',
    color:        COLORS.deviceWeight,
    description:  'Body weight measurement',
    icon:         'barbell-outline',
  },
  {
    id:           'body-fat-scale',
    name:         'Body Fat Scale',
    shortName:    'Body Composition',
    emoji:        '🧍',
    color:        COLORS.deviceWeight,
    description:  '8-electrode BIA: fat, muscle, water',
    icon:         'body-outline',
  },
  {
    id:           'thermometer',
    name:         'Thermometer',
    shortName:    'Temperature',
    emoji:        '🌡️',
    color:        COLORS.deviceThermo,
    description:  'Body temperature reading',
    icon:         'thermometer-outline',
  },
  {
    id:           'glucometer',
    name:         'Glucometer',
    shortName:    'Blood Glucose',
    emoji:        '🩸',
    color:        COLORS.deviceGluco,
    description:  'Blood sugar level',
    icon:         'water-outline',
  },
  {
    id:           'height-weight',
    name:         'Height & Weight',
    shortName:    'Anthropometrics',
    emoji:        '📏',
    color:        COLORS.deviceHW,
    description:  'Height, BMI & body comp.',
    icon:         'body-outline',
  },
  {
    id:           'cgm',
    name:         'CGM / CT3',
    shortName:    'Continuous Glucose',
    emoji:        '📡',
    color:        COLORS.deviceCGM,
    description:  'Continuous glucose monitor',
    icon:         'analytics-outline',
  },
  {
    id:           'smart-watch',
    name:         'Smart Watch',
    shortName:    'Wearable',
    emoji:        '⌚',
    color:        COLORS.deviceWatch,
    description:  'Multi-vital wearable sync',
    icon:         'watch-outline',
  },
];

export default function VitalsSelectionScreen() {
  const router = useRouter();
  const { patientInfo, initVitalsQueue } = usePatient();
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selected.length === 0) {
      Alert.alert('No Devices', 'Please select at least one vital device to continue.'); return;
    }
    // Maintain the display order
    const ordered = VITAL_DEVICES.filter((d) => selected.includes(d.id)).map((d) => d.id);
    initVitalsQueue(ordered);
    router.push(`/patient/vitals/${ordered[0]}`);
  };

  const patientName = `${patientInfo.firstName} ${patientInfo.lastName}`.trim() || 'Patient';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Vitals Collection</Text>
          <Text style={styles.headerSub} numberOfLines={1}>Patient: {patientName}</Text>
        </View>
      </LinearGradient>

      {/* Instruction banner */}
      <View style={styles.instructionBanner}>
        <Ionicons name="information-circle-outline" size={16} color={COLORS.primaryLight} />
        <Text style={styles.instructionText}>
          Select the devices to use. Readings will be collected in the order shown.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Selection counter */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {selected.length === 0 ? 'No devices selected' : `${selected.length} device${selected.length > 1 ? 's' : ''} selected`}
          </Text>
          {selected.length > 0 && (
            <TouchableOpacity onPress={() => setSelected([])}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Device Grid */}
        <View style={styles.grid}>
          {VITAL_DEVICES.map((device) => {
            const isSelected = selected.includes(device.id);
            const order = selected.indexOf(device.id) + 1;
            return (
              <TouchableOpacity
                key={device.id}
                style={[styles.deviceCard, isSelected && { borderColor: device.color, borderWidth: 2 }]}
                onPress={() => toggle(device.id)}
                activeOpacity={0.8}
              >
                {/* Selection badge */}
                {isSelected && (
                  <View style={[styles.orderBadge, { backgroundColor: device.color }]}>
                    <Text style={styles.orderBadgeText}>{order}</Text>
                  </View>
                )}

                {/* Icon */}
                <View style={[styles.deviceIconBg, { backgroundColor: device.color + '18' }]}>
                  <Text style={styles.deviceEmoji}>{device.emoji}</Text>
                </View>

                <Text style={styles.deviceName}>{device.shortName}</Text>
                <Text style={styles.deviceDesc} numberOfLines={2}>{device.description}</Text>

                {/* Checkbox */}
                <View style={[styles.checkbox, isSelected && { backgroundColor: device.color, borderColor: device.color }]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected list preview */}
        {selected.length > 0 && (
          <View style={styles.queueCard}>
            <Text style={styles.queueTitle}>Collection Order</Text>
            {VITAL_DEVICES.filter((d) => selected.includes(d.id)).map((d, i) => (
              <View key={d.id} style={styles.queueRow}>
                <View style={[styles.queueNum, { backgroundColor: d.color }]}>
                  <Text style={styles.queueNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.queueEmoji}>{d.emoji}</Text>
                <Text style={styles.queueName}>{d.name}</Text>
                <Ionicons name="arrow-forward-outline" size={14} color={COLORS.textMuted} />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, selected.length === 0 && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={selected.length === 0}
          activeOpacity={0.88}
        >
          <Ionicons name="bluetooth-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
          <Text style={styles.startBtnText}>
            {selected.length === 0 ? 'Select a Device to Start' : `Start Collection (${selected.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn:         { padding: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle:     { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerSub:       { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  instructionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.infoBg, paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8 },
  instructionText:   { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.info, lineHeight: 18 },

  body:            { padding: SPACING.md },
  counterRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  counterText:     { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.medium },
  clearText:       { fontSize: FONT_SIZE.sm, color: COLORS.danger, fontWeight: FONT_WEIGHT.semibold },

  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  deviceCard:      { width: '48.3%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.divider, ...shadow.sm, marginBottom: 2 },
  orderBadge:      { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  orderBadgeText:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  deviceIconBg:    { width: 54, height: 54, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  deviceEmoji:     { fontSize: 28 },
  deviceName:      { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark, marginBottom: 2 },
  deviceDesc:      { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 16, marginBottom: SPACING.sm },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.divider, alignItems: 'center', justifyContent: 'center' },

  queueCard:       { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md, ...shadow.sm },
  queueTitle:      { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.md },
  queueRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  queueNum:        { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  queueNumText:    { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  queueEmoji:      { fontSize: 18, marginRight: 8 },
  queueName:       { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, color: COLORS.textBody },

  footer:          { padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.divider, ...shadow.lg },
  startBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, paddingVertical: 15, borderRadius: RADIUS.md },
  startBtnDisabled:{ backgroundColor: COLORS.textDisabled },
  startBtnText:    { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
});
