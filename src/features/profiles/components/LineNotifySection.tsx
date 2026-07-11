import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  generateLinkPin,
  checkLinkStatus,
  listLineTargets,
  removeLineTarget,
  updateLineTarget,
  type LineNotifyTarget,
} from '../services/lineNotifyApi';
import DialogFrame from '../../../shared/components/DialogFrame';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Shadows } from '../../../shared/theme/theme';

type Props = {
  profileId: number | null;
  isOnline?: boolean;
};

const LINE_OFFICIAL_ACCOUNT_ID = '@350qlkpm';

export default function LineNotifySection({ profileId, isOnline = true }: Props) {
  const { lang } = useLanguage();

  const SEV_KEYS: Array<{
    key: keyof LineNotifyTarget;
    label: string;
    color: string;
  }> = [
    { key: 'notify_critical',  label: t(lang, 'sev_critical'),  color: '#ef4444' },
    { key: 'notify_warning',   label: t(lang, 'sev_warning'),   color: '#f59e0b' },
    { key: 'notify_good',      label: t(lang, 'sev_good'),      color: '#16a34a' },
    { key: 'notify_excellent', label: t(lang, 'sev_excellent'), color: '#3b82f6' },
  ];
  const [targets, setTargets] = useState<LineNotifyTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add dialog state (PIN-based linking)
  const [dialogVisible, setDialogVisible] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [pinGenerating, setPinGenerating] = useState(false);
  const [pinLinked, setPinLinked] = useState(false);
  const [pinExpired, setPinExpired] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listLineTargets(profileId);
      setTargets(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startPolling = useCallback((pinCode: string, expires: Date) => {
    stopPolling();
    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setPinExpired(true);
        // Stop only the countdown — let the poll keep running so it can still
        // detect a successful link if the webhook fired just before expiry.
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      }
    };
    updateRemaining();
    countdownRef.current = setInterval(updateRemaining, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const status = await checkLinkStatus(pinCode);
        if (status.linked) {
          setPinLinked(true);
          stopPolling();
          await load();
          setTimeout(() => setDialogVisible(false), 1200);
        } else if (status.expired) {
          setPinExpired(true);
          stopPolling();
        }
      } catch {
        // silently retry next poll
      }
    }, 3000);
  }, [stopPolling, load]);

  const generateNewPin = useCallback(async () => {
    if (!profileId) return;
    setPinGenerating(true);
    setPinError(null);
    setPinLinked(false);
    setPinExpired(false);
    setPin(null);
    try {
      const result = await generateLinkPin(profileId);
      const expires = new Date(result.expiresAt);
      setPin(result.pin);
      startPolling(result.pin, expires);
    } catch (e: any) {
      setPinError(e?.message ?? 'Failed to generate PIN');
    } finally {
      setPinGenerating(false);
    }
  }, [profileId, startPolling]);

  const handleAdd = () => {
    if (!profileId) return;
    if (!isOnline) {
      Alert.alert('Offline', t(lang, 'offline_line_add'));
      return;
    }
    setDialogVisible(true);
    generateNewPin();
  };

  const handleCloseDialog = useCallback(() => {
    stopPolling();
    setDialogVisible(false);
  }, [stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);


  // Remove confirmation dialog state
  const [removeTarget, setRemoveTarget] = useState<LineNotifyTarget | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = (target: LineNotifyTarget) => {
    setRemoveTarget(target);
  };

  const confirmRemove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await removeLineTarget(removeTarget.id);
      setTargets((prev) => prev.filter((t) => t.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to remove');
    } finally {
      setRemoving(false);
    }
  };

  const handleToggleEnabled = async (target: LineNotifyTarget) => {
    const next = !target.enabled;
    setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, enabled: next } : t)));
    try {
      await updateLineTarget(target.id, { enabled: next });
    } catch {
      setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, enabled: !next } : t)));
    }
  };

  const handleToggleSeverity = async (
    target: LineNotifyTarget,
    key: keyof LineNotifyTarget,
  ) => {
    const next = !target[key];
    setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, [key]: next } : t)));
    try {
      await updateLineTarget(target.id, { [key]: next } as any);
    } catch {
      setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, [key]: !next } : t)));
    }
  };

  return (
    <View style={styles.container}>
      {/* Add dialog - PIN-based linking */}
      <DialogFrame
        visible={dialogVisible}
        onRequestClose={handleCloseDialog}
        cardStyle={styles.linkDialogCard}
      >
        <Text style={styles.modalTitle}>
          {lang === 'th' ? 'เชื่อมต่อบัญชี LINE' : 'Connect LINE Account'}
        </Text>

        {pinGenerating ? (
          <View style={styles.pinLoadingWrap}>
            <ActivityIndicator size='large' color='#06c755' />
            <Text style={styles.pinLoadingText}>
              {lang === 'th' ? 'กำลังสร้างรหัส PIN...' : 'Generating PIN...'}
            </Text>
          </View>
        ) : pinLinked ? (
          <View style={styles.pinSuccessWrap}>
            <Text style={styles.pinSuccessIcon}>{String.fromCodePoint(0x2705)}</Text>
            <Text style={styles.pinSuccessText}>
              {lang === 'th' ? 'เชื่อมต่อสำเร็จ!' : 'Successfully linked!'}
            </Text>
          </View>
        ) : pinError ? (
          <View style={styles.pinErrorWrap}>
            <Text style={styles.pinErrorText}>{pinError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={generateNewPin} activeOpacity={0.75}>
              <Text style={styles.retryBtnText}>{lang === 'th' ? 'ลองอีกครั้ง' : 'Try Again'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.stepSection}>
              <Text style={styles.stepTitle}>
                {lang === 'th' ? '1. เพิ่มบัญชีทางการเป็นเพื่อน' : '1. Add the official account as a friend'}
              </Text>
              <Text style={styles.stepBody}>
                {lang === 'th' ? 'ใช้ LINE ID ด้านล่างหรือสแกน QR code' : 'Use the LINE ID below or scan the QR code.'}
              </Text>

              <View style={styles.lineIdChip}>
                <Text style={styles.lineIdChipLabel}>LINE ID</Text>
                <Text style={styles.lineIdChipValue}>{LINE_OFFICIAL_ACCOUNT_ID}</Text>
              </View>

              <Image
                source={require('../../../../assets/android-res/drawable/friend.png')}
                style={styles.friendQrImage}
                resizeMode='contain'
              />
            </View>

            <View style={[styles.stepSection, styles.pinStepSection]}>
              <Text style={styles.stepTitle}>
                {lang === 'th' ? '2. ส่ง PIN นี้ไปยังบอท' : '2. Send this PIN to the bot'}
              </Text>
              <Text style={styles.stepBody}>
                {lang === 'th'
                  ? 'หลังจากเพิ่มบัญชีเป็นเพื่อนแล้ว ให้ส่งรหัส PIN ด้านล่างในแชต LINE'
                  : 'After adding the account as a friend, send the PIN code below in LINE chat.'}
              </Text>

              <View style={[styles.pinCard, pinExpired && styles.pinCardExpired]}>
                <Text style={styles.pinDisplayValue}>{pin || '------'}</Text>
              </View>

              {!pinExpired && remainingSeconds > 0 && (
                <Text style={styles.pinCountdown}>
                  {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                </Text>
              )}
              {pinExpired && (
                <TouchableOpacity onPress={generateNewPin} activeOpacity={0.75}>
                  <Text style={styles.pinExpiredText}>
                    {lang === 'th' ? 'PIN หมดอายุแล้ว แตะเพื่อสร้างใหม่' : 'PIN expired. Tap to generate a new one.'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.pinFooter}>
              {!pinExpired && !pinLinked && (
                <View style={styles.pinWaitingRow}>
                  <ActivityIndicator size='small' color='#06c755' />
                  <Text style={styles.pinWaitingText}>
                    {lang === 'th' ? 'กำลังรอการเชื่อมต่อ...' : 'Waiting for connection...'}
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCloseDialog}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </DialogFrame>

      {/* Remove confirmation dialog */}
      <DialogFrame
        visible={removeTarget !== null}
        onRequestClose={() => !removing && setRemoveTarget(null)}
        disableBackdropClose={removing}
      >
        <Text style={styles.removeTitle}>{t(lang, 'remove_line_title')}</Text>
        <Text style={styles.removeMessage}>
          {t(lang, 'are_you_sure_remove')}{' '}
          <Text style={styles.removeNameRed}>
            {removeTarget?.line_display_name || removeTarget?.line_user_id}
          </Text>{' '}
          {t(lang, 'from_line_notif')}
        </Text>
        <View style={styles.removeActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setRemoveTarget(null)} disabled={removing}>
            <Text style={styles.secondaryText}>{t(lang, 'cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerButton, removing && styles.buttonDisabled]}
            onPress={confirmRemove}
            disabled={removing}
          >
            {removing ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerText}>{t(lang, 'remove')}</Text>}
          </TouchableOpacity>
        </View>
      </DialogFrame>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Image
            source={require('../../../../assets/android-res/drawable/line.png')}
            style={styles.lineIconImg}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.title}>{t(lang, 'line_notifications')}</Text>
            <Text style={styles.subtitle}>{targets.length} {targets.length === 1 ? t(lang, 'account_singular') : t(lang, 'accounts_plural')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, !isOnline && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!isOnline}
          activeOpacity={0.75}
        >
          <Text style={styles.addBtnText}>{t(lang, 'line_add_btn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color="#06c755" />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : targets.length === 0 ? (
        <View style={styles.emptyBox}>
          <Image
            source={require('../../../../assets/android-res/drawable/line.png')}
            style={styles.emptyIcon}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>{t(lang, 'no_line_accounts')}</Text>
          <Text style={styles.emptyDesc}>
            {t(lang, 'line_add_desc')}
          </Text>
          <View style={styles.emptyNoteRow}>
            <Image
              source={require('../../../../assets/android-res/drawable/information.png')}
              style={styles.emptyNoteIcon}
              resizeMode="contain"
            />
            <Text style={styles.emptyNote}>
              {t(lang, 'line_bot_friend_note')}
            </Text>
          </View>
        </View>
      ) : (
        targets.map((target) => (
          <View key={String(target.id)} style={[styles.targetCard, !target.enabled && styles.targetCardDisabled]}>
            {/* Name + master toggle row */}
            <View style={styles.targetHeader}>
              <View style={styles.targetAvatarWrap}>
                <Image
                  source={require('../../../../assets/android-res/drawable/profile.png')}
                  style={styles.targetAvatar}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.targetInfo}>
                <Text style={styles.targetName} numberOfLines={1}>
                  {target.line_display_name || t(lang, 'line_user_fallback')}
                </Text>
              </View>
              <View style={styles.targetHeaderRight}>
                <Switch
                  value={target.enabled}
                  onValueChange={() => handleToggleEnabled(target)}
                  trackColor={{ false: '#d1d5db', true: '#06c755' }}
                  thumbColor="#fff"
                  style={styles.switch}
                />
                <TouchableOpacity
                  onPress={() => handleRemove(target)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.removeBtn}
                >
                  <Image
                    source={require('../../../../assets/android-res/drawable/delete.png')}
                    style={styles.removeIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Per-severity toggles */}
            {target.enabled && (
              <View style={styles.severitySection}>
                <Text style={styles.severityLabel}>{t(lang, 'alert_levels')}</Text>
                <View style={styles.severityRow}>
                {SEV_KEYS.map(({ key, label, color }) => {
                    const active = !!target[key];
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.sevPill,
                          active
                            ? { backgroundColor: color, borderColor: color }
                            : { backgroundColor: '#fff', borderColor: '#e5e7eb' },
                        ]}
                        onPress={() => handleToggleSeverity(target, key)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.sevPillText, { color: active ? '#fff' : '#6b7280' }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lineIconImg: {
    width: 36,
    height: 36,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  addBtn: {
    backgroundColor: '#06c755',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    opacity: 0.3,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyNoteIcon: {
    width: 16,
    height: 16,
    tintColor: '#b45309',
    marginRight: 8,
  },
  emptyNote: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
    flex: 1,
  },
  targetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  targetCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  targetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  targetAvatar: {
    width: 22,
    height: 22,
    tintColor: '#06c755',
  },
  targetInfo: {
    flex: 1,
    marginRight: 8,
  },
  targetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  targetUserId: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  targetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    width: 16,
    height: 16,
    tintColor: '#ef4444',
  },
  severitySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  severityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sevPill: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  sevPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Add dialog (PIN-based)
  linkDialogCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  pinLoadingWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pinLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
  },
  pinSuccessWrap: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  pinSuccessIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  pinSuccessText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  pinErrorWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  pinErrorText: {
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#06c755',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepSection: {
    marginBottom: 14,
  },
  pinStepSection: {
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  stepBody: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 10,
  },
  lineIdChip: {
    alignSelf: 'center',
    minWidth: 168,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#eefbf4',
    borderWidth: 2,
    borderColor: '#c7f3db',
    marginBottom: 12,
  },
  lineIdChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0b7d58',
    marginBottom: 2,
    letterSpacing: 0.4,
  },
  lineIdChipValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065f46',
  },
  friendQrImage: {
    alignSelf: 'center',
    width: 152,
    height: 152,
  },
  pinCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    backgroundColor: '#f3fbf6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  pinCardExpired: {
    borderColor: '#f87171',
    backgroundColor: '#fff1f2',
  },
  pinDisplayValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  pinCountdown: {
    textAlign: 'center',
    fontSize: 11,
    color: '#6b7280',
  },
  pinExpiredText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
    textDecorationLine: 'underline',
  },
  pinFooter: {
    gap: 6,
  },
  pinWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pinWaitingText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 0,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  // Remove dialog
  removeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  removeMessage: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 10,
  },
  removeNameRed: {
    color: '#ef4444',
    fontWeight: '800',
  },
  removeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: '#064b75',
    fontWeight: '800',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  dangerText: {
    color: '#fff',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
