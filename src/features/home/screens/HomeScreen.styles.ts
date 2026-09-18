import { StyleSheet } from 'react-native';
import {
  Colors,
  Layout,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '../../../shared/theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  animatedHeaderWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },

  heroWrap: {
    width: '100%',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    position: 'relative',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    zIndex: 10,
  },
  // Clipper for the hero content when shadow is applied to heroWrap
  heroClip: {
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  heroBg: {
    width: '100%',
  },
  heroContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  heroContentCompact: {
    paddingHorizontal: Spacing.lg,
  },
  heroContentTablet: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerRightA: {
    flex: 1,
    paddingLeft: 12,
  },
  headerTextColumnCompact: {
    paddingLeft: Spacing.md,
  },
  greeting: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: Typography.bodyLg,
    lineHeight: Typography.lineHeight.md,
  },
  greetingCompact: {
    fontSize: Typography.body,
    lineHeight: Typography.lineHeight.sm,
  },
  largeName: {
    color: Colors.textOnPrimary,
    fontSize: Typography.size['3xl'],
    fontWeight: '900',
    lineHeight: Typography.lineHeight['3xl'],
  },
  largeNameCompact: {
    fontSize: Typography.size['2xl'],
    lineHeight: Typography.lineHeight['2xl'],
  },
  largeNameTablet: {
    fontSize: Typography.size['4xl'],
    lineHeight: Typography.lineHeight['4xl'],
  },
  dateText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  dateTextCompact: {
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
  },
  headerRight: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  heroAvatarSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  heroGreetingSkeleton: {
    width: 176,
    height: 14,
    marginBottom: 2,
  },
  heroNameSkeleton: {
    width: '88%',
    maxWidth: 240,
    height: Typography.size['2xl'],
    borderRadius: Radius.xs,
    marginBottom: 12,
  },
  heroDateSkeleton: {
    width: 128,
    height: 14,
    marginTop: 12,
  },
  heroEditBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  initialsWrapImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySoft,
  },
  initialsWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    // backgroundColor applied dynamically from saved avatar color
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.textOnPrimary,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: Typography.lineHeight['2xl'],
  },
  initialsTextCompact: {
    fontSize: Typography.size.xl,
    lineHeight: Typography.lineHeight.xl,
  },

  body: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  bodyCompact: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  bodyTablet: {
    paddingHorizontal: Spacing['2xl'],
  },

  // Vitals cards grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  vitalCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 164,
    ...Shadows.soft,
  },
  vitalCardLong: {
    width: '100%',
    minHeight: 132,
  },
  vitalCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vitalCardIcon: {
    width: 28,
    height: 28,
  },
  vitalCardTitle: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    lineHeight: Typography.lineHeight.md,
    color: Colors.text,
  },
  vitalCardValueArea: {
    flex: 1,
    minHeight: 84,
    justifyContent: 'center' as const,
    alignItems: 'center',
  },
  vitalCardValueAreaLong: {
    minHeight: 56,
  },
  vitalCardValue: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    color: Colors.text,
    textAlign: 'center',
  },
  vitalCardValueLarge: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    color: Colors.text,
    textAlign: 'center',
  },
  weightStack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightBmiSubValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 2,
  },
  weightFullWrap: {
    width: '100%',
  },
  weightFullHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.md,
  },
  weightFullMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  compositionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  compositionChip: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  compositionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  compositionLabel: {
    fontSize: 10,
    lineHeight: 13,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 1,
  },
  weightSplitRow: {
    width: '100%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  weightSplitMetric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  weightSplitLabel: {
    fontSize: Typography.caption,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.medium,
    marginBottom: 2,
  },
  weightSplitValue: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    color: Colors.text,
    textAlign: 'center',
  },
  weightSplitHint: {
    marginTop: 2,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
  weightSplitDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#D1D5DB',
    marginHorizontal: Spacing.sm,
  },
  vitalCardHint: {
    paddingTop: 6,
    fontSize: Typography.caption,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textDisabled,
  },

  // Disabled/no device state for vital cards
  vitalCardDisabled: {
    backgroundColor: Colors.surface,
  },
  vitalCardEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalCardIconDisabled: {
    tintColor: Colors.textDisabled,
    opacity: 0.45,
  },
  vitalCardTitleDisabled: {
    color: Colors.textSubtle,
  },
  vitalCardNoDevice: {
    fontSize: Typography.caption,
    color: Colors.textDisabled,
    lineHeight: Typography.lineHeight.xs,
    textAlign: 'center',
  },
  vitalCardHintDisabled: { //
    // paddingTop: 6,
    fontSize: Typography.caption,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textSubtle,
    fontWeight: Typography.weight.semibold,
  },

  vitalCardLocked: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  vitalCardLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(243,244,246,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalCardLockIcon: {
    width: 44,
    height: 44,
    tintColor: Colors.textSubtle,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Typography.bodyLg,
    fontWeight: '700',
    color: Colors.text,
  },
  deviceCount: {
    fontSize: 14,
    color: Colors.textSubtle,
  },

  // Devices container - outer box like Health Trends
  devicesContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: Spacing.lg,
    ...Shadows.soft,
  },

  // Empty state inside devices container
  emptyDeviceInner: {
    padding: 20,
    alignItems: 'center',
  },

  // Empty state standalone (legacy)
  emptyDeviceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 20,
    alignItems: 'center',
    ...Shadows.soft,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSubtle,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textDisabled,
    marginTop: 4,
  },

  // Legacy styles (kept for backward compatibility)
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    marginHorizontal: 6,
    ...Shadows.soft,
  },

  // Chart card (keeping for trend section if needed)
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginTop: 8,
    ...Shadows.soft,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  chartButton: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  chartButtonText: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  chartPlaceholder: {
    height: 200,
    borderRadius: 8,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    color: Colors.textDisabled,
  },
});

export default styles;
