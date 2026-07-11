import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../profiles/api/profileApi';
import { showToast } from '../../../shared/ui/toast';
import { emitDeviceUpdates } from '../lib/deviceEvents';
import type { DeviceSummary } from './ScanDeviceCard';
import DialogFrame from '../../../shared/components/DialogFrame';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Spacing, Typography } from '../../../shared/theme/theme';

export type RemoveDeviceDialogDevice = DeviceSummary;

type Props = {
  visible: boolean;
  device: RemoveDeviceDialogDevice | null;
  onRequestClose?: () => void;
  onRemoved?: () => void;
};

const RemoveDeviceDialog: React.FC<Props> = ({ visible, device, onRequestClose, onRemoved }) => {
  const { lang } = useLanguage();
  const [removing, setRemoving] = React.useState(false);

  const close = React.useCallback(() => {
    if (removing) return;
    onRequestClose?.();
  }, [onRequestClose, removing]);

  const doRemove = React.useCallback(async () => {
    const deviceId = device?.device_id;
    if (!deviceId) {
      showToast(lang === 'th' ? 'ไม่พบ ID อุปกรณ์' : 'Missing device id', 'error');
      return;
    }

    setRemoving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showToast(lang === 'th' ? 'กรุณาเข้าสู่ระบบอีกครั้ง' : 'Please log in again', 'error');
        return;
      }

      const resp = await fetch(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}?soft=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg = data?.error || data?.message || `Failed removing device (status ${resp.status})`;
        showToast(msg, 'error');
        return;
      }

      showToast(lang === 'th' ? 'นำอุปกรณ์ออกแล้ว' : 'Device removed', 'success');
      try {
        emitDeviceUpdates();
      } catch {}
      onRemoved?.();
      onRequestClose?.();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Network error removing device';
      showToast(msg, 'info');
    } finally {
      setRemoving(false);
    }
  }, [device?.device_id, lang, onRemoved, onRequestClose]);

  const deviceTitle = device?.device_name || device?.factory_name || device?.device_id || 'this device';

  return (
    <DialogFrame visible={visible} onRequestClose={close} disableBackdropClose={removing}>
      <Text style={styles.title}>{t(lang, 'remove_device_title')}</Text>
      <Text style={styles.message}>
        {t(lang, 'remove_device_confirm_prefix')} <Text style={styles.deviceNameRed}>{deviceTitle}</Text> {t(lang, 'remove_device_confirm_suffix')}
      </Text>

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={close} disabled={removing}>
          <Text style={styles.secondaryText}>{t(lang, 'cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dangerButton, removing ? styles.buttonDisabled : null]}
          onPress={doRemove}
          disabled={removing}
        >
          {removing ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.primaryText}>{t(lang, 'remove')}</Text>}
        </TouchableOpacity>
      </View>
    </DialogFrame>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm + Spacing.xs,
  },
  message: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.md,
    color: Colors.textMuted,
    marginBottom: Spacing.sm + Spacing.xs,
  },
  deviceNameRed: { color: Colors.danger, fontWeight: Typography.weight.bold },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm + Spacing.xs,
    marginTop: Spacing.md,
  },
  secondaryButton: {
    minHeight: 40,
    paddingVertical: Spacing.sm + Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    justifyContent: 'center',
  },
  secondaryText: {
    color: Colors.primary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  dangerButton: {
    backgroundColor: Colors.danger,
    minHeight: 40,
    paddingVertical: Spacing.sm + Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  buttonDisabled: { opacity: 0.65 },
});

export default RemoveDeviceDialog;
