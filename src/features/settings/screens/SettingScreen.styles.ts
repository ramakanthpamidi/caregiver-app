import { StyleSheet } from 'react-native';
import {
  BorderWidth,
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '../../../shared/theme/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
  },

  // Matches Home "Health Trends" card style
  appInfoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.soft,
  },
  appInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appInfoIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    resizeMode: 'cover',
    marginRight: Spacing.md,
  },
  appInfoText: {
    flex: 1,
  },
  appInfoTitle: {
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  appInfoVersion: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  appInfoUpdated: {
    marginTop: Spacing.xxs,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textDisabled,
    fontWeight: Typography.weight.medium,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },

  // Matches Home "Connected devices" card style
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.soft,
  },

  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md + Spacing.xs,
    borderBottomWidth: BorderWidth.sm,
    borderBottomColor: Colors.gray100,
  },
  rowItemLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconImage: { width: 28, height: 28, resizeMode: 'contain', marginRight: Spacing.md },
  chevron: { color: Colors.gray400, fontSize: 20 },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray100,
    borderRadius: Radius.sm,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    height: 28,
    padding: 2,
  },
  languageToggleOption: {
    minWidth: 56,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs + Spacing.xxs,
    paddingVertical: 0,
    borderRadius: Radius.xs,
  },
  languageToggleOptionActive: {
    backgroundColor: Colors.primary,
  },
  languageToggleText: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.textSubtle,
  },
  languageToggleTextActive: {
    color: Colors.textOnPrimary,
  },
  languageSwitchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
  },
  logoutText: { color: Colors.danger },
  helpWrap: { marginTop: Spacing.lg, alignItems: 'center' },
  helpTitle: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.gray800,
  },
  helpPhone: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    marginTop: Spacing.xs,
  },
  helpCallButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.info,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm + Spacing.xs,
    paddingHorizontal: Spacing['2xl'],
  },
  helpCallButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
  },
  bottomSpacer: { height: 0 },
});

export const modalStyles = StyleSheet.create({
  sheetTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.lg,
    color: Colors.text,
  },
  optionGroup: {
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md + Spacing.xs,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md + Spacing.xs,
  },
  optionText: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    color: Colors.text,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  close: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    bottom: 2,
    paddingVertical: Spacing.md,
    zIndex: 3,
    backgroundColor: Colors.transparent,
  },
  closeText: {
    color: Colors.primary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  groupTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs + Spacing.xxs,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
});

export default styles;
