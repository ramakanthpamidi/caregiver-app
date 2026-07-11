import React from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, KeyboardAvoidingView, Platform, Keyboard, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import TooltipError from '../../../shared/components/TooltipError';
import NamePromptModal from '../../profiles/components/NamePromptModal';
import InfoDialog from '../../../shared/components/InfoDialog';
import Button from '../../../shared/components/Button';
import InputField from '../../../shared/components/InputField';
import { googleBackendAuthenticate, googleSignInGetProfile, googleSignOutIfPossible } from '../services/googleAuth';
import { facebookBackendAuthenticate, facebookSignInGetProfile, facebookSignOutIfPossible } from '../services/facebookAuth';
import { lineBackendAuthenticate, lineSignInGetProfile, lineSignOutIfPossible } from '../../profiles/services/lineAuth';
import { useAuthActions } from '../state/authContext';
import { useOnboardingDraft } from '../../../shared/contexts/onboardingDraftContext';
import { apiUrl } from '../../../shared/config/api';
import LanguageDropdown from '../../../shared/components/LanguageDropdown';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors } from '../../../shared/theme/theme';
import LayoutPresets from '../../../shared/theme/layoutPresets';

import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './SignupScreen.styles';

const PENDING_SOCIAL_SIGNUP_KEY = 'pendingSocialSignup.v1';
const PENDING_POST_LEGAL_ACTION_KEY = 'pendingPostLegalAction.v1';
const PENDING_OAUTH_NAME_DIALOG_KEY = 'pendingOAuthNameDialog.v1';
const PENDING_FORM_SIGNUP_KEY = 'pendingFormSignup.v1';

type PendingSocialSignup = {
  provider: 'google' | 'facebook' | 'line';
  token: string;
  userLabel: string;
};

type PendingPostLegalAction =
  | { kind: 'verifyEmail'; email: string }
  | { kind: 'loginWithToken'; token: string };

const SignupScreen: React.FC<{ setIsLoggedIn?: (v: boolean) => void }> = ({ setIsLoggedIn }) => {
  const auth = useAuthActions();
  const setLoggedIn = setIsLoggedIn || auth.setIsLoggedIn;
  const { lang } = useLanguage();
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const goToLogin = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  };
  const onboarding = useOnboardingDraft();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const baseWidth = 375;
  const scale = Math.min(Math.max(screenWidth / baseWidth, 0.8), 1.4);
  const inputPadding = Math.round(12 * scale);

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [name, setName] = React.useState(() => onboarding.signupDraft.name || '');
  const [email, setEmail] = React.useState(() => onboarding.signupDraft.email || '');
  const [password, setPassword] = React.useState(() => onboarding.signupDraft.password || '');
  const [confirmPassword, setConfirmPassword] = React.useState(
    () => onboarding.signupDraft.confirmPassword || '',
  );
  const [loading, setLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState({ name: false, email: false, password: false, confirmPassword: false });
  const [tooltip, setTooltip] = React.useState<{ target: 'name' | 'email' | 'password' | 'confirmPassword' | 'legal'; message: string; variant?: 'error' | 'info' } | null>(null);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);
  const [signupSuccessDialogVisible, setSignupSuccessDialogVisible] = React.useState(false);

  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [googleNameModalVisible, setGoogleNameModalVisible] = React.useState(false);
  const [googleName, setGoogleName] = React.useState('');
  const [googleNameError, setGoogleNameError] = React.useState<string | null>(null);
  const [googlePendingIdToken, setGooglePendingIdToken] = React.useState<string | null>(null);

  const [facebookLoading, setFacebookLoading] = React.useState(false);
  const [facebookNameModalVisible, setFacebookNameModalVisible] = React.useState(false);
  const [facebookName, setFacebookName] = React.useState('');
  const [facebookNameError, setFacebookNameError] = React.useState<string | null>(null);
  const [facebookPendingAccessToken, setFacebookPendingAccessToken] = React.useState<string | null>(null);

  const [lineLoading, setLineLoading] = React.useState(false);
  const [lineNameModalVisible, setLineNameModalVisible] = React.useState(false);
  const [lineName, setLineName] = React.useState('');
  const [lineNameError, setLineNameError] = React.useState<string | null>(null);
  const [linePendingAccessToken, setLinePendingAccessToken] = React.useState<string | null>(null);
  const [existingAccountDialogVisible, setExistingAccountDialogVisible] = React.useState(false);
  const autoSignupCheckedRef = React.useRef(false);
  const handleSignupRef = React.useRef<null | (() => Promise<void>)>(null);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const isValidPassword = (value: string) => {
    // at least 8 chars, contains at least 1 letter and 1 number
    return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
  };

  const passwordRulesMessage = t(lang, 'password_rules');
  const availableHeight = screenHeight - keyboardOffset;
  const isCompact = availableHeight < 760;
  const isKeyboardOpen = keyboardOffset > 0;
  const hasCompletedLegal = React.useMemo(() => {
    const legal = onboarding.legalAcceptance;
    return !!(legal.tosAccepted && legal.policyAccepted && legal.consentAccepted);
  }, [onboarding.legalAcceptance]);

  const normalizeGoogleErrorMessage = (err: any): string => {
    const raw = String(err?.message || err || '').trim();
    if (/DEVELOPER_ERROR/i.test(raw)) {
      return 'Google Sign-In setup mismatch. Create an Android OAuth client for package com.caregiverbps with your app SHA-1, then try again.';
    }
    return raw || 'Google sign up failed';
  };

  const normalizeLineErrorMessage = (err: any): string => {
    const code = String(err?.code || '').trim();
    const raw = String(err?.message || err || '').trim();
    if (/UNKNOWN|ERROR/i.test(raw) || /UNKNOWN|ERROR/i.test(code)) {
      return 'LINE login failed. Check LINE Login channel settings (Android package com.caregiverbps and app signature) in LINE Developers Console.';
    }
    return raw || 'LINE sign up failed';
  };

  const completeGoogleSignup = React.useCallback(async (idToken: string, userLabel: string): Promise<boolean> => {
    setGoogleLoading(true);
    try {
      const result = await googleBackendAuthenticate({ idToken, userLabel });
      setGoogleNameModalVisible(false);
      setGooglePendingIdToken(null);
      setGoogleNameError(null);

      if (result?.isNewAccount === false && result?.token) {
        // Existing account — show "already has account" dialog, then go home
        setExistingAccountDialogVisible(true);
        return true;
      }

      if (result?.token) {
        onboarding.resetDraft();
        if (typeof setLoggedIn === 'function') setLoggedIn(true);
        return true;
      } else if (result?.requiresEmailVerification) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: {
            email: result.email || '',
            justSent: '1',
          },
        });
        return true;
      } else {
        const msg = 'Google signup finished but no login or verification response was returned.';
        setGoogleNameError(msg);
        throw new Error(msg);
      }
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Google sign up failed';
      setGoogleNameError(msg);
      throw err;
    } finally {
      setGoogleLoading(false);
    }
  }, [router, setLoggedIn]);

  const completeFacebookSignup = React.useCallback(async (accessToken: string, userLabel: string): Promise<boolean> => {
    setFacebookLoading(true);
    try {
      const result = await facebookBackendAuthenticate({ accessToken, userLabel });
      setFacebookNameModalVisible(false);
      setFacebookPendingAccessToken(null);
      setFacebookNameError(null);

      if (result?.isNewAccount === false) {
        // Existing account — show "already has account" dialog, then go home
        setExistingAccountDialogVisible(true);
        return true;
      }

      onboarding.resetDraft();
      if (typeof setLoggedIn === 'function') setLoggedIn(true);
      return true;
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Facebook sign up failed';
      setFacebookNameError(msg);
      throw err;
    } finally {
      setFacebookLoading(false);
    }
  }, [setLoggedIn]);

  const completeLineSignup = React.useCallback(async (accessToken: string, userLabel: string): Promise<boolean> => {
    setLineLoading(true);
    try {
      const result = await lineBackendAuthenticate({ accessToken, userLabel });
      setLineNameModalVisible(false);
      setLinePendingAccessToken(null);
      setLineNameError(null);

      if (result?.isNewAccount === false) {
        // Existing account — show "already has account" dialog, then go home
        setExistingAccountDialogVisible(true);
        return true;
      }

      onboarding.resetDraft();
      if (typeof setLoggedIn === 'function') setLoggedIn(true);
      return true;
    } catch (err: any) {
      const msg = err?.message ? err.message : 'LINE sign up failed';
      setLineNameError(msg);
      throw err;
    } finally {
      setLineLoading(false);
    }
  }, [setLoggedIn]);

  React.useEffect(() => {
    if (!hasCompletedLegal) return;

    let cancelled = false;
    const resumePendingSocialSignup = async () => {
      let pending: PendingSocialSignup | null = null;
      try {
        const raw = await AsyncStorage.getItem(PENDING_SOCIAL_SIGNUP_KEY);
        if (!raw || cancelled) return;

        pending = JSON.parse(raw) as PendingSocialSignup;
        if (!pending || cancelled) return;

        if (pending.provider === 'google') {
          const ok = await completeGoogleSignup(pending.token, pending.userLabel);
          if (ok) await AsyncStorage.removeItem(PENDING_SOCIAL_SIGNUP_KEY);
          return;
        }
        if (pending.provider === 'facebook') {
          const ok = await completeFacebookSignup(pending.token, pending.userLabel);
          if (ok) await AsyncStorage.removeItem(PENDING_SOCIAL_SIGNUP_KEY);
          return;
        }
        if (pending.provider === 'line') {
          const ok = await completeLineSignup(pending.token, pending.userLabel);
          if (ok) await AsyncStorage.removeItem(PENDING_SOCIAL_SIGNUP_KEY);
          return;
        }
      } catch (err: any) {
        if (cancelled) return;
        // Keep the pending payload so user can retry after fixing backend/provider issues.
        if (pending) {
          try {
            await AsyncStorage.setItem(PENDING_SOCIAL_SIGNUP_KEY, JSON.stringify(pending));
          } catch {
            // ignore
          }
        }

        const message = String(err?.message || 'Social sign up failed. Please try again.');
        setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
        setTooltip({ target: 'email', message });
      }
    };

    resumePendingSocialSignup();
    return () => {
      cancelled = true;
    };
  }, [hasCompletedLegal, completeGoogleSignup, completeFacebookSignup, completeLineSignup]);

  React.useEffect(() => {
    if (!hasCompletedLegal) return;

    let cancelled = false;
    const resumePostLegalAction = async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_POST_LEGAL_ACTION_KEY);
        if (!raw || cancelled) return;

        await AsyncStorage.removeItem(PENDING_POST_LEGAL_ACTION_KEY);
        const pending = JSON.parse(raw) as PendingPostLegalAction;
        if (!pending || cancelled) return;

        if (pending.kind === 'verifyEmail') {
          router.push({
            pathname: '/(auth)/verify-email',
            params: {
              email: pending.email || '',
              justSent: '1',
            },
          });
          return;
        }

        if (pending.kind === 'loginWithToken') {
          if (pending.token && pending.token !== 'stored') {
            await AsyncStorage.setItem('authToken', pending.token);
          }
          onboarding.resetDraft();
          if (typeof setLoggedIn === 'function') setLoggedIn(true);
        }
      } catch {
        // ignore
      }
    };

    resumePostLegalAction();
    return () => {
      cancelled = true;
    };
  }, [hasCompletedLegal, router, setLoggedIn]);

  React.useEffect(() => {
    if (!hasCompletedLegal || autoSignupCheckedRef.current) return;

    autoSignupCheckedRef.current = true;
    let cancelled = false;

    const resumePendingFormSignup = async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_FORM_SIGNUP_KEY);
        if (!raw || cancelled) return;

        await AsyncStorage.removeItem(PENDING_FORM_SIGNUP_KEY);
        if (cancelled) return;

        await handleSignupRef.current?.();
      } catch {
        // ignore
      }
    };

    resumePendingFormSignup();
    return () => {
      cancelled = true;
    };
  }, [hasCompletedLegal]);

  const startGoogleSignup = async () => {
    setGoogleLoading(true);
    const timeout = setTimeout(() => { setGoogleLoading(false); }, 60000);
    try {
      const profile = await googleSignInGetProfile();
      const providerName = (profile.displayName || '').trim();

      // Call backend first to determine new vs existing account
      const result = await googleBackendAuthenticate({ idToken: profile.idToken, userLabel: providerName });

      if (result?.isNewAccount === false) {
        if (result?.hasProfile === false) {
          // Account exists but no profile yet (e.g. interrupted flow) — must complete name + terms
          setGooglePendingIdToken(profile.idToken);
          setGoogleName(providerName);
          setGoogleNameError(null);
          await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
          setGoogleNameModalVisible(true);
        } else {
          // Existing account with profile — show "already exists" dialog then log in
          setExistingAccountDialogVisible(true);
        }
        return;
      }

      // New account created — show name dialog for customisation, then legal flow
      setGooglePendingIdToken(profile.idToken);
      setGoogleName(providerName);
      setGoogleNameError(null);
      await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
      setGoogleNameModalVisible(true);
    } catch (err: any) {
      const msg = normalizeGoogleErrorMessage(err);
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: msg });
      await googleSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setGoogleLoading(false);
    }
  };

  const startFacebookSignup = async () => {
    setFacebookLoading(true);
    const timeout = setTimeout(() => { setFacebookLoading(false); }, 60000);
    try {
      const profile = await facebookSignInGetProfile();
      const providerName = (profile.displayName || '').trim();

      // Call backend first to determine new vs existing account
      const result = await facebookBackendAuthenticate({ accessToken: profile.accessToken, userLabel: providerName });

      if (result?.isNewAccount === false) {
        if (result?.hasProfile === false) {
          // Account exists but no profile yet (e.g. interrupted flow) — must complete name + terms
          setFacebookPendingAccessToken(profile.accessToken);
          setFacebookName(providerName);
          setFacebookNameError(null);
          await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
          setFacebookNameModalVisible(true);
        } else {
          // Existing account with profile — show "already exists" dialog then log in
          setExistingAccountDialogVisible(true);
        }
        return;
      }

      // New account created — show name dialog for customisation, then legal flow
      setFacebookPendingAccessToken(profile.accessToken);
      setFacebookName(providerName);
      setFacebookNameError(null);
      await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
      setFacebookNameModalVisible(true);
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Facebook sign up failed';
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: msg });
      await facebookSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setFacebookLoading(false);
    }
  };

  const submitFacebookSignup = async () => {
    const nameValue = facebookName.trim();
    if (!nameValue) {
      setFacebookNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setFacebookLoading(true);
    try {
      setFacebookNameModalVisible(false);
      setFacebookPendingAccessToken(null);
      setFacebookNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      // Account was already created in startFacebookSignup. Token is stored.
      if (!hasCompletedLegal) {
        await AsyncStorage.setItem(
          PENDING_POST_LEGAL_ACTION_KEY,
          JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
        );
        router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
        return;
      }

      onboarding.resetDraft();
      if (typeof setLoggedIn === 'function') setLoggedIn(true);
    } catch (err: any) {
      setFacebookNameError(err?.message || 'Facebook sign up failed');
    } finally {
      setFacebookLoading(false);
    }
  };

  const startLineSignup = async () => {
    setLineLoading(true);
    const timeout = setTimeout(() => { setLineLoading(false); }, 60000);
    try {
      const profile = await lineSignInGetProfile();
      const providerName = (profile.displayName || '').trim();

      // Call backend first to determine new vs existing account
      const result = await lineBackendAuthenticate({ accessToken: profile.accessToken, userLabel: providerName });

      if (result?.isNewAccount === false) {
        if (result?.hasProfile === false) {
          // Account exists but no profile yet (e.g. interrupted flow) — must complete name + terms
          setLinePendingAccessToken(profile.accessToken);
          setLineName(providerName);
          setLineNameError(null);
          await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
          setLineNameModalVisible(true);
        } else {
          // Existing account with profile — show "already exists" dialog then log in
          setExistingAccountDialogVisible(true);
        }
        return;
      }

      // New account created — show name dialog for customisation, then legal flow
      setLinePendingAccessToken(profile.accessToken);
      setLineName(providerName);
      setLineNameError(null);
      await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
      setLineNameModalVisible(true);
    } catch (err: any) {
      const msg = normalizeLineErrorMessage(err);
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: msg });
      await lineSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setLineLoading(false);
    }
  };

  const submitLineSignup = async () => {
    const nameValue = lineName.trim();
    if (!nameValue) {
      setLineNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setLineLoading(true);
    try {
      setLineNameModalVisible(false);
      setLinePendingAccessToken(null);
      setLineNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      // Account was already created in startLineSignup. Token is stored.
      if (!hasCompletedLegal) {
        await AsyncStorage.setItem(
          PENDING_POST_LEGAL_ACTION_KEY,
          JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
        );
        router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
        return;
      }

      onboarding.resetDraft();
      if (typeof setLoggedIn === 'function') setLoggedIn(true);
    } catch (err: any) {
      setLineNameError(err?.message || 'LINE sign up failed');
    } finally {
      setLineLoading(false);
    }
  };

  const submitGoogleSignup = async () => {
    const nameValue = googleName.trim();
    if (!nameValue) {
      setGoogleNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setGoogleLoading(true);
    try {
      setGoogleNameModalVisible(false);
      setGooglePendingIdToken(null);
      setGoogleNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      // Account was already created in startGoogleSignup. Token is stored.
      if (!hasCompletedLegal) {
        await AsyncStorage.setItem(
          PENDING_POST_LEGAL_ACTION_KEY,
          JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
        );
        router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
        return;
      }

      onboarding.resetDraft();
      if (typeof setLoggedIn === 'function') setLoggedIn(true);
    } catch (err: any) {
      setGoogleNameError(err?.message || 'Google sign up failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    const nameValue = name.trim();
    const emailValue = email.trim();
    const passwordValue = password;
    const confirmPasswordValue = confirmPassword;

    // 1) Name validation
    if (!nameValue) {
      setFieldErrors({ name: true, email: false, password: false, confirmPassword: false });
      setTooltip({ target: 'name', message: t(lang, 'enter_name') });
      return;
    }

    // 2) Email validation
    if (!emailValue) {
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: t(lang, 'enter_email') });
      return;
    }
    if (!isValidEmail(emailValue)) {
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: t(lang, 'enter_valid_email') });
      return;
    }

    // Password required + rule validation
    if (!passwordValue) {
      setFieldErrors({ name: false, email: false, password: true, confirmPassword: false });
      setTooltip({ target: 'password', message: t(lang, 'enter_password') });
      return;
    }

    if (!isValidPassword(passwordValue)) {
      setFieldErrors({ name: false, email: false, password: true, confirmPassword: false });
      setTooltip({ target: 'password', message: passwordRulesMessage, variant: 'error' });
      return;
    }

    if (!confirmPasswordValue) {
      setFieldErrors({ name: false, email: false, password: false, confirmPassword: true });
      setTooltip({ target: 'confirmPassword', message: t(lang, 'enter_confirm_password') });
      return;
    }

    if (passwordValue !== confirmPasswordValue) {
      setFieldErrors({ name: false, email: false, password: false, confirmPassword: true });
      setTooltip({ target: 'confirmPassword', message: t(lang, 'passwords_do_not_match') });
      return;
    }

    // Legal gating comes last so users get field validation first.
    if (!hasCompletedLegal) {
      await AsyncStorage.setItem(
        PENDING_FORM_SIGNUP_KEY,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          email: emailValue,
        }),
      );
      router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(apiUrl('/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_label: nameValue, email: emailValue, password: passwordValue }),
      });

      const text = await resp.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (resp.status === 201 || resp.ok) {
        const token = (data && (data.token || data.access_token)) || null;
        if (token) {
          await AsyncStorage.setItem('authToken', token);
          setFieldErrors({ name: false, email: false, password: false, confirmPassword: false });
          setTooltip(null);
          setSignupSuccessDialogVisible(true);
        } else if (data?.requiresEmailVerification) {
          setFieldErrors({ name: false, email: false, password: false, confirmPassword: false });
          setTooltip(null);
          router.push({
            pathname: '/(auth)/verify-email',
            params: { email: emailValue, justSent: '1' },
          });
        } else {
          setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
          setTooltip({ target: 'email', message: 'Signup succeeded but no token was returned.' });
        }
      } else if (resp.status === 409) {
        setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
        setTooltip({ target: 'email', message: t(lang, 'email_already_registered'), variant: 'error' });
      } else {
        const msg = (data && (data.error || data.message)) || `Signup failed (status ${resp.status})`;
        setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
        setTooltip({ target: 'email', message: msg });
      }
    } catch (err: any) {
      const msg = err && err.message ? err.message : 'Signup failed';
      setFieldErrors({ name: false, email: true, password: false, confirmPassword: false });
      setTooltip({ target: 'email', message: msg });
    } finally {
      setLoading(false);
    }
  };

  handleSignupRef.current = handleSignup;

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => {
      setKeyboardOffset(e.endCoordinates ? e.endCoordinates.height : 250);
    };
    const onHide = () => {
      setKeyboardOffset(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={LayoutPresets.fill}
    >
      <View style={LayoutPresets.screen}>
        <View
          style={[
            LayoutPresets.screenContent,
            styles.responsiveShell,
            {
              paddingTop: Math.max(safeInsets.top, 16) + (isCompact ? 8 : 20),
              paddingBottom: safeInsets.bottom,
            },
          ]}
        >
        <LanguageDropdown />
        <InfoDialog
          visible={signupSuccessDialogVisible}
          title={t(lang, 'success')}
          message={t(lang, 'account_created')}
          onClose={() => {
            setSignupSuccessDialogVisible(false);
            onboarding.resetDraft();
            if (typeof setLoggedIn === 'function') setLoggedIn(true);
          }}
        />
        <InfoDialog
          visible={existingAccountDialogVisible}
          title={t(lang, 'account_exists_title') || 'Account Exists'}
          message={t(lang, 'account_exists_message') || 'This email already has an account.'}
          onClose={() => {
            setExistingAccountDialogVisible(false);
            onboarding.resetDraft();
            if (typeof setLoggedIn === 'function') setLoggedIn(true);
          }}
        />

        <NamePromptModal
          visible={googleNameModalVisible}
          title={t(lang, 'enter_user_name')}
          value={googleName}
          onChangeValue={(v) => {
            setGoogleName(v);
            if (googleNameError) setGoogleNameError(null);
          }}
          errorText={googleNameError}
          submitting={googleLoading}
          onCancel={() => {
            setGoogleNameModalVisible(false);
            setGooglePendingIdToken(null);
            setGoogleNameError(null);
            AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, 'authToken']).catch(() => {});
            googleSignOutIfPossible();
          }}
          onSubmit={submitGoogleSignup}
        />

        <NamePromptModal
          visible={facebookNameModalVisible}
          title={t(lang, 'enter_user_name')}
          value={facebookName}
          onChangeValue={(v) => {
            setFacebookName(v);
            if (facebookNameError) setFacebookNameError(null);
          }}
          errorText={facebookNameError}
          submitting={facebookLoading}
          onCancel={() => {
            setFacebookNameModalVisible(false);
            setFacebookPendingAccessToken(null);
            setFacebookNameError(null);
            AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, 'authToken']).catch(() => {});
            facebookSignOutIfPossible();
          }}
          onSubmit={submitFacebookSignup}
        />

        <NamePromptModal
          visible={lineNameModalVisible}
          title={t(lang, 'enter_user_name')}
          value={lineName}
          onChangeValue={(v) => {
            setLineName(v);
            if (lineNameError) setLineNameError(null);
          }}
          errorText={lineNameError}
          submitting={lineLoading}
          onCancel={() => {
            setLineNameModalVisible(false);
            setLinePendingAccessToken(null);
            setLineNameError(null);
            AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, 'authToken']).catch(() => {});
            lineSignOutIfPossible();
          }}
          onSubmit={submitLineSignup}
        />
        <ScrollView
          contentContainerStyle={[
            styles.contentStack,
            isKeyboardOpen
              ? styles.contentStackKeyboard
              : styles.contentStackCentered,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <Text style={styles.authCardTitle}>{t(lang, 'create_account')}</Text>

          <View
            style={[
              styles.formFieldRow,
              tooltip?.target === 'name' ? styles.formFieldRowWithTooltip : null,
            ]}
          >
              <InputField
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  onboarding.setSignupDraft((prev) => ({ ...prev, name: v }));
                  setFieldErrors((prev) => ({ ...prev, name: false }));
                  if (tooltip?.target === 'name') setTooltip(null);
                }}
                hasError={fieldErrors.name}
                inputStyle={{ paddingHorizontal: inputPadding }}
                placeholder={t(lang, 'name_placeholder')}
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
              />
              {tooltip?.target === 'name' ? (
                <TooltipError message={tooltip.message} variant={tooltip.variant} onClose={() => setTooltip(null)} />
              ) : null}
          </View>

          <View
            style={[
              styles.formFieldRow,
              tooltip?.target === 'email' ? styles.formFieldRowWithTooltip : null,
            ]}
          >
              <InputField
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  onboarding.setSignupDraft((prev) => ({ ...prev, email: v }));
                  setFieldErrors((prev) => ({ ...prev, email: false }));
                  if (tooltip?.target === 'email') setTooltip(null);
                }}
                hasError={fieldErrors.email}
                inputStyle={{ paddingHorizontal: inputPadding }}
                placeholder={t(lang, 'email_placeholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
              />
              {tooltip?.target === 'email' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  onClose={() => {
                    const duplicateMsg = 'This email is already registered, please return to login';
                    const isDuplicate = tooltip?.message === duplicateMsg;
                    setTooltip(null);
                    if (isDuplicate) {
                      goToLogin();
                    }
                  }}
                />
              ) : null}
          </View>

          <View
            style={[
              styles.passwordInputRow,
              tooltip?.target === 'password'
                ? styles.passwordInputRowWithTooltip
                : null,
            ]}
          >
              <InputField
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  onboarding.setSignupDraft((prev) => ({ ...prev, password: v }));
                  setFieldErrors((prev) => ({ ...prev, password: false }));
                  if (tooltip?.target === 'password' && tooltip.variant !== 'info') setTooltip(null);
                }} 
                hasError={fieldErrors.password}
                containerStyle={styles.passwordInput}
                inputStyle={{
                  paddingVertical: Math.round(12 * scale),
                  marginBottom: 0,
                }}
                placeholder={t(lang, 'password_placeholder')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                onFocus={() => {
                  setPasswordFocused(true);
                }}
                onBlur={() => {
                  setPasswordFocused(false);
                  if (tooltip?.target === 'password' && tooltip.variant === 'info') setTooltip(null);
                }}
                rightAccessory={
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={Math.round(20 * scale)}
                      color={Colors.textSubtle}
                    />
                  </TouchableOpacity>
                }
              />
              {tooltip?.target === 'password' && tooltip.variant !== 'info' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  position="below"
                  onClose={() => {
                    setTooltip(null);
                    setPasswordFocused(false);
                  }}
                />
              ) : passwordFocused ? (
                <TooltipError
                  message={passwordRulesMessage}
                  variant="info"
                  position="below"
                  onClose={() => {
                    setPasswordFocused(false);
                  }}
                />
              ) : null}
          </View>

          <View
            style={[
              styles.passwordInputRow,
              tooltip?.target === 'confirmPassword'
                ? styles.passwordInputRowWithTooltip
                : null,
            ]}
          >
              <InputField
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  onboarding.setSignupDraft((prev) => ({
                    ...prev,
                    confirmPassword: v,
                  }));
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: false }));
                  if (tooltip?.target === 'confirmPassword') setTooltip(null);
                }}
                hasError={fieldErrors.confirmPassword}
                containerStyle={styles.passwordInput}
                inputStyle={{
                  paddingVertical: Math.round(12 * scale),
                  marginBottom: 0,
                }}
                placeholder={t(lang, 'confirm_password_placeholder')}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                rightAccessory={
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={Math.round(20 * scale)}
                      color={Colors.textSubtle}
                    />
                  </TouchableOpacity>
                }
              />
              {tooltip?.target === 'confirmPassword' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  position="below"
                  onClose={() => setTooltip(null)}
                />
              ) : null}
          </View>

          {/* <View
            style={[
              styles.termsRow,
              tooltip?.target === 'legal' ? styles.termsRowWithTooltip : null,
            ]}
          >
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } })}
              accessibilityRole="button"
              accessibilityLabel="Open Term of Service & Consent"
            >
              <Text style={styles.termsLinkText}>{t(lang, 'term_of_service_consent')}</Text>
              {tooltip?.target === 'legal' ? (
                <TooltipError message={tooltip.message} variant={tooltip.variant} onClose={() => setTooltip(null)} />
              ) : null}
            </TouchableOpacity>
          </View> */}

          <Button
            label={t(lang, 'sign_up_btn')}
            loading={loading}
            style={styles.primaryActionButton}
            onPress={handleSignup}
          />

          <View style={styles.inlineSigninRow}>
            <Text style={styles.helperText}>{t(lang, 'already_have_account')} </Text>
            <TouchableOpacity onPress={goToLogin}>
              <Text style={styles.linkText}>{t(lang, 'log_in_link')}</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.authDividerRow,
              {
                marginTop: Math.round((isCompact ? 18 : 27) * scale),
                marginBottom: Math.round((isCompact ? 12 : 18) * scale),
              },
            ]}
          >
            <Text style={styles.dividerText}>{t(lang, 'or_sign_up_with')}</Text>
          </View>

          <View style={styles.socialAuthRow}>
            <Button
              variant="secondary"
              style={styles.socialAuthButton}
              onPress={startGoogleSignup}
              disabled={loading || googleLoading || facebookLoading || lineLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Google"
              label="Continue with Google"
              leftAccessory={
                <Image
                  source={require('../../../../assets/android-res/drawable/google.png')}
                  style={styles.socialIcon}
                />
              }
            />
            <Button
              variant="secondary"
              style={[styles.socialAuthButton, { display: 'none' }]}
              onPress={startFacebookSignup}
              disabled={loading || googleLoading || facebookLoading || lineLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Facebook"
              label="Continue with Facebook"
              leftAccessory={
                <Image
                  source={require('../../../../assets/android-res/drawable/facebook.png')}
                  style={styles.socialIcon}
                />
              }
            />
            <Button
              variant="secondary"
              style={styles.socialAuthButton}
              onPress={startLineSignup}
              disabled={loading || googleLoading || facebookLoading || lineLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign up with LINE"
              label="Continue with LINE"
              leftAccessory={
                <Image
                  source={require('../../../../assets/android-res/drawable/line.png')}
                  style={styles.socialIcon}
                />
              }
            />
          </View>
        </ScrollView>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// styles moved to SignupScreen.styles.ts

export default SignupScreen;
