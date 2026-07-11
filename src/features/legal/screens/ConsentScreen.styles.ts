import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  header: { marginTop: 12, marginBottom: 10 },
  meta: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 4 },
  headerBody: { fontSize: 15, lineHeight: 24, color: '#374151', marginBottom: 6 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 12, marginBottom: 12 },

  section: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 },
  paragraph: { fontSize: 15, lineHeight: 24, color: '#374151', marginBottom: 10 },

  bulletList: { paddingLeft: 2, gap: 10, marginTop: 6, marginBottom: 8 },
  bulletItem: { fontSize: 15, lineHeight: 24, color: '#374151' },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#064b75',
    borderColor: '#064b75',
  },
  checkboxLocked: {
    opacity: 0.45,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },

  footer: { borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 18, backgroundColor: '#FFFFFF' },
  footerRow: { flexDirection: 'row', gap: 12 },
  rowButton: { flex: 1 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  button: { backgroundColor: '#064b75', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#9CA3AF' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  secondaryButtonText: { color: '#064b75', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 18, justifyContent: 'center' },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginTop: 10,
    marginBottom: 6,
  },
  modalItem: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 4,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  modalSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalSecondaryText: {
    color: '#064b75',
    fontWeight: '800',
  },
  modalPrimaryButton: {
    backgroundColor: '#064b75',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default styles;
