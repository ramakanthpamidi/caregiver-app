// components/DeviceScreen.js
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../constants/theme';
import { usePatient } from '../context/PatientContext';

const STATE = {
  IDLE:       'idle',
  CONNECTING: 'connecting',
  CONNECTED:  'connected',
  READING:    'reading',
  COMPLETE:   'complete',
};

export default function DeviceScreen({ config }) {
  const router                              = useRouter();
  const { saveVitalReading, getNextVital }  = usePatient();
  const [phase, setPhase]                   = useState(STATE.IDLE);
  const [readings, setReadings]             = useState({});
  const [dots, setDots]                     = useState('');
  const [liveNote, setLiveNote]             = useState(null);

  const phaseRef = useRef(STATE.IDLE);
  phaseRef.current = phase;

  // Stop BLE when leaving the screen
  useEffect(() => () => { config.ble?.stop?.(); }, [config.ble]);

  // Animations
  const pulseScale  = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;
  const checkScale  = useRef(new Animated.Value(0)).current;

  // Pulsing ring during connecting / reading
  useEffect(() => {
    if (phase === STATE.CONNECTING || phase === STATE.READING) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseScale,  { toValue: 1.25, duration: 700, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0.6,  duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseScale,  { toValue: 1,   duration: 700, useNativeDriver: true }),
            Animated.timing(ringOpacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseScale.setValue(1);
    ringOpacity.setValue(0);
  }, [phase]);

  // Dot animation for status text
  useEffect(() => {
    if (phase === STATE.CONNECTING || phase === STATE.READING) {
      const id = setInterval(() => setDots((d) => (d.length < 3 ? d + '.' : '')), 400);
      return () => clearInterval(id);
    }
  }, [phase]);

  // Success check bounce
  useEffect(() => {
    if (phase === STATE.COMPLETE) {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [phase]);

  const startScan = () => {
    if (config.ble) {
      startBleSession();
    } else {
      runSimulation();
    }
  };

  const startBleSession = () => {
    setLiveNote(null);
    setPhase(STATE.CONNECTING);

    config.ble.start({
      onStatus: (status) => {
        if (status === 'connected') {
          setPhase(STATE.READING);
        }
      },
      onLive: (values, note) => {
        if (phaseRef.current === STATE.COMPLETE) return;
        if (values) setReadings((prev) => ({ ...prev, ...values }));
        setLiveNote(note ?? null);
        setPhase(STATE.READING);
      },
      onFinal: (values) => {
        setReadings((prev) => ({ ...prev, ...values }));
        setLiveNote(null);
        setPhase(STATE.COMPLETE);
        config.ble.stop();
      },
      onDisconnected: () => {
        if (phaseRef.current === STATE.COMPLETE || phaseRef.current === STATE.IDLE) return;
        handleBleError('The device disconnected before the reading finished. Please try again.');
      },
      onError: (message) => {
        if (phaseRef.current === STATE.COMPLETE) return;
        handleBleError(message);
      },
    });
  };

  const handleBleError = (message) => {
    config.ble?.stop?.();
    setLiveNote(null);
    setPhase(STATE.IDLE);
    Alert.alert('Bluetooth', message, [
      { text: 'OK', style: 'cancel' },
      { text: 'Use Simulated Reading', onPress: runSimulation },
    ]);
  };

  const runSimulation = () => {
    setPhase(STATE.CONNECTING);

    // Simulate connecting (2 s)
    setTimeout(() => {
      setPhase(STATE.CONNECTED);

      // Immediately start reading
      setTimeout(() => {
        setPhase(STATE.READING);

        let tick = 0;
        const interval = setInterval(() => {
          tick++;
          const live = {};
          config.readings.forEach((r) => { live[r.key] = r.simulate(); });
          setReadings(live);

          if (tick >= 6) {
            clearInterval(interval);
            // Settle on final values
            const final = {};
            config.readings.forEach((r) => { final[r.key] = r.simulate(); });
            setReadings(final);
            setPhase(STATE.COMPLETE);
          }
        }, 450);
      }, 800);
    }, 2200);
  };

  const handleSave = () => {
    saveVitalReading(config.id, { ...readings, deviceName: config.name });
    navigateNext();
  };

  const handleRetake = () => {
    config.ble?.stop?.();
    setReadings({});
    setLiveNote(null);
    checkScale.setValue(0);
    fadeIn.setValue(0);
    setPhase(STATE.IDLE);
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Device',
      `Skip ${config.name}? No reading will be recorded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: navigateNext },
      ]
    );
  };

  const navigateNext = () => {
    const next = getNextVital(config.id);
    if (next) {
      router.replace(`/patient/vitals/${next}`);
    } else {
      router.replace('/patient/review');
    }
  };

  /* ─── Render helpers ───────────────────────────── */

  const statusLabel = {
    [STATE.IDLE]:       'Ready to connect',
    [STATE.CONNECTING]: `Connecting${dots}`,
    [STATE.CONNECTED]:  '✓ Device connected',
    [STATE.READING]:    `Reading data${dots}`,
    [STATE.COMPLETE]:   'Reading complete',
  }[phase];

  const statusColor = phase === STATE.COMPLETE ? COLORS.success
    : phase === STATE.CONNECTED                ? COLORS.success
    : COLORS.secondary;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{config.name}</Text>
          <Text style={styles.headerSub}>Vitals Collection</Text>
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* Device Icon + pulse ring */}
        <View style={styles.deviceArea}>
          {/* Outer ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              { backgroundColor: config.color + '30', transform: [{ scale: pulseScale }], opacity: ringOpacity },
            ]}
          />
          {/* Icon circle */}
          <Animated.View
            style={[
              styles.iconCircle,
              { backgroundColor: config.color + '18' },
              phase !== STATE.IDLE && { transform: [{ scale: pulseScale }] },
            ]}
          >
            <Text style={styles.deviceEmoji}>{config.emoji}</Text>
          </Animated.View>

          {/* Completed check badge */}
          {phase === STATE.COMPLETE && (
            <Animated.View style={[styles.checkBadge, { transform: [{ scale: checkScale }] }]}>
              <Ionicons name="checkmark" size={14} color={COLORS.white} />
            </Animated.View>
          )}
        </View>

        {/* Status row */}
        <View style={styles.statusRow}>
          {phase !== STATE.IDLE && (
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Live device note (cuff pressure, prompts, warnings) */}
        {liveNote != null && (
          <View style={styles.liveNoteRow}>
            <Ionicons name="radio-outline" size={14} color={COLORS.secondary} />
            <Text style={styles.liveNoteText}>{liveNote}</Text>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
          <Text style={styles.instructionText}>{config.instructions}</Text>
        </View>

        {/* Readings panel */}
        {(phase === STATE.READING || phase === STATE.COMPLETE) && Object.keys(readings).length > 0 && (
          <Animated.View style={[styles.readingsPanel, phase === STATE.COMPLETE && { opacity: fadeIn }]}>
            <Text style={styles.readingsPanelTitle}>
              {phase === STATE.COMPLETE ? 'Measured Values' : 'Live Reading…'}
            </Text>
            {config.readings.map((r) => (
              <View key={r.key} style={styles.readingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.readingLabel}>{r.label}</Text>
                </View>
                <View style={styles.readingValueWrap}>
                  <Text style={[styles.readingValue, { color: config.color }]}>
                    {readings[r.key] ?? '—'}
                  </Text>
                  <Text style={styles.readingUnit}>{r.unit}</Text>
                </View>
              </View>
            ))}

            {phase === STATE.COMPLETE && (
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                <Text style={styles.timestampText}>
                  {'  '}Recorded at {new Date().toLocaleTimeString()}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.actions}>
        {phase === STATE.IDLE && (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={startScan}>
            <Ionicons name="bluetooth-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
            <Text style={styles.btnPrimaryText}>Connect & Scan</Text>
          </TouchableOpacity>
        )}

        {(phase === STATE.CONNECTING || phase === STATE.READING || phase === STATE.CONNECTED) && (
          <View style={[styles.btn, styles.btnDisabled]}>
            <Text style={styles.btnDisabledText}>
              {phase === STATE.CONNECTING ? 'Connecting…' : phase === STATE.CONNECTED ? 'Connected…' : 'Reading…'}
            </Text>
          </View>
        )}

        {phase === STATE.COMPLETE && (
          <View style={styles.completeActions}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleRetake}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.primaryMid} style={{ marginRight: 6 }} />
              <Text style={styles.btnOutlineText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSave, { flex: 2 }]} onPress={handleSave}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.btnPrimaryText}>Save & Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const ICON_SIZE = 130;

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  backBtn:         { padding: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 8 },
  headerCenter:    { flex: 1 },
  headerTitle:     { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerSub:       { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  skipBtn:         { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  skipText:        { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.9)', fontWeight: FONT_WEIGHT.medium },

  body:            { flex: 1 },
  bodyContent:     { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },

  deviceArea:      { width: ICON_SIZE + 60, height: ICON_SIZE + 60, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  pulseRing:       { position: 'absolute', width: ICON_SIZE + 60, height: ICON_SIZE + 60, borderRadius: (ICON_SIZE + 60) / 2 },
  iconCircle:      { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  deviceEmoji:     { fontSize: 52 },
  checkBadge:      { position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', ...shadow.sm },

  statusRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  liveNoteRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -SPACING.md, marginBottom: SPACING.lg, paddingHorizontal: SPACING.md },
  liveNoteText:    { fontSize: FONT_SIZE.xs, color: COLORS.secondary, fontWeight: FONT_WEIGHT.medium, flexShrink: 1, textAlign: 'center' },
  statusDot:       { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText:      { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },

  instructionCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'flex-start', width: '100%', marginBottom: SPACING.lg, ...shadow.xs, borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
  instructionText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.textBody, lineHeight: 20 },

  readingsPanel:       { width: '100%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...shadow.sm },
  readingsPanelTitle:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: SPACING.md },
  readingRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  readingLabel:        { fontSize: FONT_SIZE.md, color: COLORS.textBody, fontWeight: FONT_WEIGHT.medium },
  readingValueWrap:    { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  readingValue:        { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  readingUnit:         { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.medium },
  timestampRow:        { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  timestampText:       { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  actions:         { padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.divider, ...shadow.lg },
  btn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: RADIUS.md },
  btnPrimary:      { backgroundColor: COLORS.secondary },
  btnSave:         { backgroundColor: COLORS.success },
  btnPrimaryText:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  btnOutline:      { flex: 1, borderWidth: 1.5, borderColor: COLORS.primaryMid, marginRight: SPACING.sm },
  btnOutlineText:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.primaryMid },
  btnDisabled:     { backgroundColor: COLORS.divider },
  btnDisabledText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textMuted },
  completeActions: { flexDirection: 'row', gap: SPACING.sm },
});
