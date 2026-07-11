import { StyleSheet } from 'react-native';
import { BorderWidth, Colors, Layout, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
  },

  introBlock: {
    marginBottom: Spacing.lg,
  },
  introTitle: {
    fontSize: Typography.size['2xl'],
    lineHeight: Typography.lineHeight['2xl'],
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  introSubtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSubtle,
  },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  detailHeaderCopy: {
    flex: 1,
    marginRight: Spacing.md,
  },
  backButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  detailOverline: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailTitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  detailSubtitle: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSubtle,
  },

  metricGrid: {
    marginTop: Spacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  metricRowLast: {
    marginBottom: 0,
  },
  metricTileWrap: {
    flex: 1,
  },
  metricTileWrapLeading: {
    marginRight: Spacing.md,
  },
  summarySection: {
    marginTop: Spacing.lg,
  },
  detailHero: {
    marginBottom: Spacing.lg,
  },
  detailChart: {
    marginTop: Spacing.md,
  },
  detailFallback: {
    marginTop: Spacing.md,
  },
  detailSectionLast: {
    marginBottom: Spacing.sm,
  },

  emptyStateCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    ...Shadows.soft,
  },
  emptyStateTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  emptyStateBody: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSubtle,
  },

  timePeriodCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.soft,
  },
  timeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  timeTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  calendarIcon: {
    width: 32,
    height: 32,
    tintColor: Colors.textSubtle,
  },

  periodSwitchWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
    overflow: 'hidden',
  },
  periodActiveBg: {
    position: 'absolute',
    top: Spacing.xs,
    bottom: Spacing.xs,
    left: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.borderSoft,
    ...Shadows.soft,
  },
  periodPill: {
    flex: 1,
    paddingVertical: Spacing.sm + Spacing.xs,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
  },
  periodText: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textSubtle,
  },
  periodTextActive: {
    color: Colors.text,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  adviceSection: {
    marginBottom: Spacing.lg,
  },

  manualDialogTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.extrabold,
    color: Colors.text,
  },
  manualDialogSubtitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualInputWrap: {
    flex: 1,
  },
  manualInputLeading: {
    marginRight: Spacing.sm,
  },
  manualInput: {
    marginTop: Spacing.sm,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    color: Colors.text,
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.semibold,
  },
  manualError: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.danger,
    fontWeight: Typography.weight.semibold,
  },
  manualDialogActions: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm + Spacing.xs,
  },
  manualDialogSecondaryButton: {
    minHeight: 40,
    paddingVertical: Spacing.sm + Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    justifyContent: 'center',
  },
  manualDialogSecondaryText: {
    color: Colors.primary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  manualDialogPrimaryButton: {
    backgroundColor: Colors.primary,
    minHeight: 40,
    paddingVertical: Spacing.sm + Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualDialogPrimaryText: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  manualDialogButtonDisabled: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 0,
  },
});

export default styles;
