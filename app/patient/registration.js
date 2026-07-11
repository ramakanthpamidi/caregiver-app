// app/patient/registration.js — Patient Registration
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormInput from '../../components/FormInput';
import { usePatient } from '../../context/PatientContext';

import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../../constants/theme';

const GENDERS    = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

function SectionCard({ icon, title, color = COLORS.secondary, children }) {
  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <View style={[sectionStyles.iconBadge, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={sectionStyles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  iconBadge:  { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  cardTitle:  { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textDark },
});

export default function PatientRegistrationScreen() {
  const router = useRouter();
  const { patientInfo, updatePatientInfo } = usePatient();

  const up = (key) => (val) => updatePatientInfo({ [key]: val });

  const [selectedGender, setSelectedGender]     = useState(patientInfo.gender || '');
  const [selectedBloodType, setSelectedBloodType] = useState(patientInfo.bloodType || '');

  const handleContinue = () => {
    if (!patientInfo.firstName || !patientInfo.lastName || !patientInfo.dateOfBirth) {
      Alert.alert('Required Fields', 'Please fill in at least: First Name, Last Name, and Date of Birth.'); return;
    }
    updatePatientInfo({ gender: selectedGender, bloodType: selectedBloodType });
    router.push('/patient/vitals-selection');
  };

  const handleBack = () => {
    Alert.alert('Leave Registration?', 'Unsaved information will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.replace('/') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryMid]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>New Patient</Text>
          <Text style={styles.headerSub}>Registration Form</Text>
        </View>
        <View style={styles.patientBadge}>
          <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
        </View>
      </LinearGradient>

      {/* Sub-header bar */}
      <View style={styles.subBar}>
        <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.success} />
        <Text style={styles.subBarText}> HIPAA-compliant · Data encrypted at rest</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ─── Personal Info ─── */}
          <SectionCard icon="person-outline" title="Personal Information">
            <View style={styles.row}>
              <FormInput label="First Name" value={patientInfo.firstName} onChangeText={up('firstName')} placeholder="John" icon="person-outline" required containerStyle={{ flex: 1, marginRight: 8 }} />
              <FormInput label="Last Name"  value={patientInfo.lastName}  onChangeText={up('lastName')}  placeholder="Smith" icon="person-outline" required containerStyle={{ flex: 1 }} />
            </View>
            <FormInput label="Date of Birth" value={patientInfo.dateOfBirth} onChangeText={up('dateOfBirth')} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" icon="calendar-outline" required />
            <FormInput label="Medical Record # (MRN)" value={patientInfo.mrn} onChangeText={up('mrn')} placeholder="MRN-000000" icon="barcode-outline" autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, selectedGender === g && styles.chipActive]}
                  onPress={() => setSelectedGender(g)}
                >
                  <Text style={[styles.chipText, selectedGender === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Blood Type</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[styles.chip, selectedBloodType === bt && styles.chipBloodActive]}
                  onPress={() => setSelectedBloodType(bt)}
                >
                  <Text style={[styles.chipText, selectedBloodType === bt && styles.chipTextActive]}>{bt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>

          {/* ─── Contact Info ─── */}
          <SectionCard icon="call-outline" title="Contact Information" color={COLORS.primaryLight}>
            <FormInput label="Phone Number" value={patientInfo.phone} onChangeText={up('phone')} placeholder="+1 (555) 000-0000" keyboardType="phone-pad" icon="call-outline" />
            <FormInput label="Email Address" value={patientInfo.email} onChangeText={up('email')} placeholder="patient@email.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
            <FormInput label="Street Address" value={patientInfo.address} onChangeText={up('address')} placeholder="123 Main St" icon="location-outline" />
            <View style={styles.row}>
              <FormInput label="City"  value={patientInfo.city}    onChangeText={up('city')}    placeholder="Houston"   containerStyle={{ flex: 2, marginRight: 8 }} />
              <FormInput label="State" value={patientInfo.state}   onChangeText={up('state')}   placeholder="TX" autoCapitalize="characters" containerStyle={{ flex: 1, marginRight: 8 }} />
              <FormInput label="ZIP"   value={patientInfo.zipCode} onChangeText={up('zipCode')} placeholder="77001" keyboardType="number-pad" containerStyle={{ flex: 1 }} />
            </View>
          </SectionCard>

          {/* ─── Emergency Contact ─── */}
          <SectionCard icon="alert-circle-outline" title="Emergency Contact" color={COLORS.warning}>
            <FormInput label="Contact Name"     value={patientInfo.emergencyContact} onChangeText={up('emergencyContact')} placeholder="Full name" icon="person-outline" />
            <FormInput label="Phone Number"     value={patientInfo.emergencyPhone}   onChangeText={up('emergencyPhone')}   placeholder="+1 (555) 000-0000" keyboardType="phone-pad" icon="call-outline" />
            <FormInput label="Relationship"     value={patientInfo.relationship}     onChangeText={up('relationship')}     placeholder="Spouse / Parent / Sibling…" icon="heart-outline" />
          </SectionCard>

          {/* ─── Medical History ─── */}
          <SectionCard icon="medkit-outline" title="Medical History" color={COLORS.danger}>
            <FormInput label="Primary Diagnosis"    value={patientInfo.primaryDiagnosis}  onChangeText={up('primaryDiagnosis')}  placeholder="e.g., Type 2 Diabetes" icon="pulse-outline" />
            <FormInput label="Insurance ID"         value={patientInfo.insuranceId}        onChangeText={up('insuranceId')}        placeholder="INS-0000000" icon="card-outline" autoCapitalize="characters" />
            <FormInput label="Known Allergies"      value={patientInfo.allergies}          onChangeText={up('allergies')}          placeholder="Penicillin, Peanuts…" icon="warning-outline" multiline numberOfLines={2} />
            <FormInput label="Current Medications"  value={patientInfo.currentMedications} onChangeText={up('currentMedications')} placeholder="Metformin 500mg, Lisinopril…" icon="flask-outline" multiline numberOfLines={3} />
            <FormInput label="Clinical Notes"       value={patientInfo.notes}              onChangeText={up('notes')}              placeholder="Additional notes for care team…" multiline numberOfLines={4} />
          </SectionCard>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.88}>
          <LinearGradient
            colors={[COLORS.secondary, COLORS.primaryLight]}
            style={styles.continueBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.continueBtnText}>Continue to Vitals Collection</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={{ marginLeft: 8 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  backBtn:      { padding: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: SPACING.sm },
  headerTitle:  { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
  headerSub:    { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  patientBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  subBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.successBg, paddingHorizontal: SPACING.md, paddingVertical: 7 },
  subBarText: { fontSize: FONT_SIZE.xs, color: COLORS.successDark, fontWeight: FONT_WEIGHT.medium },

  body: { padding: SPACING.md },

  row:        { flexDirection: 'row' },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textBody, marginBottom: SPACING.sm },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip:       { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.divider, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.secondary, backgroundColor: COLORS.accentLight + '40' },
  chipBloodActive: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
  chipText:   { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.medium },
  chipTextActive: { color: COLORS.primaryMid, fontWeight: FONT_WEIGHT.bold },

  footer:        { padding: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.divider, ...shadow.lg },
  continueBtn:   { borderRadius: RADIUS.md, overflow: 'hidden' },
  continueBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  continueBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.white },
});