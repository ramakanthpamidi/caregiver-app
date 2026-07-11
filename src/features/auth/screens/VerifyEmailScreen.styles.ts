import { StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../../shared/theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  responsiveShell: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  contentStack: {
    width: '100%',
    alignItems: 'center',
  },
  authCardTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: Typography.body,
    lineHeight: 20,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
  emailText: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    fontSize: Typography.bodyLg,
    lineHeight: 22,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '700',
  },
  codeFieldRow: {
    width: '100%',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  errorText: {
    color: Colors.danger,
    marginTop: Spacing.xs,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryActionButton: {
    width: '100%',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  helperRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  link: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Typography.body,
  },
  linkMuted: {
    color: Colors.textSubtle,
    fontWeight: '600',
    fontSize: Typography.body,
  },
});

export default styles;
