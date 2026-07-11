import { StyleSheet } from 'react-native';
import { BorderWidth, Colors, Layout, Radius, Shadows, Spacing, Typography } from '../../../shared/theme/theme';

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

  // Scan card (Home "Health Trends" style)
  scanCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.soft,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  scanHeaderText: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  scanTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  scanSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
    lineHeight: Typography.lineHeight.sm,
  },
  scanIcon: {
    width: 28,
    height: 28,
    tintColor: Colors.textSubtle,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    minHeight: 48,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
  },

  // Section header (Home "Connected Devices")
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
  },
  deviceCount: {
    fontSize: Typography.size.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
  },

  emptyState: {
    paddingVertical: Spacing['5xl'],
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    tintColor: Colors.textDisabled,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.size.lg,
    lineHeight: Typography.lineHeight.lg,
    fontWeight: Typography.weight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.sm,
  },
  emptyActionButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + Spacing.xs,
  },
  emptyActionButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.semibold,
  },
  bottomSpacer: {
    height: 0,
  },
});

export default styles;
