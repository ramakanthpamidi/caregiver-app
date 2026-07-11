import { StyleSheet } from 'react-native';
import { BorderWidth, Colors, Radius, Shadows, Spacing } from '../../../shared/theme/theme';

const alertStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: 0 },

  summaryBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.soft,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    justifyContent: 'space-between',
  },
  summaryHeaderText: {
    flex: 1,
    paddingRight: 16,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6E7D91',
    marginBottom: 8,
  },
  summaryIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#E6ECF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIcon: {
    width: 24,
    height: 24,
    tintColor: '#718198',
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#182334',
    letterSpacing: -0.6,
  },
  summarySub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#66758A',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: -12,
  },
  summaryGridItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },

  allAlertsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  allAlertsTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#182334',
    letterSpacing: -0.5,
  },
  deleteAllBtn: {
    borderWidth: 1,
    borderColor: '#F8C7CC',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF4F4',
  },
  deleteAllText: {
    fontSize: 13,
    color: '#E2495B',
    fontWeight: '700',
  },
  deleteAllBtnDisabled: {
    opacity: 0.5,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    tintColor: '#9ca3af',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSubtle,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 0,
  },
});

export default alertStyles;
