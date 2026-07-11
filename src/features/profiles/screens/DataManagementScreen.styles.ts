import { StyleSheet } from 'react-native';
import { Colors, Shadows } from '../../../shared/theme/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafeArea: {
    backgroundColor: Colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#064b75',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 6,
  },
  contentContainer: {
    paddingBottom: 0,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...Shadows.soft,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 40,
    height: 40,
    marginRight: 14,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoAvatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  categoryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Shadows.soft,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 10,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  warningIcon: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  warningSubtitle: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  deleteAllButton: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  deleteAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  dialogMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 10,
  },
  dialogOptionsContainer: {
    marginTop: 2,
    marginBottom: 8,
    gap: 8,
  },
  dialogOptionButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  dialogOptionTitle: {
    color: '#064b75',
    fontWeight: '800',
    fontSize: 14,
  },
  dialogOptionDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  dialogOptionDangerText: {
    color: '#DC2626',
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  dialogSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dialogSecondaryText: {
    color: '#064b75',
    fontWeight: '800',
  },
  dialogDangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  dialogPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },
  dialogButtonDisabled: {
    opacity: 0.65,
  },
});

export default styles;
