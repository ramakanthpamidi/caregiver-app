import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';

import DialogFrame from '../../../shared/components/DialogFrame';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import InlineDropdown from '../../../shared/components/InlineDropdown';

const GOAL_TYPE_KEYS: Record<string, string> = {
  'Blood pressure': 'goal_type_bp',
  'Blood glucose level': 'goal_type_glucose',
  'Weight': 'goal_type_weight',
  'BMI': 'goal_type_bmi',
};

export type GoalDialogValues = {
  title: string;
  description: string;
  goalType: string;
  // Back-compat: non-blood-pressure goals use { value, unit }.
  targetValue?: number;
  targetUnit?: string;
  // New: allow structured targets, e.g. blood pressure { systolic, diastolic, unit }.
  target?: any;
};

type Props = {
  visible: boolean;
  profileLabel?: string;
  mode?: 'create' | 'edit';
  initialValues?: Partial<GoalDialogValues>;
  onCancel: () => void;
  onSubmit: (values: GoalDialogValues) => void | Promise<void>;
  onDelete?: () => void;
};

const GoalDialog: React.FC<Props> = ({
  visible,
  profileLabel,
  mode = 'create',
  initialValues,
  onCancel,
  onSubmit,
  onDelete,
}) => {
  const { lang } = useLanguage();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [goalType, setGoalType] = React.useState('Weight');
  const [targetText, setTargetText] = React.useState('');
  const [targetUnit, setTargetUnit] = React.useState('kg');
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [openDropdown, setOpenDropdown] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const dialogRootRef = React.useRef<View | null>(null);
  const goalTypeAnchorRef = React.useRef<View | null>(null);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const GOAL_TYPES = React.useMemo(
    () => ['Blood pressure', 'Blood glucose level', 'Weight', 'BMI'] as const,
    []
  );
  const goalTypeOptions = React.useMemo(
    () =>
      GOAL_TYPES.map((opt) => ({
        key: opt,
        label: t(lang, GOAL_TYPE_KEYS[opt] || 'goal_type_weight'),
      })),
    [GOAL_TYPES, lang]
  );

  const normalizeGoalType = React.useCallback(
    (input: any): (typeof GOAL_TYPES)[number] => {
      const s = String(input || '').trim().toLowerCase();
      if (!s) return 'Weight';
      if (s === 'pressure' || s === 'blood pressure' || s === 'blood_pressure' || s === 'bloodpressure') return 'Blood pressure';
      if (s === 'glucose' || s === 'blood glucose level' || s === 'blood glucose' || s === 'blood_glucose' || s === 'bloodglucose') {
        return 'Blood glucose level';
      }
      if (s === 'weight') return 'Weight';
      if (s === 'bmi') return 'BMI';
      // If server stored a different string, keep it but don't break dropdown.
      const exact = String(input || '').trim();
      return (GOAL_TYPES as readonly string[]).includes(exact) ? (exact as any) : 'Weight';
    },
    [GOAL_TYPES]
  );

  const unitForGoalType = React.useCallback((gt: string): string => {
    const s = String(gt || '').trim().toLowerCase();
    if (s === 'blood pressure') return 'mmHg';
    if (s === 'blood glucose level') return 'mg/dL';
    if (s === 'weight') return 'kg';
    if (s === 'bmi') return '';
    return '';
  }, []);

  const placeholderForGoalType = React.useCallback((gt: string): string => {
    const s = String(gt || '').trim().toLowerCase();
    if (s === 'blood pressure') return 'e.g. 120/80';
    if (s === 'blood glucose level') return 'e.g. 110';
    if (s === 'weight') return 'e.g. 70';
    if (s === 'bmi') return 'e.g. 22.5';
    return 'e.g. 0';
  }, []);

  const textAreaLineHeight = 20;
  const textAreaPaddingVertical = 10;
  const textAreaMinHeight = textAreaLineHeight * 1 + textAreaPaddingVertical * 2;
  const textAreaMaxHeight = textAreaLineHeight * 3 + textAreaPaddingVertical * 2;
  const [descHeight, setDescHeight] = React.useState<number>(textAreaMinHeight);

  const openAnchoredDropdown = React.useCallback(() => {
    const anchor = goalTypeAnchorRef.current;
    const root = dialogRootRef.current;
    if (!anchor || !root) {
      setOpenDropdown({ x: 16, y: 120, width: 240, height: 52 });
      return;
    }

    root.measureInWindow((rootX, rootY) => {
      anchor.measureInWindow((x, y, width, height) => {
        setOpenDropdown({
          x: x - rootX,
          y: y - rootY,
          width,
          height,
        });
      });
    });
  }, []);



  React.useEffect(() => {
    if (!visible) return;
    setTitle((initialValues?.title || '').toString());
    setDescription((initialValues?.description || '').toString());

    const gt = normalizeGoalType((initialValues?.goalType || 'Weight').toString());
    setGoalType(gt);
    const rawTarget: any = (initialValues as any)?.target;
    const initialText = (() => {
      if (rawTarget && typeof rawTarget === 'object') {
        const sys = Number(rawTarget.systolic);
        const dia = Number(rawTarget.diastolic);
        if (Number.isFinite(sys) && Number.isFinite(dia)) return `${sys}/${dia}`;
        if (rawTarget.value !== undefined && rawTarget.value !== null) return String(rawTarget.value);
      }

      const tv = (initialValues as any)?.targetValue;
      return tv === undefined || tv === null ? '' : String(tv);
    })();
    setTargetText(initialText);

    const existingUnit = ((initialValues as any)?.targetUnit || rawTarget?.unit || '').toString().trim();
    const suggestedUnit = unitForGoalType(gt);
    setTargetUnit(existingUnit || suggestedUnit);

    setErrorText(null);
    setSubmitting(false);
    setOpenDropdown(null);
    setDescHeight(textAreaMinHeight);
  }, [
    visible,
    initialValues?.title,
    initialValues?.description,
    initialValues?.goalType,
    (initialValues as any)?.target,
    (initialValues as any)?.targetValue,
    initialValues?.targetUnit,
    normalizeGoalType,
    unitForGoalType,
    textAreaMinHeight,
  ]);

  const close = React.useCallback(() => {
    if (submitting) return;
    if (openDropdown) {
      setOpenDropdown(null);
      return;
    }
    onCancel();
  }, [onCancel, openDropdown, submitting]);

  const handleSubmit = React.useCallback(async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorText(t(lang, 'title_required'));
      return;
    }

    const gt = goalType.trim();
    if (!gt) {
      setErrorText(t(lang, 'goal_type_required'));
      return;
    }

    const unit = targetUnit.trim();
    const isBloodPressure = gt.trim().toLowerCase() === 'blood pressure';

    let target: any = null;
    let valueNum: number | undefined = undefined;

    if (isBloodPressure) {
      const m = String(targetText || '')
        .trim()
        .match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
      if (!m) {
        setErrorText('Target value must look like “120/80”');
        return;
      }
      const sys = Number(m[1]);
      const dia = Number(m[2]);
      if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia <= 0) {
        setErrorText('Blood pressure values must be positive numbers');
        return;
      }
      target = { systolic: sys, diastolic: dia, unit: unit || unitForGoalType(gt) };
    } else {
      valueNum = Number(String(targetText || '').trim());
      if (!Number.isFinite(valueNum)) {
        setErrorText('Target value must be a number');
        return;
      }
      target = unit ? { value: valueNum, unit } : { value: valueNum };
    }

    setSubmitting(true);
    try {
      await Promise.resolve(
        onSubmit({
          title: trimmedTitle,
          description: description.trim(),
          goalType: gt,
          target,
          targetValue: valueNum,
          targetUnit: unit,
        })
      );
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Failed to save goal';
      setErrorText(msg);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, title, description, goalType, targetText, targetUnit, unitForGoalType, onSubmit]);

  return (
    <DialogFrame
      visible={visible}
      onRequestClose={close}
      disableBackdropClose={submitting || !!openDropdown}
      animationType="fade"
    >
      <View ref={dialogRootRef} collapsable={false} style={styles.dialogRoot}>
      <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Image source={require('../../../../assets/android-res/drawable/goal.png')} style={styles.headerIcon} />
            </View>
            <Text style={styles.title}>{mode === 'edit' ? t(lang, 'edit_goal') : t(lang, 'new_goal')}</Text>
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
            placeholder={t(lang, 'goal_title_placeholder')}
            autoCapitalize="sentences"
            style={[styles.input, errorText ? styles.inputError : null]}
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

          <Text style={styles.label}>{t(lang, 'goal_type_label')}</Text>
          <View ref={goalTypeAnchorRef} collapsable={false}>
            <TouchableOpacity
              style={[styles.selectContainer, { marginBottom: 0 }, openDropdown ? styles.selectContainerOpen : null]}
              activeOpacity={0.85}
              onPress={() => {
                if (submitting) return;
                if (openDropdown) {
                  setOpenDropdown(null);
                } else {
                  openAnchoredDropdown();
                }
              }}
            >
              <Ionicons name="options-outline" size={18} color={openDropdown ? '#064b75' : '#6b7280'} />
              <Text style={styles.selectText}>{t(lang, GOAL_TYPE_KEYS[goalType] || 'goal_type_weight')}</Text>
              <Ionicons name={openDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={openDropdown ? '#064b75' : '#6b7280'} />
            </TouchableOpacity>
          </View>
          <View style={{ height: 12 }} />

          <View style={styles.targetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {t(lang, 'target_value_label')}{targetUnit ? ` (${targetUnit})` : ''}
              </Text>
              <TextInput
                value={targetText}
                onChangeText={(v) => {
                  setTargetText(v);
                  if (errorText) setErrorText(null);
                }}
                placeholder={placeholderForGoalType(goalType)}
                keyboardType={
                  goalType.trim().toLowerCase() === 'blood pressure'
                    ? Platform.OS === 'ios'
                      ? 'numbers-and-punctuation'
                      : 'default'
                    : Platform.OS === 'ios'
                      ? 'decimal-pad'
                      : 'numeric'
                }
                style={[styles.input, errorText ? styles.inputError : null]}
                editable={!submitting}
              />
            </View>
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          {mode === 'edit' && onDelete ? (
            <TouchableOpacity
              style={[styles.deleteBtn, submitting ? styles.buttonDisabled : null]}
              onPress={onDelete}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Image source={require('../../../../assets/android-res/drawable/delete.png')} style={styles.deleteIcon} />
              <Text style={styles.deleteText}>{t(lang, 'delete_goal')}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.secondaryButton, submitting ? styles.buttonDisabled : null]} onPress={close} disabled={submitting}>
              <Text style={styles.secondaryText}>{t(lang, 'cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, submitting ? styles.buttonDisabled : null]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'edit' ? t(lang, 'save') : t(lang, 'create')}</Text>}
            </TouchableOpacity>
          </View>
      </View>

      <InlineDropdown
        visible={!!openDropdown}
        anchor={openDropdown ?? { x: 0, y: 0, width: 0, height: 0 }}
        options={goalTypeOptions}
        selectedKey={goalType}
        viewportPadding={0}
        onClose={() => setOpenDropdown(null)}
        onSelect={(key) => {
          if (submitting) return;
          setGoalType(key);
          setTargetText('');
          setTargetUnit(unitForGoalType(key));
          setOpenDropdown(null);
        }}
      />
      </View>

    </DialogFrame>
  );
};

const styles = StyleSheet.create({
  dialogRoot: {
    position: 'relative',
  },
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
  inputError: { borderColor: '#b22121' },
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
  selectContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectContainerOpen: { borderColor: '#064b75' },
  selectText: { color: '#111827', fontSize: 16, fontWeight: '700', flex: 1 },
  targetRow: { flexDirection: 'row', alignItems: 'flex-start' },
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

export default GoalDialog;
