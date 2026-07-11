import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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

export type RenameDeviceDialogDevice = DeviceSummary & {
  can_rename?: boolean;
};

type Props = {
  visible: boolean;
  device: RenameDeviceDialogDevice | null;
  onRequestClose?: () => void;
  onChanged?: () => void;
};

const RenameDeviceDialog: React.FC<Props> = ({ visible, device, onRequestClose, onChanged }) => {
  const { lang } = useLanguage();
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const canRename = device?.can_rename !== false;

  React.useEffect(() => {
    setName(device?.device_name || '');
  }, [device?.device_name, device?.device_id]);

  const close = React.useCallback(() => {
    if (saving) return;
    onRequestClose?.();
  }, [onRequestClose, saving]);

  const doRename = React.useCallback(async () => {
    const deviceId = device?.device_id;
    if (!deviceId) {
      showToast(lang === 'th' ? 'ไม่พบ ID อุปกรณ์' : 'Missing device id', 'error');
      return;
    }

    if (!canRename) {
      showToast(t(lang, 'not_device_owner'), 'info');
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      showToast(lang === 'th' ? 'กรุณากรอกชื่ออุปกรณ์' : 'Device name cannot be empty', 'error');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showToast(lang === 'th' ? 'กรุณาเข้าสู่ระบบอีกครั้ง' : 'Please log in again', 'error');
        return;
      }

      const resp = await fetch(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_name: nextName }),
      });

      const text = await resp.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!resp.ok) {
        const msg = data?.error || data?.message || `Failed renaming device (status ${resp.status})`;
        showToast(msg, 'error');
        return;
      }

      showToast(lang === 'th' ? 'เปลี่ยนชื่ออุปกรณ์แล้ว' : 'Device renamed', 'success');
      try {
        emitDeviceUpdates();
      } catch {}
      onChanged?.();
      onRequestClose?.();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Network error renaming device';
      showToast(msg, 'info');
    } finally {
      setSaving(false);
    }
  }, [canRename, device?.device_id, lang, name, onChanged, onRequestClose]);

  return (
    <DialogFrame visible={visible} onRequestClose={close} disableBackdropClose={saving}>
      <Text style={styles.title}>{t(lang, 'rename_device')}</Text>

      <Text style={styles.sectionTitle}>{t(lang, 'new_name_label')}</Text>
      <TextInput
        style={[styles.input, !canRename ? styles.inputDisabled : null]}
        editable={canRename && !saving}
        value={name}
        onChangeText={setName}
        placeholder={t(lang, 'enter_device_name')}
        placeholderTextColor={Colors.textDisabled}
      />
      {!canRename ? <Text style={styles.helper}>{t(lang, 'not_device_owner')}</Text> : null}

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={close} disabled={saving}>
          <Text style={styles.secondaryText}>{t(lang, 'cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, (!canRename || saving) ? styles.buttonDisabled : null]}
          onPress={doRename}
          disabled={!canRename || saving}
        >
          {saving ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.primaryText}>{t(lang, 'save')}</Text>}
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
  sectionTitle: {
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.text,
    marginTop: Spacing.sm + Spacing.xs,
    marginBottom: Spacing.xs + Spacing.xxs,
  },
  helper: {
    marginTop: Spacing.xs + Spacing.xxs,
    color: Colors.textSubtle,
    fontSize: Typography.size.xs,
    lineHeight: Typography.lineHeight.xs,
    fontWeight: Typography.weight.medium,
  },
  input: {
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    color: Colors.text,
    backgroundColor: Colors.surface,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  inputDisabled: {
    backgroundColor: Colors.gray100,
    color: Colors.textSubtle,
  },
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
  primaryButton: {
    backgroundColor: Colors.primary,
    minHeight: 40,
    paddingVertical: Spacing.sm + Spacing.xxs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
  buttonDisabled: { opacity: 0.6 },
});

export default RenameDeviceDialog;
