/**
 * @deprecated Auth navigation now lives under Expo Router `app/(auth)/*`.
 * Independent overlay stacks (policy consent / create profile) still use React Navigation natively.
 */
export { default as LoginScreen } from '../../features/auth/screens/LoginScreen';
export { default as SignupScreen } from '../../features/auth/screens/SignupScreen';
export { default as VerifyEmailScreen } from '../../features/auth/screens/VerifyEmailScreen';
