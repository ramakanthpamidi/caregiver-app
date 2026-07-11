import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import DialogFrame from '../../../shared/components/DialogFrame';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

export type ReminderDialogValues = {
  title: string;
  description: string;
  time: Date;
  repeatType: 'None' | 'Daily' | 'Weekly';
  repeatRule?: any;
  enabled?: boolean;
};

function normalizeRepeatType(input: any): ReminderDialogValues['repeatType'] {
  const s = String(input || '').trim().toLowerCase();
  if (s === 'none') return 'None';
  if (s === 'weekly') return 'Weekly';
  if (s === 'daily') return 'Daily';
  return 'Daily';
}

function parseRepeatRule(input: any): any | null {
  if (!input) return null;
  if (typeof input === 'object') return input;
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeByWeekdayToMon1Sun7(input: any): number[] {
  let arr: any[] = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'string') {
    const raw = input.trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        // ignore
      }
    }
    if (arr.length === 0 && raw.length > 0) {
      arr = raw.split(',').map((s) => s.trim());
    }
  }

  const nums = arr.map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[];
  // Accept either 0-6 (Sun=0) or 1-7 (Mon=1..Sun=7)
  const toMon1Sun7 = (v: number) => {
    if (v >= 1 && v <= 7) return v;
    if (v >= 0 && v <= 6) return v === 0 ? 7 : v;
    return null;
  };
  const mapped = nums.map(toMon1Sun7).filter((v): v is number => v !== null);
  const unique = [...new Set(mapped)];
  unique.sort((a, b) => a - b);
  return unique;
}

type Props = {
  visible: boolean;
  profileLabel?: string;
  mode?: 'create' | 'edit';
  initialValues?: Partial<ReminderDialogValues>;
  onCancel: () => void;
  onSubmit: (values: ReminderDialogValues) => void | Promise<void>;
  onDelete?: () => void;
};

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const ReminderDialog: React.FC<Props> = ({
  visible,
  profileLabel,
  mode = 'create',
  initialValues,
  onCancel,
  onSubmit,
  onDelete,
}) => {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [time, setTime] = React.useState<Date>(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [showPicker, setShowPicker] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [repeatType, setRepeatType] = React.useState<ReminderDialogValues['repeatType']>('Daily');
  const [enabled, setEnabled] = React.useState(true);
  const openedRef = React.useRef(false);
  // Stored as 1..7 (Mon..Sun)
  const [byWeekday, setByWeekday] = React.useState<number[]>([]);

  const { lang } = useLanguage();
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const textAreaLineHeight = 20;
  const textAreaPaddingVertical = 10;
  const textAreaMinHeight = textAreaLineHeight * 1 + textAreaPaddingVertical * 2;
  const textAreaMaxHeight = textAreaLineHeight * 3 + textAreaPaddingVertical * 2;
  const [descHeight, setDescHeight] = React.useState<number>(textAreaMinHeight);

  React.useEffect(() => {
    // Initialize dialog state only when opening.
    if (!visible) {
      openedRef.current = false;
      return;
    }

    if (openedRef.current) return;
    openedRef.current = true;

    setTitle((initialValues?.title || '').toString());
    setDescription((initialValues?.description || '').toString());

    const d = initialValues?.time instanceof Date ? new Date(initialValues.time) : new Date();
    if (!(initialValues?.time instanceof Date)) {
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
    }
    setTime(d);

    setEnabled((initialValues as any)?.enabled !== false);
    setErrorText(null);
    setShowPicker(false);
    setSubmitting(false);

    setRepeatType(normalizeRepeatType((initialValues as any)?.repeatType));

    const ruleParsed = parseRepeatRule((initialValues as any)?.repeatRule);
    const ruleObj = ruleParsed && typeof ruleParsed === 'object' ? ruleParsed : null;
    const ruleDaysRaw = ruleObj
      ? (ruleObj as any).byWeekday ?? (ruleObj as any).byweekday ?? (ruleObj as any).by_weekday
      : ruleParsed;
    setByWeekday(normalizeByWeekdayToMon1Sun7(ruleDaysRaw));

    setDescHeight(textAreaMinHeight);
  }, [visible, initialValues]);

  const close = React.useCallback(() => {
    if (submitting) return;
    if (showPicker) {
      setShowPicker(false);
      return;
    }
    onCancel();
  }, [onCancel, showPicker, submitting]);

  const handleSubmit = React.useCallback(async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorText(t(lang, 'title_required'));
      return;
    }

    if (repeatType === 'Weekly' && byWeekday.length === 0) {
      setErrorText(t(lang, 'at_least_one_day'));
      return;
    }

    setSubmitting(true);
    try {
      const rule = repeatType === 'Weekly' ? { byWeekday } : null;
      await Promise.resolve(
        onSubmit({
          title: trimmedTitle,
          description: description.trim(),
          time,
          repeatType,
          repeatRule: rule,
          enabled,
        })
      );
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : (lang === 'th' ? 'ไม่สามารถบันทึกการแจ้งเตือนได้' : 'Failed to save reminder');
      setErrorText(msg);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, description, time, repeatType, byWeekday, enabled, onSubmit]);

  const toggleWeekday = React.useCallback((day: number) => {
    setByWeekday((prev) => {
      const has = prev.includes(day);
      const next = has ? prev.filter((d) => d !== day) : [...prev, day];
      return next.sort((a, b) => a - b);
    });
  }, []);

  return (
    <DialogFrame
      visible={visible}
      onRequestClose={close}
      disableBackdropClose={submitting || showPicker}
      animationType="fade"
    >
      <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Image source={require('../../../../assets/android-res/drawable/reminder.png')} style={styles.headerIcon} />
            </View>
            <Text style={styles.title}>{mode === 'edit' ? t(lang, 'edit_reminder') : t(lang, 'new_reminder')}</Text>
            {profileLabel ? (
              <View style={styles.profilePill}>
                <Text style={styles.profilePillText}>{profileLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.divider} />

          <Text style={styles.label}>{t(lang, 'goal_title_label')}</Text>

          <TextInput
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (errorText) setErrorText(null);
            }}
            placeholder={t(lang, 'reminder_title_placeholder')}
            autoCapitalize="sentences"
            style={[styles.input, errorText ? styles.inputError : null]}
            multiline={false}
            numberOfLines={1}
            scrollEnabled={false}
            selectTextOnFocus={false}
            contextMenuHidden={true}
            disableFullscreenUI={true}
            textAlignVertical="center"
            editable={!submitting}
          />

          <Text style={styles.label}>{t(lang, 'description_label')}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t(lang, 'desc_optional_placeholder')}
            autoCapitalize="sentences"
            style={[styles.textArea, { height: descHeight }]}
            multiline
            numberOfLines={1}
            scrollEnabled={descHeight >= textAreaMaxHeight}
            textAlignVertical="top"
            onContentSizeChange={(e) => {
              const next = clamp(e.nativeEvent.contentSize.height, textAreaMinHeight, textAreaMaxHeight);
              setDescHeight((prev) => (prev === next ? prev : next));
            }}
            editable={!submitting}
          />

          <Text style={styles.label}>{t(lang, 'time_label')}</Text>
          <TouchableOpacity
            style={styles.timeRow}
            activeOpacity={0.85}
            onPress={() => {
              if (submitting) return;
              setShowPicker(true);
            }}
            disabled={submitting}
          >
            <Text style={styles.timeValue}>{formatTime(time)}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>{t(lang, 'repeat_label')}</Text>
          <View style={styles.segmentRow}>
            {(['None', 'Daily', 'Weekly'] as const).map((opt) => {
              const active = repeatType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.segmentBtn, active ? styles.segmentBtnActive : null]}
                  onPress={() => {
                    if (submitting) return;
                    setRepeatType(opt);
                  }}
                  activeOpacity={0.85}
                  disabled={submitting}
                >
                  <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                    {opt === 'None' ? t(lang, 'repeat_none') : opt === 'Daily' ? t(lang, 'repeat_daily') : t(lang, 'repeat_weekly')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {repeatType === 'Weekly' ? (
            <View style={styles.weekdayRow}>
              {(
                [
                  { key: 1, label: 'M' },
                  { key: 2, label: 'T' },
                  { key: 3, label: 'W' },
                  { key: 4, label: 'T' },
                  { key: 5, label: 'F' },
                  { key: 6, label: 'S' },
                  { key: 7, label: 'S' },
                ] as const
              ).map((d) => {
                const active = byWeekday.includes(d.key);
                return (
                  <TouchableOpacity
                    key={String(d.key)}
                    style={[styles.weekdayChip, active ? styles.weekdayChipActive : null]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (submitting) return;
                      toggleWeekday(d.key);
                    }}
                    disabled={submitting}
                  >
                    <Text style={[styles.weekdayChipText, active ? styles.weekdayChipTextActive : null]}>
                      {lang === 'th'
                        ? (['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'] as const)[d.key - 1]
                        : d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {mode === 'edit' ? (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t(lang, 'active_label')}</Text>
              <Switch
                value={enabled}
                onValueChange={(v) => {
                  if (submitting) return;
                  setEnabled(!!v);
                }}
                disabled={submitting}
                trackColor={{ false: '#e5e7eb', true: 'rgba(6,75,117,0.35)' }}
                thumbColor={Platform.OS === 'android' ? (enabled ? '#064b75' : '#f3f4f6') : undefined}
              />
            </View>
          ) : null}

          {showPicker ? (
            <DateTimePicker
              value={time}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_e, selected) => {
                if (selected) setTime(selected);
                if (Platform.OS !== 'ios') setShowPicker(false);
              }}
            />
          ) : null}

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          {mode === 'edit' && onDelete ? (
            <TouchableOpacity
              style={[styles.deleteBtn, submitting ? styles.buttonDisabled : null]}
              onPress={onDelete}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Image source={require('../../../../assets/android-res/drawable/delete.png')} style={styles.deleteIcon} />
              <Text style={styles.deleteText}>{t(lang, 'delete_reminder')}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.secondaryButton, submitting ? styles.buttonDisabled : null]}
              onPress={close}
              disabled={submitting}
            >
              <Text style={styles.secondaryText}>{t(lang, 'cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, submitting ? styles.buttonDisabled : null]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{mode === 'edit' ? t(lang, 'save') : t(lang, 'create')}</Text>
              )}
            </TouchableOpacity>
          </View>
      </View>
    </DialogFrame>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  header: { alignItems: 'center', paddingBottom: 16 },
  iconBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(6,75,117,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerIcon: { width: 32, height: 32, resizeMode: 'contain' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: -0.3, textAlign: 'center' },
  profilePill: { marginTop: 6, backgroundColor: '#f3f4f6', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  profilePillText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 16, marginHorizontal: -4 },
  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 12,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    lineHeight: 20,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
    includeFontPadding: false,
  },
  inputError: { borderColor: '#b22121' },
  timeRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  timeValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  segmentRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  segmentBtnActive: {
    backgroundColor: '#064b75',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  weekdayChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    borderColor: '#064b75',
    backgroundColor: 'rgba(6,75,117,0.10)',
  },
  weekdayChipText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  weekdayChipTextActive: {
    color: '#064b75',
  },
  errorText: { marginTop: 4, color: '#b22121', fontSize: 13, textAlign: 'center' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    marginTop: 2,
  },
  deleteIcon: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#ef4444' },
  deleteText: { color: '#ef4444', fontSize: 13, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#111827',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#064b75',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: { opacity: 0.7 },
});

export default ReminderDialog;
