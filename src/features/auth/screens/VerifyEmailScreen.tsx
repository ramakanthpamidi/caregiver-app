import React from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthActions } from '../state/authContext';
import { authApiUrl } from '../../../shared/config/api';
import InfoDialog from '../../../shared/components/InfoDialog';
import Button from '../../../shared/components/Button';
import InputField from '../../../shared/components/InputField';
import LanguageDropdown from '../../../shared/components/LanguageDropdown';
import LayoutPresets from '../../../shared/theme/layoutPresets';
import { t } from '../../../shared/i18n';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import styles from './VerifyEmailScreen.styles';

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailScreen: React.FC<{ setIsLoggedIn?: (v: boolean) => void }> = ({ setIsLoggedIn }) => {
  const auth = useAuthActions();
  const setLoggedIn = setIsLoggedIn || auth.setIsLoggedIn;
  const { lang } = useLanguage();
  const router = useRouter();
  const rawParams = useLocalSearchParams<{ email?: string; justSent?: string }>();
  const email = String(rawParams?.email || '').trim();
  const justSent =
    rawParams?.justSent === '1' ||
    rawParams?.justSent === 'true' ||
    rawParams?.justSent === 'True';

  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentDialogVisible, setSentDialogVisible] = React.useState(justSent);
  const [dialogTitle, setDialogTitle] = React.useState(t(lang, 'verify_email_dialog_title'));
  const [dialogMessage, setDialogMessage] = React.useState(t(lang, 'verify_email_dialog_message'));
  const [resendCooldown, setResendCooldown] = React.useState(justSent ? DEFAULT_RESEND_COOLDOWN_SECONDS : 0);

  React.useEffect(() => {
    setDialogTitle(t(lang, 'verify_email_dialog_title'));
    setDialogMessage(t(lang, 'verify_email_dialog_message'));
  }, [lang]);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const verify = async (codeArg?: string) => {
    if (!email) {
      setError(t(lang, 'verify_email_missing_email'));
      return;
    }
    const codeValue = (codeArg ?? code).trim();
    if (codeValue.length < 4) {
      setError(t(lang, 'verify_email_enter_code'));
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(authApiUrl('/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: codeValue }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!resp.ok) {
        setError((data && (data.error || data.message)) || `Verification failed (status ${resp.status})`);
        return;
      }

      const token = data?.token || data?.access_token;
      if (token) {
        await AsyncStorage.setItem('authToken', token);
        if (typeof setLoggedIn === 'function') setLoggedIn(true);
        setError(null);
      } else {
        setError(t(lang, 'verify_email_no_token'));
      }
    } catch (e: any) {
      setError(e?.message || t(lang, 'verify_email_failed'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setError(t(lang, 'verify_email_missing_email'));
      return;
    }
    if (resendLoading || resendCooldown > 0) {
      return;
    }

    setResendLoading(true);
    try {
      const resp = await fetch(authApiUrl('/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!resp.ok) {
        if (resp.status === 429) {
          const retryAfter = Number(data?.retryAfterSeconds);
          setResendCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RESEND_COOLDOWN_SECONDS);
        }
        setError((data && (data.error || data.message)) || `Resend failed (status ${resp.status})`);
        return;
      }

      setError(null);
      const retryAfter = Number(data?.retryAfterSeconds);
      setResendCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : DEFAULT_RESEND_COOLDOWN_SECONDS);
      setDialogTitle(t(lang, 'verify_email_dialog_resend_title'));
      setDialogMessage(
        typeof data?.message === 'string' && data.message.trim()
          ? data.message.trim()
          : t(lang, 'verify_email_dialog_resend_message')
      );
      setSentDialogVisible(true);
    } catch (e: any) {
      setError(e?.message || t(lang, 'verify_email_resend_failed'));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={LayoutPresets.fill}
    >
      <View style={LayoutPresets.screen}>
        <View style={[LayoutPresets.screenContent, styles.responsiveShell]}>
          <LanguageDropdown />
          <View style={styles.contentStack}>
            <Text style={styles.authCardTitle}>{t(lang, 'verify_email_title')}</Text>
            <Text style={styles.body}>{t(lang, 'verify_email_sent_to')}</Text>
            <Text style={styles.emailText}>
              {email || t(lang, 'verify_email_missing_email_label')}
            </Text>

            <View style={styles.codeFieldRow}>
              <InputField
                value={code}
                onChangeText={(v) => {
                  const filtered = v.replace(/[^0-9]/g, '').slice(0, 6);
                  setCode(filtered);
                  if (error) setError(null);
                  if (filtered.length === 6) {
                    verify(filtered);
                  }
                }}
                placeholder={t(lang, 'verify_email_code_placeholder')}
                keyboardType="number-pad"
                maxLength={6}
                hasError={!!error}
                inputStyle={{
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  letterSpacing: 2,
                }}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <Button
              label={t(lang, 'verify_email_button')}
              loading={loading}
              style={styles.primaryActionButton}
              onPress={() => {
                verify();
              }}
            />

            <View style={styles.helperRow}>
              <TouchableOpacity
                disabled={resendLoading || resendCooldown > 0}
                onPress={resend}
              >
                <Text style={styles.link}>
                  {t(lang, 'verify_email_resend_code')}
                  {resendCooldown > 0 ? ` (${resendCooldown}s)` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.linkMuted}>{t(lang, 'verify_email_back_to_login')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <InfoDialog
        visible={sentDialogVisible}
        title={dialogTitle}
        message={dialogMessage}
        onClose={() => setSentDialogVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

export default VerifyEmailScreen;
