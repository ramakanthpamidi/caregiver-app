import { StyleSheet } from 'react-native';
import { Layout, Radius, Shadows, Spacing } from '../../../shared/theme/theme';

export const PROFILE_BOTTOM_PADDING = Layout.bottomTabHeight + Spacing.xl;
export const PROFILE_SHEET_BOTTOM_PADDING = Layout.bottomTabHeight + 8;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 22,
    paddingBottom: 0,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  // Active card
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Shadows.soft,
  },
  activeCardInline: {
    // Transparent card for inside the blue gradient
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingBottom: 10,
  },
  profileSheetHeader: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  closeButton: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: -1,
  },
  headerButtonsColumn: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEditIcon: {
    width: 18,
    height: 18,
    tintColor: '#ffffff',
    marginRight: 8,
  },
  headerEditBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEditBtnSheet: {
    marginLeft: 12,
    marginRight: -8,
  },
  headerEditText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  activeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  activeTopLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  editIcon: {
    width: 16,
    height: 16,
    tintColor: '#111827',
    marginRight: 6,
  },
  editText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 13,
  },
  activeMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarPhoto: {
    // width and height are set dynamically based on stored imgW/imgH
  },
  avatarInitials: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  activeInfo: {
    flex: 1,
    minWidth: 0,
  },
  activeInfoSheetWithClose: {
    paddingRight: 56,
  },
  activeSheetActionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  activeSheetActionSpacer: {
    flex: 1,
  },
  activeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  // active pill (green capsule with dot)
  activePillWrap: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',

    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 30,
    borderRadius: 999,
  },
  activePillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  activePillText: {
    color: '#065f46',
    fontWeight: '700',
    fontSize: 13,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#064b75',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 130,
  },
  addBtnIcon: {
    width: 12,
    height: 12,
    tintColor: '#fff',
    marginRight: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },

  smallOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    minWidth: 130,
  },
  smallOutlineIcon: {
    width: 12,
    height: 12,
    tintColor: '#111827',
    marginRight: 8,
  },
  smallOutlineText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 13,
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    ...Shadows.soft,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },

  // Profiles pager (4 per page)
  profilesPagerWrap: {
    marginTop: 2,
  },
  profilesPage: {
    paddingRight: 2,
  },
  profilesPagerIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  profilesPagerIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
    marginHorizontal: 4,
  },
  profilesPagerIndicatorDotActive: {
    width: 18,
    backgroundColor: '#064b75',
  },

});

export default styles;
