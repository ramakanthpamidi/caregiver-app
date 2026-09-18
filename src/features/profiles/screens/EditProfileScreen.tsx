import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { updateProfile, upsertMedicalGeneral, upsertProfileConsents, getMedicalGeneral, deleteProfile, getMyProfiles, type MedicalGeneralInfoPayload } from '../api/profileApi';
import TooltipError from '../../../shared/components/TooltipError';
import InfoDialog from '../../../shared/components/InfoDialog';
import Button from '../../../shared/components/Button';
import DynamicTextFieldList from '../../../shared/components/DynamicTextFieldList';
import { addOrUpdateCachedProfile, setCachedProfiles, removeCachedProfile, CachedProfile } from '../storage/profileCache';
import { showToast } from '../../../shared/ui/toast';
import { getProfileAvatar, setProfileAvatar, type ProfileAvatar } from '../lib/profileAvatar';
import styles from './CreateProfileScreen.styles';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { getInitialsFromName, getAvatarColorForProfile, getCachedAvatarColor, getSavedAvatarColor } from '../lib/avatarColors';
import { useProfileConsents } from '../../legal/hooks/useProfileConsents';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import AnchoredDropdown from '../../../shared/components/AnchoredDropdown';
import LogoutDialog from '../components/LogoutDialog';
import { setActiveProfileId, emitProfilesUpdated } from '../lib/profileEvents';
import { deleteAlertsByProfileAndPeriod } from '../../alerts/storage/alertStorage';
import { clearCachedReminders } from '../storage/reminderCache';
import { clearCachedGoals } from '../storage/goalCache';
import { purgeOutboxForDeletedProfile } from '../../../shared/sync/syncOutbox';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { parseJsonbTopicList, serializeJsonbTopicList } from '../lib/jsonbTopicList';

type Props = {
  profile: CachedProfile;
  onComplete: () => void;
  onBack: () => void;
};

export default function EditProfileScreen({ profile, onComplete, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { lang } = useLanguage();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [fieldErrors, setFieldErrors] = React.useState({ profileLabel: false, heightCm: false, weightKg: false });
  const [tooltip, setTooltip] = React.useState<
    { target: 'profileLabel' | 'heightCm' | 'weightKg' | 'submit'; message: string; variant?: 'error' | 'info' } | null
  >(null);

  // profiles table
  const [profileLabel, setProfileLabel] = React.useState(profile.profile_label || '');
  const [accessPassword, setAccessPassword] = React.useState('');
  const [showAccessPassword, setShowAccessPassword] = React.useState(false);

  const [customAvatar, setCustomAvatar] = React.useState<ProfileAvatar | null>(null);
  const avatarOpacity = React.useRef(new Animated.Value(1)).current;
  const didInitAvatarRef = React.useRef(false);

  const [medicalInfoLocked, setMedicalInfoLocked] = React.useState(false);
  const [medicalLockedDialogVisible, setMedicalLockedDialogVisible] = React.useState(false);
  const [deleteProfileDialogVisible, setDeleteProfileDialogVisible] = React.useState(false);
  const [deletingProfile, setDeletingProfile] = React.useState(false);

  const profileConsents = useProfileConsents(profile.id);

  React.useEffect(() => {
    setMedicalInfoLocked(profileConsents?.consent_granted === false);
  }, [profileConsents?.consent_granted]);

  const [displayAvatarLetter, setDisplayAvatarLetter] = React.useState<string | null>(null);
  const [displayAvatarColor, setDisplayAvatarColor] = React.useState<string>('#f3f4f6');
  const [displayAvatar, setDisplayAvatar] = React.useState<ProfileAvatar | null>(null);

  const [avatarEditorVisible, setAvatarEditorVisible] = React.useState(false);
  const [avatarEditorUri, setAvatarEditorUri] = React.useState<string | null>(null);
  const [avatarEditorImageSize, setAvatarEditorImageSize] = React.useState({ w: 1, h: 1 });
  const avatarEditorCircleSize = 240;

  // Animated values for smooth gesture updates
  const avatarPanX = React.useRef(new Animated.Value(0)).current;
  const avatarPanY = React.useRef(new Animated.Value(0)).current;
  const avatarScale = React.useRef(new Animated.Value(1)).current;

  // Refs for gesture tracking
  const panRef = React.useRef({ x: 0, y: 0 });
  const scaleRef = React.useRef(1);
  const imageSizeRef = React.useRef({ w: 1, h: 1 });
  const panTouchIdRef = React.useRef<number | null>(null);
  const pinchTouchIdsRef = React.useRef<[number, number] | null>(null);
  const touchStartRef = React.useRef<
    | {
        startPageX: number;
        startPageY: number;
        panX: number;
        panY: number;
      }
    | null
  >(null);
  const pinchStartDistRef = React.useRef<number | null>(null);
  const pinchStartScaleRef = React.useRef(1);

  const clampPan = (x: number, y: number, scale: number) => {
    const imgW = imageSizeRef.current.w * scale;
    const imgH = imageSizeRef.current.h * scale;
    const maxX = Math.max(0, (imgW - avatarEditorCircleSize) / 2);
    const maxY = Math.max(0, (imgH - avatarEditorCircleSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const getDistance = (touches: any[]) => {
    if (!touches || touches.length < 2) return null;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches.length === 1) {
      panTouchIdRef.current = touches[0].identifier;
      pinchTouchIdsRef.current = null;
      touchStartRef.current = {
        startPageX: touches[0].pageX,
        startPageY: touches[0].pageY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      pinchStartDistRef.current = null;
    } else if (touches.length >= 2) {
      panTouchIdRef.current = null;
      pinchTouchIdsRef.current = [touches[0].identifier, touches[1].identifier];
      const dist = getDistance(touches);
      if (dist !== null) {
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = scaleRef.current;
      }
      touchStartRef.current = null;
    }
  };

  const handleTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;

    if (touches.length >= 2) {
      if (!pinchTouchIdsRef.current) {
        pinchTouchIdsRef.current = [touches[0].identifier, touches[1].identifier];
        pinchStartDistRef.current = null;
        pinchStartScaleRef.current = scaleRef.current;
      }

      const [idA, idB] = pinchTouchIdsRef.current;
      const tA = touches.find((t: any) => t.identifier === idA) ?? touches[0];
      const tB = touches.find((t: any) => t.identifier === idB) ?? touches[1];
      if (!tA || !tB) return;

      const dx = tA.pageX - tB.pageX;
      const dy = tA.pageY - tB.pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (pinchStartDistRef.current === null) {
        pinchStartDistRef.current = dist;
        pinchStartScaleRef.current = scaleRef.current;
        return;
      }

      const ratio = dist / pinchStartDistRef.current;
      const nextScale = Math.max(1, Math.min(4, pinchStartScaleRef.current * ratio));
      scaleRef.current = nextScale;
      avatarScale.setValue(nextScale);

      const clamped = clampPan(panRef.current.x, panRef.current.y, nextScale);
      panRef.current = clamped;
      avatarPanX.setValue(clamped.x);
      avatarPanY.setValue(clamped.y);
      return;
    }

    if (touches.length === 1 && touchStartRef.current) {
      pinchTouchIdsRef.current = null;
      const id = panTouchIdRef.current;
      const t = (id != null ? touches.find((touch: any) => touch.identifier === id) : null) ?? touches[0];
      if (!t) return;

      const dx = t.pageX - touchStartRef.current.startPageX;
      const dy = t.pageY - touchStartRef.current.startPageY;
      const next = clampPan(touchStartRef.current.panX + dx, touchStartRef.current.panY + dy, scaleRef.current);

      panRef.current = next;
      avatarPanX.setValue(next.x);
      avatarPanY.setValue(next.y);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    panTouchIdRef.current = null;
    pinchTouchIdsRef.current = null;
    pinchStartDistRef.current = null;
  };

  const avatarLetter = React.useMemo(() => {
    return getInitialsFromName(profileLabel);
  }, [profileLabel]);

  const [stableAvatarColor, setStableAvatarColor] = React.useState<string>(() => {
    const name = (profile.profile_label || profileLabel || 'Profile').trim() || 'Profile';
    return getCachedAvatarColor(profile.id) || getAvatarColorForProfile(name);
  });

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const name = (profile.profile_label || profileLabel || 'Profile').trim() || 'Profile';
      const color = await getSavedAvatarColor(profile.id, name);
      if (!mounted) return;
      setStableAvatarColor(color);
    })().catch(() => {
      // ignore
    });
    return () => {
      mounted = false;
    };
    // Intentionally do not depend on `profileLabel` to avoid re-reading storage on each keystroke.
  }, [profile.id, profile.profile_label]);

  const avatarColor = React.useMemo(() => stableAvatarColor, [stableAvatarColor]);

  const toTextField = React.useCallback((v: any): string => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }, []);

  // Load existing avatar and medical data
  React.useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const avatar = await getProfileAvatar(profile.id);
        if (!mounted) return;
        if (avatar) {
          setCustomAvatar(avatar);
        }

        // Load medical data
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          const medical = await getMedicalGeneral(token, profile.id);
          if (!mounted) return;
          if (medical) {
            const dobRaw = medical.date_of_birth;
            const dobText = dobRaw ? String(dobRaw) : '';
            // Keep YYYY-MM-DD if server returns ISO timestamps.
            setDateOfBirth(dobText.length >= 10 ? dobText.slice(0, 10) : dobText);
            setSex(toTextField(medical.sex));
            setOrganDonor(medical.organ_donor === true);
            setBloodType(toTextField(medical.blood_type));
            setHeightCm(medical.height_cm != null ? String(medical.height_cm) : '');
            setWeightKg(medical.weight_kg != null ? String(medical.weight_kg) : '');
            setAllergies(parseJsonbTopicList(medical.allergies));
            setChronicConditions(parseJsonbTopicList(medical.chronic_conditions));
            setMedications(parseJsonbTopicList(medical.medications));
            setFamilyHistory(parseJsonbTopicList(medical.family_history));
            setEmergencyContact(toTextField(medical.emergency_contact));
            setInsuranceProvider(toTextField(medical.insurance_provider));
            setInsuranceNumber(toTextField(medical.insurance_number));
          }
        }
      } catch (e) {
        console.warn('Failed to load profile data:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [profile.id, toTextField]);

  const guessImageExt = (fileName?: string, mimeType?: string) => {
    const fromFile = (fileName || '').toLowerCase();
    if (fromFile.endsWith('.png')) return 'png';
    if (fromFile.endsWith('.webp')) return 'webp';
    if (fromFile.endsWith('.heic')) return 'heic';
    if (fromFile.endsWith('.jpeg') || fromFile.endsWith('.jpg')) return 'jpg';

    const fromMime = (mimeType || '').toLowerCase();
    if (fromMime.includes('png')) return 'png';
    if (fromMime.includes('webp')) return 'webp';
    if (fromMime.includes('heic')) return 'heic';
    if (fromMime.includes('jpeg') || fromMime.includes('jpg')) return 'jpg';

    return 'jpg';
  };

  const handlePickAvatar = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: false,
        // Keep a higher-resolution source so zoom/crop stays crisp.
        // We cap to 1024px to balance quality and storage/memory.
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 1,
      });

      if (res.didCancel) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) {
        showToast(t(lang, 'photo_read_failed'), 'info');
        return;
      }

      const ext = guessImageExt(asset.fileName, asset.type);
      const destPath = `${RNFS.DocumentDirectoryPath}/profile-avatar-src-${Date.now()}.${ext}`;
      try {
        await RNFS.copyFile(asset.uri, destPath);
      } catch {
        showToast(t(lang, 'photo_use_failed'), 'info');
        return;
      }

      const fileUri = `file://${destPath}`;

      Image.getSize(
        fileUri,
        (width, height) => {
          // Start with a "cover"-style fit so the crop circle is fully filled (no empty edges).
          const baseScale = avatarEditorCircleSize / Math.min(width, height);
          const imgSize = { w: width * baseScale, h: height * baseScale };
          imageSizeRef.current = imgSize;
          setAvatarEditorImageSize(imgSize);
          scaleRef.current = 1;
          avatarScale.setValue(1);
          panRef.current = { x: 0, y: 0 };
          avatarPanX.setValue(0);
          avatarPanY.setValue(0);
          setAvatarEditorUri(fileUri);
          setAvatarEditorVisible(true);
        },
        () => {
          const imgSize = { w: avatarEditorCircleSize, h: avatarEditorCircleSize };
          imageSizeRef.current = imgSize;
          setAvatarEditorImageSize(imgSize);
          scaleRef.current = 1;
          avatarScale.setValue(1);
          panRef.current = { x: 0, y: 0 };
          avatarPanX.setValue(0);
          avatarPanY.setValue(0);
          setAvatarEditorUri(fileUri);
          setAvatarEditorVisible(true);
        }
      );
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : t(lang, 'failed_pick_image');
      showToast(msg, 'info');
    }
  };

  const applyAvatarEdits = async () => {
    if (!avatarEditorUri) {
      setAvatarEditorVisible(false);
      return;
    }

    const next: ProfileAvatar = {
      uri: avatarEditorUri,
      scale: scaleRef.current,
      tx: panRef.current.x,
      ty: panRef.current.y,
      imgW: avatarEditorImageSize.w,
      imgH: avatarEditorImageSize.h,
    };

    setCustomAvatar(next);
    setAvatarEditorVisible(false);
  };

  // Fade avatar changes over 0.2s total.
  React.useEffect(() => {
    const nextLetter = avatarLetter;
    const nextColor = avatarColor;
    const nextAvatar = customAvatar;

    if (nextAvatar) {
      setDisplayAvatar(nextAvatar);
      return;
    }

    if (!didInitAvatarRef.current) {
      didInitAvatarRef.current = true;
      setDisplayAvatarLetter(nextLetter);
      setDisplayAvatarColor(nextColor);
      setDisplayAvatar(nextAvatar);
      return;
    }

    avatarOpacity.stopAnimation();
    Animated.timing(avatarOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setDisplayAvatarLetter(nextLetter);
      setDisplayAvatarColor(nextColor);
      setDisplayAvatar(nextAvatar);
      Animated.timing(avatarOpacity, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    });
  }, [avatarLetter, avatarColor, customAvatar, avatarOpacity]);

  // medical_general_info table
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [sex, setSex] = React.useState('');
  const [organDonor, setOrganDonor] = React.useState(false);
  const [bloodType, setBloodType] = React.useState('');
  const [heightCm, setHeightCm] = React.useState('');
  const [weightKg, setWeightKg] = React.useState('');
  const [allergies, setAllergies] = React.useState<string[]>(['']);
  const [chronicConditions, setChronicConditions] = React.useState<string[]>(['']);
  const [medications, setMedications] = React.useState<string[]>(['']);
  const [familyHistory, setFamilyHistory] = React.useState<string[]>(['']);
  const [emergencyContact, setEmergencyContact] = React.useState('');
  const [insuranceProvider, setInsuranceProvider] = React.useState('');
  const [insuranceNumber, setInsuranceNumber] = React.useState('');

  const sexOptions = React.useMemo(() => ['Male', 'Female'], []);
  const bloodTypeOptions = React.useMemo(
    () => ['A', 'B', 'AB', 'O'],
    []
  );
  const sexDropdownOptions = React.useMemo(
    () =>
      sexOptions.map(opt => ({
        key: opt,
        label: t(lang, opt === 'Male' ? 'sex_male' : 'sex_female'),
      })),
    [lang, sexOptions]
  );
  const bloodTypeDropdownOptions = React.useMemo(
    () => bloodTypeOptions.map(opt => ({ key: opt, label: opt })),
    [bloodTypeOptions]
  );

  type SelectKind = 'sex' | 'bloodType';
  const [openDropdown, setOpenDropdown] = React.useState<
    | {
        kind: SelectKind;
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null
  >(null);

  const sexAnchorRef = React.useRef<View | null>(null);
  const bloodAnchorRef = React.useRef<View | null>(null);

  const [dobModalVisible, setDobModalVisible] = React.useState(false);
  const [dobTempDate, setDobTempDate] = React.useState<Date>(() => new Date());

  const textAreaLineHeight = 20;
  const textAreaPaddingVertical = 10;
  const textAreaMinHeight = textAreaLineHeight * 1 + textAreaPaddingVertical * 2;
  const textAreaMaxHeight = textAreaLineHeight * 4 + textAreaPaddingVertical * 2;
  const [textAreaHeights, setTextAreaHeights] = React.useState<Record<string, number>>({
    emergencyContact: textAreaMinHeight,
    insuranceProvider: textAreaMinHeight,
    insuranceNumber: textAreaMinHeight,
  });

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const openAnchoredDropdown = React.useCallback((kind: SelectKind, anchorRef: React.RefObject<View | null>) => {
    const anchor = anchorRef.current;
    if (!anchor) {
      setOpenDropdown({ kind, x: 16, y: 120, width: 240, height: 52 });
      return;
    }

    anchor.measureInWindow((x, y, width, height) => {
      setOpenDropdown({ kind, x, y, width, height });
    });
  }, []);

  const updateTextAreaHeight = (key: keyof typeof textAreaHeights, contentHeight: number) => {
    const next = clamp(contentHeight, textAreaMinHeight, textAreaMaxHeight);
    setTextAreaHeights((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  };

  const formatDateToYMD = (d: Date) => {
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseYMDToDate = (value: string) => {
    const m = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    if (!m) return new Date();
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const openDobPicker = () => {
    const current = parseYMDToDate(dateOfBirth);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        is24Hour: true,
        onChange: (_event, selectedDate) => {
          if (selectedDate) setDateOfBirth(formatDateToYMD(selectedDate));
        },
      });
      return;
    }

    setDobTempDate(current);
    setDobModalVisible(true);
  };

  const handleNumericChange = (field: 'heightCm' | 'weightKg', next: string) => {
    if (/^\d*$/.test(next)) {
      if (field === 'heightCm') setHeightCm(next);
      else setWeightKg(next);
      setFieldErrors((prev) => ({ ...prev, [field]: false }));
      if (tooltip?.target === field) setTooltip(null);
      return;
    }

    setFieldErrors((prev) => ({ ...prev, [field]: true }));
    setTooltip({ target: field, message: t(lang, 'numbers_only'), variant: 'error' });
  };

  const SelectField = ({
    label,
    value,
    placeholder,
    onPress,
    anchorRef,
    open,
    icon,
  }: {
    label: string;
    value: string;
    placeholder: string;
    onPress: () => void;
    anchorRef: React.RefObject<View | null>;
    open: boolean;
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }) => {
    return (
      <View style={styles.inlineDropdownWrap}>
        <Text style={styles.dropdownLabel}>{label}</Text>
        <View ref={anchorRef} collapsable={false}>
          <TouchableOpacity
            style={[styles.selectContainer, { marginBottom: 0 }, open ? styles.selectContainerOpen : null]}
            onPress={onPress}
            activeOpacity={0.85}
          >
            <Ionicons name={icon} size={18} color={open ? '#064b75' : '#6b7280'} />
            <Text style={[styles.selectText, !value ? styles.selectPlaceholder : null]}>{value || placeholder}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? '#064b75' : '#6b7280'} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 12 }} />
      </View>
    );
  };

  const submit = async () => {
    const label = profileLabel.trim();
    if (!label) {
      setFieldErrors((prev) => ({ ...prev, profileLabel: true }));
      setTooltip({ target: 'profileLabel', message: t(lang, 'please_enter_profile_name') });
      return;
    }

    setSaving(true);
    setTooltip(null);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error(t(lang, 'missing_auth_token'));

      const allowHealthProfileStorage = profileConsents?.consent_granted !== false;

      // Update profile label if changed
      if (label !== profile.profile_label || accessPassword.trim()) {
        const payload: { profile_label?: string; access_password?: string } = {};
        if (label !== profile.profile_label) {
          payload.profile_label = label;
        }
        if (accessPassword.trim()) {
          payload.access_password = accessPassword;
        }
        const updatedProfile = await updateProfile(token, profile.id, payload);
        await addOrUpdateCachedProfile({ ...updatedProfile, local_only: false } as any);
      }

      // Update medical data only when Consent 1 is enabled.
      // When consent is off, the fields are locked and backend will reject writes (403).
      if (allowHealthProfileStorage) {
        const medicalPayload: MedicalGeneralInfoPayload = {
          date_of_birth: dateOfBirth.trim() || null,
          sex: sex.trim() || null,
          organ_donor: organDonor,
          blood_type: bloodType.trim() || null,
          height_cm: heightCm.trim() || null,
          weight_kg: weightKg.trim() || null,
          allergies: serializeJsonbTopicList(allergies),
          chronic_conditions: serializeJsonbTopicList(chronicConditions),
          medications: serializeJsonbTopicList(medications),
          family_history: serializeJsonbTopicList(familyHistory),
          emergency_contact: emergencyContact.trim() || null,
          insurance_provider: insuranceProvider.trim() || null,
          insurance_number: insuranceNumber.trim() || null,
        };
        // Entering and saving health data implies consent to store it. The
        // backend requires an explicit consent_granted flag, and the only place
        // it was previously set was profile creation — so record it here too.
        try {
          await upsertProfileConsents(token, profile.id, { consent_granted: true, source: 'App' });
        } catch {
          // consent upsert is best-effort; the medical write below will surface real errors
        }
        await upsertMedicalGeneral(token, profile.id, medicalPayload);
      }

      // Save avatar if changed
      if (customAvatar) {
        try {
          await setProfileAvatar(profile.id, customAvatar);
        } catch {
          // ignore
        }
      }

      showToast(t(lang, 'profile_updated'), 'success');
      onComplete();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : t(lang, 'failed_update_profile');
      setTooltip({ target: 'submit', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (deletingProfile) return;

    setDeletingProfile(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error(t(lang, 'missing_auth_token'));

      await deleteProfile(token, profile.id);

      try { await setProfileAvatar(profile.id, null); } catch {}
      try { await deleteAlertsByProfileAndPeriod(profile.id, { fromTs: null, toTs: null }); } catch {}
      try { await clearCachedReminders(profile.id); } catch {}
      try { await clearCachedGoals(profile.id); } catch {}
      try { await purgeOutboxForDeletedProfile(profile.id); } catch {}

      // Refresh profile cache from server, fallback to local remove.
      let refreshed = false;
      try {
        const profiles = await getMyProfiles(token);
        await setCachedProfiles((profiles || []) as any);
        refreshed = true;

        const activeRaw = await AsyncStorage.getItem('activeProfileId');
        const activeId = activeRaw ? Number(activeRaw) : null;
        if (Number(activeId) === Number(profile.id)) {
          const nextId = profiles.length > 0 ? Number(profiles[0].id) : null;
          await setActiveProfileId(Number.isFinite(nextId as any) ? (nextId as number) : null);
        }
      } catch {
        // ignore and fallback below
      }

      if (!refreshed) {
        const next = await removeCachedProfile(profile.id);
        const activeRaw = await AsyncStorage.getItem('activeProfileId');
        const activeId = activeRaw ? Number(activeRaw) : null;
        if (Number(activeId) === Number(profile.id)) {
          const nextId = next.length > 0 ? Number(next[0].id) : null;
          await setActiveProfileId(Number.isFinite(nextId as any) ? (nextId as number) : null);
        }
      }

      emitProfilesUpdated();

      showToast(t(lang, 'profile_deleted'), 'success');
      setDeleteProfileDialogVisible(false);
      onComplete();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : t(lang, 'failed_delete_profile');
      showToast(msg, 'error');
    } finally {
      setDeletingProfile(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#064b75" />
          <Text style={{ marginTop: 12, color: '#6b7280' }}>{t(lang, 'loading_profile_data')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <InfoDialog
        visible={medicalLockedDialogVisible}
        title={t(lang, 'consent_required')}
        message={t(lang, 'consent_required_health_msg')}
        onClose={() => setMedicalLockedDialogVisible(false)}
      />

      <LogoutDialog
        visible={deleteProfileDialogVisible}
        title={t(lang, 'delete_profile_btn')}
        message={t(lang, 'delete_profile_dialog_msg')}
        cancelText={t(lang, 'cancel')}
        confirmText={deletingProfile ? t(lang, 'deleting') : t(lang, 'delete_profile_btn')}
        onRequestClose={() => {
          if (deletingProfile) return;
          setDeleteProfileDialogVisible(false);
        }}
        onConfirm={handleDeleteProfile}
      />

      {/* Avatar Editor Modal */}
      <Modal visible={avatarEditorVisible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setAvatarEditorVisible(false)}>
        <View style={styles.avatarEditorBackdrop}>
          <View style={styles.avatarEditorCard}>
            <Text style={styles.avatarEditorTitle}>{t(lang, 'adjust_photo')}</Text>
            <Text style={styles.avatarEditorSub}>{t(lang, 'drag_pinch_hint')}</Text>

            <View style={styles.avatarEditorPreviewWrap}>
              <View
                style={styles.avatarEditorCircle}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {avatarEditorUri ? (
                  <View pointerEvents="none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                  >
                    <Animated.View
                      style={{
                        transform: [{ translateX: avatarPanX }, { translateY: avatarPanY }],
                      }}
                    >
                      <Animated.View
                        style={{
                          transform: [{ scale: avatarScale }],
                        }}
                      >
                        <Image
                          source={{ uri: avatarEditorUri }}
                          style={{
                            width: avatarEditorImageSize.w,
                            height: avatarEditorImageSize.h,
                          }}
                          resizeMode="contain"
                          resizeMethod="resize"
                        />
                      </Animated.View>
                    </Animated.View>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.avatarEditorButtonsRow}>
              <Pressable style={[styles.avatarEditorBtn, styles.avatarEditorBtnSecondary]} onPress={() => setAvatarEditorVisible(false)}>
                <Text style={styles.avatarEditorBtnSecondaryText}>{t(lang, 'cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.avatarEditorBtn, styles.avatarEditorBtnPrimary]} onPress={applyAvatarEdits}>
                <Text style={styles.avatarEditorBtnPrimaryText}>{t(lang, 'use_photo')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={() => setOpenDropdown(null)}
      >
        {/* Hero Header */}
        <View style={styles.heroWrap}>
          <View style={styles.heroClip}>
            <LinearGradient colors={['#064b75', '#0b6aa0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBg} />
            <View style={[styles.heroContent, { paddingTop: 18 + insets.top }]}>
              <Pressable onPress={handlePickAvatar} hitSlop={10} style={styles.heroAvatarWrap}>
                <View style={[styles.heroAvatarClip, displayAvatar ? null : displayAvatarLetter ? { backgroundColor: displayAvatarColor } : null]}>
                  <Animated.View style={{ opacity: avatarOpacity }}>
                    {displayAvatar ? (
                      <CroppedAvatarImage avatar={displayAvatar} size={88} />
                    ) : displayAvatarLetter ? (
                      <Text style={styles.heroAvatarLetter}>{displayAvatarLetter}</Text>
                    ) : (
                      <Image source={require('../../../../assets/android-res/drawable/profile.png')} style={styles.heroAvatarIcon} resizeMode="contain" />
                    )}
                  </Animated.View>
                </View>

                <View style={styles.heroEditBadge} pointerEvents="none">
                  <Ionicons name="pencil" size={14} color="#111827" />
                </View>
              </Pressable>

              <Text style={styles.heroTitle}>{t(lang, 'edit_profile_title')}</Text>
              <Text style={styles.heroSubtitle}>{t(lang, 'update_profile_subtitle')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {tooltip?.target === 'submit' ? <Text style={styles.error}>{tooltip.message}</Text> : null}

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person-circle-outline" size={18} color="#064b75" />
              <Text style={styles.sectionTitle}>{t(lang, 'profile_information')}</Text>
            </View>

            <Text style={styles.dropdownLabel}>{t(lang, 'profile_name_label')}</Text>
            <View style={styles.inlineFieldRow}>
              <TextInput
                value={profileLabel}
                onChangeText={(v) => {
                  setProfileLabel(v);
                  setFieldErrors((prev) => ({ ...prev, profileLabel: false }));
                  if (tooltip?.target === 'profileLabel') setTooltip(null);
                }}
                placeholder={t(lang, 'profile_name_placeholder')}
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                style={[styles.input, fieldErrors.profileLabel ? styles.inputError : null]}
              />
              {tooltip?.target === 'profileLabel' ? <TooltipError message={tooltip.message} variant={tooltip.variant} onClose={() => setTooltip(null)} /> : null}
            </View>

            <Text style={styles.dropdownLabel}>{t(lang, 'profile_password_label')}</Text>
            <View style={{ width: '100%', position: 'relative', marginBottom: 12 }}>
              <TextInput
                value={accessPassword}
                onChangeText={setAccessPassword}
                placeholder={t(lang, 'profile_password_placeholder')}
                secureTextEntry={!showAccessPassword}
                autoCapitalize="none"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                style={[styles.input, { paddingRight: 46, marginBottom: 0 }]}
              />
              <TouchableOpacity
                style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 3, alignItems: 'center' }}
                onPress={() => setShowAccessPassword((s) => !s)}
                accessibilityRole="button"
                accessibilityLabel={showAccessPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showAccessPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, medicalInfoLocked ? styles.cardDisabled : null]}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="heart-outline" size={18} color="#064b75" />
              <Text style={styles.sectionTitle}>{t(lang, 'health_profile_information')}</Text>
            </View>

            <View style={styles.inlineDropdownWrap}>
              <Text style={styles.dropdownLabel}>{t(lang, 'date_of_birth')}</Text>
              <TouchableOpacity 
                style={[styles.selectContainer, medicalInfoLocked ? { opacity: 0.5 } : null]} 
                onPress={medicalInfoLocked ? () => setMedicalLockedDialogVisible(true) : openDobPicker} 
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                <Text style={[styles.selectText, !dateOfBirth ? styles.selectPlaceholder : null]}>
                  {dateOfBirth || t(lang, 'select_date')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <SelectField
              label={t(lang, 'biological_sex')}
              value={sex ? t(lang, sex === 'Male' ? 'sex_male' : 'sex_female') : ''}
              placeholder={t(lang, 'select_sex')}
              anchorRef={sexAnchorRef}
              open={openDropdown?.kind === 'sex'}
              icon="person-outline"
              onPress={() => {
                if (medicalInfoLocked) {
                  setMedicalLockedDialogVisible(true);
                  return;
                }
                if (openDropdown?.kind === 'sex') setOpenDropdown(null);
                else openAnchoredDropdown('sex', sexAnchorRef);
              }}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t(lang, 'organ_donor_label')}</Text>
              <Switch
                value={organDonor}
                onValueChange={(v) => {
                  if (medicalInfoLocked) {
                    setMedicalLockedDialogVisible(true);
                    return;
                  }
                  setOrganDonor(v);
                }}
                trackColor={{ false: '#e5e7eb', true: '#bae6fd' }}
                thumbColor={organDonor ? '#064b75' : '#9ca3af'}
              />
            </View>

            <SelectField
              label={t(lang, 'blood_type_label')}
              value={bloodType}
              placeholder={t(lang, 'select_blood_type')}
              anchorRef={bloodAnchorRef}
              open={openDropdown?.kind === 'bloodType'}
              icon="water-outline"
              onPress={() => {
                if (medicalInfoLocked) {
                  setMedicalLockedDialogVisible(true);
                  return;
                }
                if (openDropdown?.kind === 'bloodType') setOpenDropdown(null);
                else openAnchoredDropdown('bloodType', bloodAnchorRef);
              }}
            />

            <Text style={styles.dropdownLabel}>{t(lang, 'height_cm_label')}</Text>
            <TextInput
              value={heightCm}
              onChangeText={(v) => handleNumericChange('heightCm', v)}
              placeholder={t(lang, 'height_placeholder')}
              keyboardType="number-pad"
              multiline={false}
              numberOfLines={1}
              scrollEnabled={false}
              selectTextOnFocus={false}
              contextMenuHidden={true}
              disableFullscreenUI={true}
              textAlignVertical="center"
              editable={!medicalInfoLocked}
              style={[styles.input, fieldErrors.heightCm ? styles.inputError : null, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <Text style={styles.dropdownLabel}>{t(lang, 'weight_kg_label')}</Text>
            <TextInput
              value={weightKg}
              onChangeText={(v) => handleNumericChange('weightKg', v)}
              placeholder={t(lang, 'weight_placeholder')}
              keyboardType="number-pad"
              multiline={false}
              numberOfLines={1}
              scrollEnabled={false}
              selectTextOnFocus={false}
              contextMenuHidden={true}
              disableFullscreenUI={true}
              textAlignVertical="center"
              editable={!medicalInfoLocked}
              style={[styles.input, fieldErrors.weightKg ? styles.inputError : null, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <DynamicTextFieldList
              label={t(lang, 'allergies_label')}
              placeholder={t(lang, 'allergies_placeholder')}
              values={allergies}
              onChangeValues={setAllergies}
              editable={!medicalInfoLocked}
              labelStyle={styles.dropdownLabel}
              inputStyle={[styles.input, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <DynamicTextFieldList
              label={t(lang, 'chronic_conditions_label')}
              placeholder={t(lang, 'chronic_placeholder')}
              values={chronicConditions}
              onChangeValues={setChronicConditions}
              editable={!medicalInfoLocked}
              labelStyle={styles.dropdownLabel}
              inputStyle={[styles.input, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <DynamicTextFieldList
              label={t(lang, 'medications_label')}
              placeholder={t(lang, 'medications_placeholder')}
              values={medications}
              onChangeValues={setMedications}
              editable={!medicalInfoLocked}
              labelStyle={styles.dropdownLabel}
              inputStyle={[styles.input, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <DynamicTextFieldList
              label={t(lang, 'family_history_label')}
              placeholder={t(lang, 'family_history_placeholder')}
              values={familyHistory}
              onChangeValues={setFamilyHistory}
              editable={!medicalInfoLocked}
              labelStyle={styles.dropdownLabel}
              inputStyle={[styles.input, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <Text style={styles.dropdownLabel}>{t(lang, 'emergency_contact_label')}</Text>
            <TextInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder={t(lang, 'emergency_contact_placeholder')}
              multiline
              textAlignVertical="top"
              editable={!medicalInfoLocked}
              onContentSizeChange={(e) => updateTextAreaHeight('emergencyContact', e.nativeEvent.contentSize.height)}
              style={[styles.textArea, { height: textAreaHeights.emergencyContact }, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <Text style={styles.dropdownLabel}>{t(lang, 'insurance_provider_label')}</Text>
            <TextInput
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder={t(lang, 'insurance_provider_placeholder')}
              multiline
              textAlignVertical="top"
              editable={!medicalInfoLocked}
              onContentSizeChange={(e) => updateTextAreaHeight('insuranceProvider', e.nativeEvent.contentSize.height)}
              style={[styles.textArea, { height: textAreaHeights.insuranceProvider }, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            <Text style={styles.dropdownLabel}>{t(lang, 'insurance_number_label')}</Text>
            <TextInput
              value={insuranceNumber}
              onChangeText={setInsuranceNumber}
              placeholder={t(lang, 'insurance_number_placeholder')}
              multiline
              textAlignVertical="top"
              editable={!medicalInfoLocked}
              onContentSizeChange={(e) => updateTextAreaHeight('insuranceNumber', e.nativeEvent.contentSize.height)}
              style={[styles.textArea, { height: textAreaHeights.insuranceNumber }, medicalInfoLocked ? { opacity: 0.5 } : null]}
            />

            {medicalInfoLocked ? (
              <Pressable
                style={styles.lockOverlay}
                onPress={() => setMedicalLockedDialogVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Medical General Info is locked"
              >
                <Image source={require('../../../../assets/android-res/drawable/lock.png')} style={styles.lockIcon} resizeMode="contain" />
              </Pressable>
            ) : null}
          </View>

          <Button
            label={t(lang, 'save_changes')}
            loading={saving}
            style={styles.button}
            onPress={submit}
          />

          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t(lang, 'back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backButton, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}
            onPress={() => setDeleteProfileDialogVisible(true)}
            disabled={deletingProfile}
          >
            <Text style={[styles.backButtonText, { color: '#dc2626' }]}>{deletingProfile ? t(lang, 'deleting_profile') : t(lang, 'delete_profile_btn')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {Platform.OS === 'ios' ? (
        <Modal visible={dobModalVisible} transparent animationType="fade" onRequestClose={() => setDobModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t(lang, 'select_dob_title')}</Text>

              <View style={{ overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff' }}>
                <DateTimePicker value={dobTempDate} mode="date" display="inline" onChange={(_e, d) => d && setDobTempDate(d)} />
              </View>

              <View style={styles.modalRow}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={() => setDobModalVisible(false)}>
                  <Text style={[styles.modalBtnText, styles.modalBtnTextSecondary]}>{t(lang, 'cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => {
                    setDateOfBirth(formatDateToYMD(dobTempDate));
                    setDobModalVisible(false);
                  }}
                >
                  <Text style={styles.modalBtnText}>{t(lang, 'done')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <AnchoredDropdown
        visible={!!openDropdown}
        anchor={openDropdown ?? { x: 0, y: 0, width: 0, height: 0 }}
        options={
          openDropdown?.kind === 'sex'
            ? sexDropdownOptions
            : bloodTypeDropdownOptions
        }
        selectedKey={openDropdown?.kind === 'sex' ? sex : bloodType}
        unselectLabel={t(lang, 'unselect')}
        anchorMask={{
          iconName:
            openDropdown?.kind === 'sex' ? 'person-outline' : 'water-outline',
          text:
            (openDropdown?.kind === 'sex'
              ? sex
                ? t(lang, sex === 'Male' ? 'sex_male' : 'sex_female')
                : ''
              : bloodType) ||
            (openDropdown?.kind === 'sex'
              ? t(lang, 'select_sex')
              : t(lang, 'select_blood_type')),
          placeholder: !(openDropdown?.kind === 'sex' ? sex : bloodType),
        }}
        onClose={() => setOpenDropdown(null)}
        onSelect={key => {
          if (openDropdown?.kind === 'sex') setSex(key);
          if (openDropdown?.kind === 'bloodType') setBloodType(key);
          setOpenDropdown(null);
        }}
      />
    </SafeAreaView>
  );
}
