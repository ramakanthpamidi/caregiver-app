import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import DialogFrame from '../../../shared/components/DialogFrame';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

type Props = {
  visible: boolean;
  profileId?: number | string | null;
  profileName: string;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<boolean>; // returns true if password is correct
};

const INITIAL_ATTEMPTS = 3;
const INITIAL_TIMEOUT_SECONDS = 10;
const MAX_TIMEOUT_SECONDS = 600; // 10 minutes

/**
 * Dialog for entering a profile password with brute force protection.
 * - User gets 3 attempts before a timeout starts
 * - Timeout starts at 10 seconds and doubles each time (10s → 20s → 40s → ... → 10 min max)
 * - After timeout expires, user gets 3 more attempts
 */
export default function ProfilePasswordDialog({ visible, profileId = null, profileName, onCancel, onSubmit }: Props) {
  const { lang } = useLanguage();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [attemptsLeft, setAttemptsLeft] = useState(INITIAL_ATTEMPTS);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(0);
  const [timeoutEndsAtMs, setTimeoutEndsAtMs] = useState<number | null>(null);
  const [currentTimeoutDuration, setCurrentTimeoutDuration] = useState(INITIAL_TIMEOUT_SECONDS);
  const [restoring, setRestoring] = useState(false);

  const getStorageKey = React.useCallback((pid: Props['profileId']) => {
    if (pid === null || pid === undefined) return null;
    const s = String(pid);
    if (!s || s === 'NaN' || s === '-1') return null;
    return `profilePasswordAttempts.v1.${s}`;
  }, []);

  const persistState = React.useCallback(
    async (next: {
      attemptsLeft: number;
      isTimedOut: boolean;
      timeoutEndsAtMs: number | null;
      currentTimeoutDuration: number;
    }) => {
      const key = getStorageKey(profileId);
      if (!key) return;
      try {
        await AsyncStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [getStorageKey, profileId]
  );

  const clearPersistedState = React.useCallback(async () => {
    const key = getStorageKey(profileId);
    if (!key) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [getStorageKey, profileId]);

  // Restore attempt state on open / profile change (survives app restarts)
  useEffect(() => {
    if (!visible) return;
    const key = getStorageKey(profileId);
    if (!key) return;

    let cancelled = false;
    setRestoring(true);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (!raw) {
          setRestoring(false);
          return;
        }

        const parsed = JSON.parse(raw);
        const storedAttemptsLeft = Number(parsed?.attemptsLeft);
        const storedIsTimedOut = !!parsed?.isTimedOut;
        const storedEndsAt = parsed?.timeoutEndsAtMs != null ? Number(parsed.timeoutEndsAtMs) : null;
        const storedDuration = Number(parsed?.currentTimeoutDuration);

        if (Number.isFinite(storedDuration) && storedDuration > 0) {
          setCurrentTimeoutDuration(Math.min(storedDuration, MAX_TIMEOUT_SECONDS));
        }

        if (storedIsTimedOut && storedEndsAt && Number.isFinite(storedEndsAt)) {
          const remaining = Math.max(0, Math.ceil((storedEndsAt - Date.now()) / 1000));
          if (remaining <= 0) {
            setIsTimedOut(false);
            setTimeoutEndsAtMs(null);
            setTimeoutSeconds(0);
            setAttemptsLeft(INITIAL_ATTEMPTS);
            await clearPersistedState();
          } else {
            setIsTimedOut(true);
            setTimeoutEndsAtMs(storedEndsAt);
            setTimeoutSeconds(remaining);
            setAttemptsLeft(INITIAL_ATTEMPTS);
          }
        } else if (Number.isFinite(storedAttemptsLeft) && storedAttemptsLeft >= 0 && storedAttemptsLeft <= INITIAL_ATTEMPTS) {
          setIsTimedOut(false);
          setTimeoutEndsAtMs(null);
          setTimeoutSeconds(0);
          setAttemptsLeft(storedAttemptsLeft);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, profileId, getStorageKey, clearPersistedState]);

  // Timer countdown (based on an absolute end time so it remains correct after background/restart)
  useEffect(() => {
    if (!isTimedOut || !timeoutEndsAtMs) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timeoutEndsAtMs - Date.now()) / 1000));
      setTimeoutSeconds(remaining);
      if (remaining <= 0) {
        setIsTimedOut(false);
        setTimeoutEndsAtMs(null);
        setAttemptsLeft(INITIAL_ATTEMPTS);
        setErrorMessage(null);
        clearPersistedState();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimedOut, timeoutEndsAtMs, clearPersistedState]);

  // Reset transient UI state when dialog opens (do NOT reset attempts; those are persisted)
  useEffect(() => {
    if (visible) {
      setPassword('');
      setErrorMessage(null);
      setIsChecking(false);
      // Keep timeout state if we're currently in timeout
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      setErrorMessage(t(lang, 'profile_password_enter_required'));
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);

    try {
      const isCorrect = await onSubmit(password);

      if (isCorrect) {
        // Success - reset everything
        setPassword('');
        setErrorMessage(null);
        setAttemptsLeft(INITIAL_ATTEMPTS);
        setIsTimedOut(false);
        setTimeoutEndsAtMs(null);
        setTimeoutSeconds(0);
        setCurrentTimeoutDuration(INITIAL_TIMEOUT_SECONDS);
        await clearPersistedState();
      } else {
        // Wrong password
        const newAttemptsLeft = attemptsLeft - 1;
        setAttemptsLeft(newAttemptsLeft);
        setPassword('');

        if (newAttemptsLeft <= 0) {
          // Start timeout
          setIsTimedOut(true);
          const endsAt = Date.now() + currentTimeoutDuration * 1000;
          setTimeoutEndsAtMs(endsAt);
          setTimeoutSeconds(currentTimeoutDuration);
          setErrorMessage(`${t(lang, 'profile_password_too_many_attempts_wait')} ${currentTimeoutDuration} ${t(lang, 'profile_password_seconds')}`);
          
          // Double the timeout for next time (capped at 10 min)
          const nextDuration = Math.min(currentTimeoutDuration * 2, MAX_TIMEOUT_SECONDS);
          setCurrentTimeoutDuration(nextDuration);

          await persistState({
            attemptsLeft: INITIAL_ATTEMPTS,
            isTimedOut: true,
            timeoutEndsAtMs: endsAt,
            currentTimeoutDuration: nextDuration,
          });
        } else {
          const attemptsLabel = newAttemptsLeft === 1
            ? t(lang, 'profile_password_attempt_left')
            : t(lang, 'profile_password_attempts_left');
          setErrorMessage(`${t(lang, 'profile_password_incorrect_password')} ${newAttemptsLeft} ${attemptsLabel}`);

          await persistState({
            attemptsLeft: newAttemptsLeft,
            isTimedOut: false,
            timeoutEndsAtMs: null,
            currentTimeoutDuration,
          });
        }
      }
    } catch (err: any) {
      const msg = err?.message ? String(err.message) : t(lang, 'verify_password_failed');
      setErrorMessage(msg);
    } finally {
      setIsChecking(false);
    }
  };

  const formatTimeout = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${seconds}s`;
  };

  return (
    <DialogFrame visible={visible} onRequestClose={onCancel} disableBackdropClose={isChecking}>
      {/* Keep status bar text dark; avoid darkening status bar area by leaving top transparent */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor="rgba(0,0,0,0.5)"
        translucent
      />
      <View style={styles.content}>
          <View style={styles.header}>
            <Image
              source={require('../../../../assets/android-res/drawable/lock2.png')}
              style={styles.headerIcon}
            />
            <Text style={styles.title}>{t(lang, 'profile_password_enter_title')}</Text>
            <Text style={styles.subtitle}>{t(lang, 'profile_password_required_for')} "{profileName}"</Text>
          </View>

          {isTimedOut ? (
            <View style={styles.timeoutContainer}>
              <Image
                source={require('../../../../assets/android-res/drawable/lock2.png')}
                style={styles.timeoutIcon}
              />
              <Text style={styles.timeoutTitle}>{t(lang, 'profile_password_too_many_attempts_title')}</Text>
              <Text style={styles.timeoutMessage}>{t(lang, 'profile_password_wait_before_retry')}</Text>
              <Text style={styles.timeoutTimer}>{formatTimeout(timeoutSeconds)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(null);
                  }}
                  placeholder={t(lang, 'password_placeholder')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isChecking}
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isChecking}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {restoring ? (
                <View style={styles.restoringRow}>
                  <ActivityIndicator size="small" color="#064b75" />
                  <Text style={styles.restoringText}>{t(lang, 'profile_password_restoring')}</Text>
                </View>
              ) : null}

              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : (
                <View style={styles.attemptsContainer}>
                  <Text style={styles.attemptsText}>
                    {attemptsLeft} {t(lang, 'profile_password_attempts_remaining')}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              activeOpacity={0.85}
              disabled={isChecking}
            >
              <Text style={styles.cancelButtonText}>{t(lang, 'cancel')}</Text>
            </TouchableOpacity>

            {!isTimedOut && (
              <TouchableOpacity
                style={[styles.button, styles.submitButton, isChecking && styles.buttonDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={isChecking}
              >
                {isChecking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>{t(lang, 'profile_password_login')}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
      </View>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  attemptsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  attemptsText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeoutContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  timeoutIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  timeoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
    marginTop: 16,
    marginBottom: 8,
  },
  timeoutMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeoutTimer: {
    fontSize: 32,
    fontWeight: '900',
    color: '#f59e0b',
  },
  restoringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'center',
  },
  restoringText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#064b75',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
