import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import styles from './LoginScreen.styles';
import Button from '../../../shared/components/Button';
import InputField from '../../../shared/components/InputField';
import TooltipError from '../../../shared/components/TooltipError';
import NamePromptModal from '../../profiles/components/NamePromptModal';
import {
  googleBackendAuthenticate,
  googleSignInGetProfile,
  googleSignOutIfPossible,
} from '../services/googleAuth';
import {
  facebookBackendAuthenticate,
  facebookSignInGetProfile,
  facebookSignOutIfPossible,
} from '../services/facebookAuth';
import {
  lineBackendAuthenticate,
  lineSignInGetProfile,
  lineSignOutIfPossible,
} from '../../profiles/services/lineAuth';
import { useAuthActions } from '../state/authContext';
import { useOnboardingDraft } from '../../../shared/contexts/onboardingDraftContext';
import { authApiUrl } from '../../../shared/config/api';
import LanguageDropdown from '../../../shared/components/LanguageDropdown';
import InfoDialog from '../../../shared/components/InfoDialog';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors } from '../../../shared/theme/theme';
import LayoutPresets from '../../../shared/theme/layoutPresets';

const PENDING_SOCIAL_SIGNUP_KEY = 'pendingSocialSignup.v1';
const PENDING_POST_LEGAL_ACTION_KEY = 'pendingPostLegalAction.v1';
const PENDING_OAUTH_NAME_DIALOG_KEY = 'pendingOAuthNameDialog.v1';

const LoginScreen = ({
  setIsLoggedIn,
}: {
  setIsLoggedIn?: (v: boolean) => void;
}) => {
  const auth = useAuthActions();
  const setLoggedIn = setIsLoggedIn || auth.setIsLoggedIn;
  const { lang } = useLanguage();
  const safeInsets = useSafeAreaInsets();
  const onboarding = useOnboardingDraft();

  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const baseWidth = 375; // design base
  const scale = Math.min(Math.max(screenWidth / baseWidth, 0.8), 1.4);
  const logoOffset = Math.round(screenHeight * 0.03);
  const logoSize = 156;
  const boxPadding = Math.round(18 * scale);
  const inputPadding = Math.round(12 * scale);
  const iconSize = Math.round(20 * scale);

  const [keyboardOffset, setKeyboardOffset] = React.useState(0);
  const availableHeight = screenHeight - keyboardOffset;
  const isCompact = availableHeight < 760;
  const isKeyboardOpen = keyboardOffset > 0;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [googleNameModalVisible, setGoogleNameModalVisible] = React.useState(false);
  const [googleName, setGoogleName] = React.useState('');
  const [googleNameError, setGoogleNameError] = React.useState<string | null>(null);
  const [googlePendingIdToken, setGooglePendingIdToken] = React.useState<string | null>(null);

  const [facebookLoading, setFacebookLoading] = React.useState(false);
  const [facebookNameModalVisible, setFacebookNameModalVisible] =
    React.useState(false);
  const [facebookName, setFacebookName] = React.useState('');
  const [facebookNameError, setFacebookNameError] = React.useState<
    string | null
  >(null);
  const [facebookPendingAccessToken, setFacebookPendingAccessToken] =
    React.useState<string | null>(null);

  const [lineLoading, setLineLoading] = React.useState(false);
  const [lineNameModalVisible, setLineNameModalVisible] = React.useState(false);
  const [lineName, setLineName] = React.useState('');
  const [lineNameError, setLineNameError] = React.useState<string | null>(null);
  const [linePendingAccessToken, setLinePendingAccessToken] = React.useState<string | null>(null);

  const [existingAccountDialogVisible, setExistingAccountDialogVisible] = React.useState(false);

  const hasCompletedLegal = React.useMemo(() => {
    const legal = onboarding.legalAcceptance;
    return !!(legal.tosAccepted && legal.policyAccepted && legal.consentAccepted);
  }, [onboarding.legalAcceptance]);

  const [fieldErrors, setFieldErrors] = React.useState({
    email: false,
    password: false,
  });
  const [tooltip, setTooltip] = React.useState<{
    target: 'email' | 'password';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) =>
      setKeyboardOffset(e.endCoordinates ? e.endCoordinates.height : 250);
    const onHide = () => setKeyboardOffset(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const startGoogleLogin = async () => {
    setGoogleLoading(true);
    const timeout = setTimeout(() => {
      setGoogleLoading(false);
    }, 60000);
    try {
      const profile = await googleSignInGetProfile();

      const result = await googleBackendAuthenticate({
        idToken: profile.idToken,
        userLabel: (profile.displayName || '').trim() || undefined,
        mode: 'login',
      });

      if (result?.isNewAccount || result?.hasProfile === false) {
        // New account or existing account without profile — show name dialog → terms flow
        setGooglePendingIdToken(profile.idToken);
        setGoogleName((profile.displayName || '').trim());
        setGoogleNameError(null);
        await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
        setGoogleNameModalVisible(true);
        return;
      }

      if (result?.token) {
        onboarding.resetDraft();
        if (typeof setLoggedIn === 'function') setLoggedIn(true);
      } else if (result?.requiresEmailVerification) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: {
            email: result.email || '',
            justSent: '1',
          },
        });
      } else {
        throw new Error(
          'Google login succeeded but no token or verification status was returned',
        );
      }
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Google login failed';
      setFieldErrors({ email: true, password: false });
      setTooltip({ target: 'email', message: msg });
      await googleSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setGoogleLoading(false);
    }
  };

  const submitGoogleLoginWithName = async () => {
    const nameValue = googleName.trim();
    if (!nameValue) {
      setGoogleNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setGoogleLoading(true);
    try {
      // Token is already stored by the initial googleBackendAuthenticate call.
      // Navigate through signup legal flow so the user completes terms/consent.
      setGoogleNameModalVisible(false);
      setGooglePendingIdToken(null);
      setGoogleNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      await AsyncStorage.setItem(
        PENDING_POST_LEGAL_ACTION_KEY,
        JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
      );
      router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
    } catch (err: any) {
      setGoogleNameError(err?.message || 'Failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const startFacebookLogin = async () => {
    setFacebookLoading(true);
    const timeout = setTimeout(() => {
      setFacebookLoading(false);
    }, 60000);
    try {
      const profile = await facebookSignInGetProfile();
      const nameFromProvider = (profile.displayName || '').trim();

      const result = await facebookBackendAuthenticate({
        accessToken: profile.accessToken,
        userLabel: nameFromProvider || undefined,
      });

      if (result?.isNewAccount || result?.hasProfile === false) {
        // New account or existing account without profile — show name dialog for signup flow
        setFacebookPendingAccessToken(profile.accessToken);
        setFacebookName(nameFromProvider);
        setFacebookNameError(null);
        await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
        setFacebookNameModalVisible(true);
      } else {
        // Existing account with profile — just log in
        onboarding.resetDraft();
        if (typeof setLoggedIn === 'function') setLoggedIn(true);
      }
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Facebook login failed';
      setFieldErrors({ email: true, password: false });
      setTooltip({ target: 'email', message: msg });
      await facebookSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setFacebookLoading(false);
    }
  };

  const submitFacebookLoginWithName = async () => {
    const nameValue = facebookName.trim();
    if (!nameValue) {
      setFacebookNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setFacebookLoading(true);
    try {
      // Token already stored by facebookBackendAuthenticate.
      // Navigate through signup legal flow.
      setFacebookNameModalVisible(false);
      setFacebookPendingAccessToken(null);
      setFacebookNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      await AsyncStorage.setItem(
        PENDING_POST_LEGAL_ACTION_KEY,
        JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
      );
      router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
    } catch (err: any) {
      const msg = err?.message ? err.message : 'Facebook login failed';
      setFacebookNameError(msg);
    } finally {
      setFacebookLoading(false);
    }
  };

  const startLineLogin = async () => {
    setLineLoading(true);
    const timeout = setTimeout(() => {
      setLineLoading(false);
    }, 60000);
    try {
      const profile = await lineSignInGetProfile();
      const resolvedName = (profile.displayName || '').trim() || undefined;
      const result = await lineBackendAuthenticate({
        accessToken: profile.accessToken,
        userLabel: resolvedName,
        mode: 'login',
      });

      if (result?.isNewAccount || result?.hasProfile === false) {
        // New account or existing account without profile — show name dialog for signup flow
        setLinePendingAccessToken(profile.accessToken);
        setLineName(resolvedName || '');
        setLineNameError(null);
        await AsyncStorage.setItem(PENDING_OAUTH_NAME_DIALOG_KEY, '1');
        setLineNameModalVisible(true);
      } else {
        onboarding.resetDraft();
        if (typeof setLoggedIn === 'function') setLoggedIn(true);
      }
    } catch (err: any) {
      const msg = err?.message ? err.message : 'LINE login failed';
      console.warn('LINE login error:', msg, err);
      setFieldErrors({ email: true, password: false });
      setTooltip({ target: 'email', message: msg });
      await lineSignOutIfPossible();
    } finally {
      clearTimeout(timeout);
      setLineLoading(false);
    }
  };

  const submitLineLoginWithName = async () => {
    const nameValue = lineName.trim();
    if (!nameValue) {
      setLineNameError(t(lang, 'enter_user_name_error'));
      return;
    }

    setLineLoading(true);
    try {
      // Token already stored by lineBackendAuthenticate.
      // Navigate through signup legal flow.
      setLineNameModalVisible(false);
      setLinePendingAccessToken(null);
      setLineNameError(null);
      await AsyncStorage.removeItem(PENDING_OAUTH_NAME_DIALOG_KEY);

      await AsyncStorage.setItem(
        PENDING_POST_LEGAL_ACTION_KEY,
        JSON.stringify({ kind: 'loginWithToken', token: 'stored' }),
      );
      router.push({ pathname: '/(auth)/terms', params: { flow: 'signup' } });
    } catch (err: any) {
      const msg = err?.message ? err.message : 'LINE login failed';
      setLineNameError(msg);
    } finally {
      setLineLoading(false);
    }
  };

  // Resume after completing legal flow (terms → privacy → consent).
  // Token was already stored by the OAuth service; just log in.
  React.useEffect(() => {
    if (!hasCompletedLegal) return;

    let cancelled = false;
    const resume = async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_POST_LEGAL_ACTION_KEY);
        if (!raw || cancelled) return;

        await AsyncStorage.removeItem(PENDING_POST_LEGAL_ACTION_KEY);
        const pending = JSON.parse(raw);
        if (!pending || cancelled) return;

        if (pending.kind === 'loginWithToken') {
          // Token was stored by the OAuth service already
          onboarding.resetDraft();
          if (typeof setLoggedIn === 'function') setLoggedIn(true);
        }
      } catch {
        // ignore
      }
    };

    resume();
    return () => { cancelled = true; };
  }, [hasCompletedLegal, setLoggedIn]);

  const handleLogin = async () => {
    const emailValue = email.trim();
    const passwordValue = password;

    // Validation rules (as requested)
    if (!emailValue && !passwordValue) {
      setFieldErrors({ email: true, password: true });
      setTooltip({
        target: 'email',
        message: t(lang, 'enter_both_email_password'),
      });
      return;
    }
    if (!emailValue) {
      setFieldErrors({ email: true, password: false });
      setTooltip({ target: 'email', message: t(lang, 'enter_email') });
      return;
    }
    if (!passwordValue) {
      setFieldErrors({ email: false, password: true });
      setTooltip({ target: 'password', message: t(lang, 'enter_password') });
      return;
    }

    setFieldErrors({ email: false, password: false });
    setTooltip(null);

    setLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(authApiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }

      if (response.ok) {
        const token = data?.token || data?.access_token || data?.jwt;
        if (token) {
          await AsyncStorage.setItem('authToken', token);
          onboarding.resetDraft();
          if (typeof setLoggedIn === 'function') setLoggedIn(true);
          setFieldErrors({ email: false, password: false });
          setTooltip(null);
        } else {
          setFieldErrors({ email: true, password: false });
          setTooltip({
            target: 'email',
            message: 'Login failed. Please try again.',
          });
        }
      } else {
        if (response.status === 403 && data?.needsEmailVerification) {
          setFieldErrors({ email: false, password: false });
          setTooltip(null);
          router.push({
            pathname: '/(auth)/verify-email',
            params: {
              email: emailValue,
              justSent: data?.codeResent === true ? '1' : '0',
            },
          });
        } else if (
          response.status === 404 &&
          data?.error === 'account does not exist'
        ) {
          setFieldErrors({ email: true, password: false });
          setTooltip({ target: 'email', message: 'Account does not exist.' });
        } else {
          setFieldErrors({ email: true, password: true });
          setTooltip({
            target: 'email',
            message: t(lang, 'email_or_password_incorrect'),
          });
        }
      }
    } catch (error) {
      const isAbort =
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error as any).name === 'AbortError';
      setFieldErrors({ email: true, password: false });
      setTooltip({
        target: 'email',
        message: isAbort
          ? t(lang, 'request_timed_out')
          : t(lang, 'login_failed'),
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

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
          <NamePromptModal
            visible={googleNameModalVisible}
            title={t(lang, 'enter_user_name')}
            value={googleName}
            onChangeValue={v => {
              setGoogleName(v);
              if (googleNameError) setGoogleNameError(null);
            }}
            errorText={googleNameError}
            submitting={googleLoading}
            onCancel={() => {
              setGoogleNameModalVisible(false);
              setGooglePendingIdToken(null);
              setGoogleNameError(null);
              AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, PENDING_POST_LEGAL_ACTION_KEY, 'authToken']).catch(() => {});
              googleSignOutIfPossible();
            }}
            onSubmit={submitGoogleLoginWithName}
          />
          <NamePromptModal
            visible={facebookNameModalVisible}
            title={t(lang, 'enter_user_name')}
            value={facebookName}
            onChangeValue={v => {
              setFacebookName(v);
              if (facebookNameError) setFacebookNameError(null);
            }}
            errorText={facebookNameError}
            submitting={facebookLoading}
            onCancel={() => {
              setFacebookNameModalVisible(false);
              setFacebookPendingAccessToken(null);
              setFacebookNameError(null);
              AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, PENDING_POST_LEGAL_ACTION_KEY, 'authToken']).catch(() => {});
              facebookSignOutIfPossible();
            }}
            onSubmit={submitFacebookLoginWithName}
          />
          <NamePromptModal
            visible={lineNameModalVisible}
            title={t(lang, 'enter_user_name')}
            value={lineName}
            onChangeValue={v => {
              setLineName(v);
              if (lineNameError) setLineNameError(null);
            }}
            errorText={lineNameError}
            submitting={lineLoading}
            onCancel={() => {
              setLineNameModalVisible(false);
              setLinePendingAccessToken(null);
              setLineNameError(null);
              AsyncStorage.multiRemove([PENDING_OAUTH_NAME_DIALOG_KEY, PENDING_POST_LEGAL_ACTION_KEY, 'authToken']).catch(() => {});
              lineSignOutIfPossible();
            }}
            onSubmit={submitLineLoginWithName}
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
            <View style={styles.authHeroSection}>
              <Image
                source={require('../../../../assets/android-res/drawable/WellScreen512BG.png')}
                style={[
                  styles.logo,
                  {
                    marginTop: isCompact ? 0 : logoOffset,
                    width: logoSize,
                    height: logoSize,
                  },
                ]}
              />
            </View>

            <Text style={styles.authCardTitle}>
              {t(lang, 'login_account_title')}
            </Text>

            <View
              style={[
                styles.formFieldRow,
                tooltip?.target === 'email'
                  ? styles.formFieldRowWithTooltip
                  : null,
              ]}
            >
              <InputField
                hasError={fieldErrors.email}
                inputStyle={{ paddingHorizontal: inputPadding }}
                placeholder={t(lang, 'email_address')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={v => {
                  setEmail(v);
                  setFieldErrors(prev => ({ ...prev, email: false }));
                  setTooltip(null);
                }}
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
                  onClose={() => setTooltip(null)}
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
                hasError={fieldErrors.password}
                containerStyle={styles.passwordInput}
                inputStyle={{
                  paddingVertical: Math.round(12 * scale),
                  marginBottom: 0,
                }}
                placeholder={t(lang, 'password_placeholder')}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  setFieldErrors(prev => ({ ...prev, password: false }));
                  setTooltip(null);
                }}
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
                    onPress={() => setShowPassword(s => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={Math.round(20 * scale)}
                      color={Colors.textSubtle}
                    />
                  </TouchableOpacity>
                }
              />
              {tooltip?.target === 'password' ? (
                <TooltipError
                  message={tooltip.message}
                  onClose={() => setTooltip(null)}
                />
              ) : null}
            </View>

            <Button
              label={t(lang, 'login_account_title')}
              loading={loading}
              style={styles.primaryActionButton}
              onPress={handleLogin}
            />

            <View style={styles.inlineSignupRow}>
              <Text style={styles.noAccountText}>{t(lang, 'no_account')} </Text>
              <TouchableOpacity
                onPress={() => router.push('/(auth)/signup')}
              >
                <Text style={styles.linkText}>{t(lang, 'sign_up_link')}</Text>
              </TouchableOpacity>
            </View>

            {/* 
            
            SOCIAL AUTH BTNS
            
            */}

            <View
              style={[
                styles.authDividerRow,
                {
                  marginTop: Math.round((isCompact ? 18 : 27) * scale),
                  marginBottom: Math.round((isCompact ? 12 : 18) * scale),
                },
              ]}
            >
              {/* <View style={styles.dividerLine} /> */}
              <Text style={styles.dividerText}>
                {t(lang, 'or_sign_in_with')}
              </Text>
              {/* <View style={styles.dividerLine} /> */}
            </View>

            <View
              style={[
                styles.socialAuthRow,
                {
                  width: '100%',
                  marginTop: 0,
                },
              ]}
            >
              <Button
                variant="secondary"
                style={styles.socialAuthButton}
                onPress={startGoogleLogin}
                disabled={
                  loading || googleLoading || facebookLoading || lineLoading
                }
                accessibilityLabel="Login with Google"
                label="Continue with Google"
                leftAccessory={
                  <Image
                    source={require('../../../../assets/android-res/drawable/google.png')}
                    style={[styles.socialIcon]}
                  />
                }
              />
              <Button
                variant="secondary"
                style={[styles.socialAuthButton, { display: 'none' }]}
                onPress={startFacebookLogin}
                disabled={
                  loading || googleLoading || facebookLoading || lineLoading
                }
                accessibilityLabel="Login with Facebook"
                label="Continue with Facebook"
                leftAccessory={
                  <Image
                    source={require('../../../../assets/android-res/drawable/facebook.png')}
                    style={[styles.socialIcon]}
                  />
                }
              />
              <Button
                variant="secondary"
                style={styles.socialAuthButton}
                onPress={startLineLogin}
                disabled={
                  loading || googleLoading || facebookLoading || lineLoading
                }
                accessibilityLabel="Login with LINE"
                label="Continue with LINE"
                leftAccessory={
                  <Image
                    source={require('../../../../assets/android-res/drawable/line.png')}
                    style={[styles.socialIcon]}
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

// styles moved to LoginScreen.styles.ts

export default LoginScreen;
