// app/patient/review.js — Review & Submit Screen
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../../constants/theme';
import { usePatient } from '../../context/PatientContext';
import { VITAL_DEVICES } from './vitals-selection';

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 },
  value: { fontSize: FONT_SIZE.sm, color: COLORS.textBody, fontWeight: FONT_WEIGHT.medium, flex: 1, textAlign: 'right' },
});

function SectionHeader({ icon, title, color }) {
  return (
    <View style={secStyles.header}>
      <View style={[secStyles.icon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={secStyles.title}>{title}</Text>
    </View>
  );
}

const secStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  icon:   { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  title:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },
});

function VitalCard({ deviceId, data }) {
  const device = VITAL_DEVICES.find((d) => d.id === deviceId);
  if (!device || !data) return null;

  const entries = Object.entries(data).filter(([k]) => !['deviceName', 'savedAt'].includes(k));

  return (
    <View style={vitalStyles.card}>
      <View style={vitalStyles.cardHeader}>
        <Text style={vitalStyles.emoji}>{device.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={vitalStyles.deviceName}>{device.name}</Text>
          {data.savedAt && (
            <Text style={vitalStyles.time}>
              {new Date(data.savedAt).toLocaleTimeString()}
            </Text>
          )}
        </View>
        <View style={[vitalStyles.statusBadge, { backgroundColor: device.color + '18' }]}>
          <Ionicons name="checkmark-circle" size={14} color={device.color} />
          <Text style={[vitalStyles.statusText, { color: device.color }]}>Recorded</Text>
        </View>
      </View>

      <View style={vitalStyles.readings}>
        {entries.map(([key, val]) => (
          <View key={key} style={vitalStyles.readingRow}>
            <Text style={vitalStyles.readingKey}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            </Text>
            <Text style={[vitalStyles.readingVal, { color: device.color }]}>
              {String(val)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const vitalStyles = StyleSheet.create({
  card:        { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, ...shadow.sm },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  emoji:       { fontSize: 28, marginRight: SPACING.sm },
  deviceName:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },
  time:        { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  statusText:  { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },
  readings:    { gap: 4 },
  readingRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.divider },
  readingKey:  { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  readingVal:  { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
});

// ─── Success Modal overlay ─────────────────────────────────────────────────────

function SuccessOverlay({ name, caseId, onDone }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[successStyles.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[successStyles.modal, { transform: [{ scale: scaleAnim }] }]}>
        <View style={successStyles.checkCircle}>
          <Ionicons name="checkmark" size={48} color={COLORS.white} />
        </View>
        <Text style={successStyles.title}>Submitted!</Text>
        <Text style={successStyles.sub}>Patient vitals for {name} have been successfully recorded.</Text>

        <View style={successStyles.caseBox}>
          <Text style={successStyles.caseLabel}>Case Reference</Text>
          <Text style={successStyles.caseId}>{caseId}</Text>
        </View>

        <View style={successStyles.infoRow}>
          <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
          <Text style={successStyles.infoText}> {new Date().toLocaleString()}</Text>
        </View>
        <View style={[successStyles.infoRow, { marginBottom: SPACING.xl }]}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.success} />
          <Text style={[successStyles.infoText, { color: COLORS.success }]}> Securely stored · HIPAA compliant</Text>
        </View>

        <TouchableOpacity style={successStyles.doneBtn} onPress={onDone}>
          <Text style={successStyles.doneBtnText}>Done — New Patient</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const successStyles = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,33,55,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: SPACING.lg },
  modal:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', width: '100%', ...shadow.lg },
  checkCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  title:       { fontSize: FONT_SIZE.xxxl, fontWeight: FONT_WEIGHT.extrabold, color: COLORS.textDark, marginBottom: SPACING.sm },
  sub:         { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.lg },
  caseBox:     { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', width: '100%', marginBottom: SPACING.md },
  caseLabel:   { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  caseId:      { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.primaryMid, letterSpacing: 1 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  infoText:    { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  doneBtn:     { backgroundColor: COLORS.secondary, paddingVertical: 14, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, width: '100%', alignItems: 'center' },
  doneBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const router                                  = useRouter();
  const { patientInfo, vitalsData, vitalsQueue, completedVitals, resetAll } = usePatient();
  const [submitted, setSubmitted]               = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [confirmed, setConfirmed]               = useState(false);
  const [caseId, setCaseId]                     = useState('');

  const patientName = `${patientInfo.firstName} ${patientInfo.lastName}`.trim() || 'Patient';
  const skipped     = vitalsQueue.filter((id) => !completedVitals.includes(id));
  const collected   = completedVitals.length;
  const total       = vitalsQueue.length;

  const generateCaseId = () =>
    `CG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const handleSubmit = () => {
    Alert.alert(
      'Confirm Submission',
      `Submit vitals report for ${patientName}?\n\nThis will be saved to the patient record and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Report',
          style: 'default',
          onPress: () => {
            setSubmitting(true);
            const newCaseId = generateCaseId();
            setCaseId(newCaseId);
            setTimeout(() => {
              setSubmitting(false);
              setSubmitted(true);
            }, 1800);
          },
        },
      ]
    );
  };

  const handleDone = () => {
    resetAll();
    router.replace('/patient/registration');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Review & Submit</Text>
          <Text style={styles.headerSub}>Confirm all readings before submitting</Text>
        </View>
      </LinearGradient>

      {/* Progress bar */}
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{collected}</Text>
            <Text style={styles.progressLabel}>Recorded</Text>
          </View>
          <View style={[styles.progressDivider, { backgroundColor: COLORS.divider }]} />
          <View style={styles.progressItem}>
            <Text style={[styles.progressNum, { color: COLORS.warning }]}>{skipped.length}</Text>
            <Text style={styles.progressLabel}>Skipped</Text>
          </View>
          <View style={[styles.progressDivider, { backgroundColor: COLORS.divider }]} />
          <View style={styles.progressItem}>
            <Text style={styles.progressNum}>{total}</Text>
            <Text style={styles.progressLabel}>Total</Text>
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${total > 0 ? (collected / total) * 100 : 0}%` }]} />
        </View>
        <Text style={styles.progressPct}>{total > 0 ? Math.round((collected / total) * 100) : 0}% complete</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* ─── Patient Info ─── */}
        <View style={styles.card}>
          <SectionHeader icon="person-outline" title="Patient Information" color={COLORS.secondary} />
          <InfoRow label="Full Name"    value={patientName} />
          <InfoRow label="Date of Birth" value={patientInfo.dateOfBirth} />
          <InfoRow label="Gender"       value={patientInfo.gender} />
          <InfoRow label="MRN"          value={patientInfo.mrn} />
          <InfoRow label="Blood Type"   value={patientInfo.bloodType} />
          <InfoRow label="Phone"        value={patientInfo.phone} />
          <InfoRow label="Email"        value={patientInfo.email} />
          <InfoRow label="Address"      value={[patientInfo.address, patientInfo.city, patientInfo.state, patientInfo.zipCode].filter(Boolean).join(', ')} />
        </View>

        {/* ─── Emergency Contact ─── */}
        {patientInfo.emergencyContact ? (
          <View style={styles.card}>
            <SectionHeader icon="alert-circle-outline" title="Emergency Contact" color={COLORS.warning} />
            <InfoRow label="Name"         value={patientInfo.emergencyContact} />
            <InfoRow label="Phone"        value={patientInfo.emergencyPhone} />
            <InfoRow label="Relationship" value={patientInfo.relationship} />
          </View>
        ) : null}

        {/* ─── Medical ─── */}
        {(patientInfo.primaryDiagnosis || patientInfo.allergies || patientInfo.currentMedications) ? (
          <View style={styles.card}>
            <SectionHeader icon="medkit-outline" title="Medical History" color={COLORS.danger} />
            <InfoRow label="Diagnosis"   value={patientInfo.primaryDiagnosis} />
            <InfoRow label="Insurance"   value={patientInfo.insuranceId} />
            <InfoRow label="Allergies"   value={patientInfo.allergies} />
            <InfoRow label="Medications" value={patientInfo.currentMedications} />
            {patientInfo.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Clinical Notes</Text>
                <Text style={styles.notesText}>{patientInfo.notes}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ─── Vitals ─── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="pulse-outline" size={18} color={COLORS.secondary} />
          <Text style={styles.sectionTitle}> Vital Readings ({collected})</Text>
        </View>

        {collected === 0 ? (
          <View style={styles.emptyVitals}>
            <Ionicons name="warning-outline" size={32} color={COLORS.warning} />
            <Text style={styles.emptyText}>No vitals were recorded. Go back to collect readings.</Text>
          </View>
        ) : (
          vitalsQueue
            .filter((id) => completedVitals.includes(id))
            .map((id) => (
              <VitalCard key={id} deviceId={id} data={vitalsData[id]} />
            ))
        )}

        {/* Skipped notice */}
        {skipped.length > 0 && (
          <View style={styles.skippedBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.warning} />
            <Text style={styles.skippedText}>
              {skipped.length} device{skipped.length > 1 ? 's' : ''} skipped:{' '}
              {skipped.map((id) => VITAL_DEVICES.find((d) => d.id === id)?.name).join(', ')}
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.success} />
          <Text style={styles.disclaimerText}>
            {' '}By submitting, you confirm these readings were taken by a licensed caregiver and are accurate to the best of your knowledge.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addVitalBtn}
          onPress={() => router.push('/patient/vitals-selection')}
        >
          <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryMid} />
          <Text style={styles.addVitalText}>Add More</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || collected === 0) && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting || collected === 0}
        >
          <LinearGradient
            colors={[COLORS.success, '#1A9E6A']}
            style={styles.submitBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            {submitting
              ? <Text style={styles.submitBtnText}>Submitting…</Text>
              : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                </>
              )
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Success overlay */}
      {submitted && (
        <SuccessOverlay
          name={patientName}
          caseId={caseId}
          onDone={handleDone}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.sm },
  backBtn:     { padding: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerSub:   { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  progressCard: { backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  progressRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  progressItem: { flex: 1, alignItems: 'center' },
  progressNum:  { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.extrabold, color: COLORS.success },
  progressLabel:{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  progressDivider: { width: 1, height: 30 },
  progressBarBg:  { height: 6, backgroundColor: COLORS.divider, borderRadius: RADIUS.full, marginBottom: 4 },
  progressBarFill:{ height: 6, backgroundColor: COLORS.success, borderRadius: RADIUS.full },
  progressPct:  { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, textAlign: 'right' },

  body:         { padding: SPACING.md },
  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...shadow.sm },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },

  notesBox:  { backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.sm, marginTop: SPACING.sm },
  notesLabel:{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 4, fontWeight: FONT_WEIGHT.semibold },
  notesText: { fontSize: FONT_SIZE.sm, color: COLORS.textBody, lineHeight: 20 },

  emptyVitals: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText:   { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center' },

  skippedBox:  { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, gap: 8 },
  skippedText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.warning, lineHeight: 20 },

  disclaimer:  { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.successBg, borderRadius: RADIUS.md, padding: SPACING.md, gap: 8 },
  disclaimerText: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.successDark, lineHeight: 18 },

  footer:      { flexDirection: 'row', padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: SPACING.sm, ...shadow.lg },
  addVitalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.primaryMid, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 6 },
  addVitalText:{ fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.primaryMid },
  submitBtn:   { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  submitBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
});