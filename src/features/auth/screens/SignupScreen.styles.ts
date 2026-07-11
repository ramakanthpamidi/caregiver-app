import { StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../../../shared/theme/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  responsiveShell: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
  },
  contentStack: {
    width: '100%',
    flexGrow: 1,
  },
  contentStackCentered: {
    justifyContent: 'center',
  },
  contentStackKeyboard: {
    justifyContent: 'flex-start',
  },
  authHeroSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logo: { width: 72, height: 72, marginBottom: 4 },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 14,
  },
  authCardTitle: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: Spacing.sm,
    color: Colors.primary,
    textAlign: 'center',
  },
  formFieldRow: {
    width: '100%',
    position: 'relative',
    marginBottom: 12,
  },
  formFieldRowWithTooltip: {
    paddingTop: 56,
    minHeight: 108,
  },
  passwordInputRow: {
    width: '100%',
    position: 'relative',
    marginBottom: 12,
  },
  passwordInputRowWithTooltip: {
    zIndex: 20,
  },
  passwordInput: {},
  passwordToggle: {
    justifyContent: 'center',
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  termsRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    position: 'relative',
  },
  termsRowWithTooltip: {
    zIndex: 20,
  },
  termsLinkText: {
    color: Colors.primary,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  primaryActionButton: {
    marginTop: Spacing.xl,
    marginBottom: 6,
  },
  inlineSigninRow: {
    width: '100%',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: Typography.body,
    color: Colors.textSubtle,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  authDividerRow: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 0,
  },
  dividerText: {
    color: Colors.textSubtle,
    fontSize: Typography.body,
    letterSpacing: 0.8,
  },
  socialAuthRow: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    gap: Spacing.md,
  },
  socialAuthButton: { width: '100%' },
  socialIcon: { width: 26, height: 26 },
});

export default styles;
