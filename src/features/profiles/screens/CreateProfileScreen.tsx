import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  ScrollView,
  Switch,
  Platform,
  Modal,
  Image,
  StatusBar,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emitProfilesUpdated,
  setActiveProfileId as setActiveProfileIdGlobal,
} from '../lib/profileEvents';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import {
  createProfile,
  createProfileWithMedical,
  upsertMedicalGeneral,
  upsertProfileConsents,
  type ProfileConsentsPayload,
} from '../api/profileApi';
import TooltipError from '../../../shared/components/TooltipError';
import InfoDialog from '../../../shared/components/InfoDialog';
import Button from '../../../shared/components/Button';
import InputField from '../../../shared/components/InputField';
import DynamicTextFieldList from '../../../shared/components/DynamicTextFieldList';
import {
  addOrUpdateCachedProfile,
  hasDuplicateProfileLabel,
} from '../storage/profileCache';
import {
  cacheLocalProfileStub,
  enqueueCreateProfileWithMedical,
} from '../../../shared/sync/syncOutbox';
import { showToast } from '../../../shared/ui/toast';
import { clearUserSession } from '../../auth/services/session';
import {
  getDraftProfileAvatar,
  setDraftProfileAvatar,
  setProfileAvatar,
  type ProfileAvatar,
} from '../lib/profileAvatar';
import styles from './CreateProfileScreen.styles';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getInitialsFromName,
  getAvatarColorForProfile,
  saveAvatarColor,
} from '../lib/avatarColors';
import CroppedAvatarImage from '../../../shared/components/CroppedAvatarImage';
import InlineDropdown from '../../../shared/components/InlineDropdown';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors } from '../../../shared/theme/theme';
import { serializeJsonbTopicList } from '../lib/jsonbTopicList';

const KEY_PENDING_PROFILE_CONSENTS = 'pendingProfileConsents.v1';

type Props = {
  onComplete: (createdProfileId: number) => void;
  onLogout?: () => void;
};

export default function CreateProfileScreen({ onComplete, onLogout }: Props) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const rootRef = React.useRef<View | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pendingConsents, setPendingConsents] =
    React.useState<ProfileConsentsPayload | null>(null);
  const [medicalLockedDialogVisible, setMedicalLockedDialogVisible] =
    React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState({
    profileLabel: false,
    heightCm: false,
    weightKg: false,
  });
  const [tooltip, setTooltip] = React.useState<{
    target: 'profileLabel' | 'heightCm' | 'weightKg' | 'submit';
    message: string;
    variant?: 'error' | 'info';
  } | null>(null);
  const [profileLabelY, setProfileLabelY] = React.useState<number>(0);

  // profiles table
  const [profileLabel, setProfileLabel] = React.useState('');
  const [accessPassword, setAccessPassword] = React.useState('');
  const [showAccessPassword, setShowAccessPassword] = React.useState(false);

  const [customAvatar, setCustomAvatar] = React.useState<ProfileAvatar | null>(
    null,
  );
  const avatarOpacity = React.useRef(new Animated.Value(1)).current;
  const didInitAvatarRef = React.useRef(false);

  const [displayAvatarLetter, setDisplayAvatarLetter] = React.useState<
    string | null
  >(null);
  const [displayAvatarColor, setDisplayAvatarColor] = React.useState<string>(
    Colors.gray100,
  );
  const [displayAvatar, setDisplayAvatar] =
    React.useState<ProfileAvatar | null>(null);
  const [fixedAvatarColor, setFixedAvatarColor] = React.useState<string | null>(
    null,
  );

  const [avatarEditorVisible, setAvatarEditorVisible] = React.useState(false);
  const [avatarEditorUri, setAvatarEditorUri] = React.useState<string | null>(
    null,
  );
  const [avatarEditorImageSize, setAvatarEditorImageSize] = React.useState({
    w: 1,
    h: 1,
  });
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
  const touchStartRef = React.useRef<{
    startPageX: number;
    startPageY: number;
    panX: number;
    panY: number;
  } | null>(null);
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
      // Pinch gesture. Use stable touch identifiers to avoid jumps when touches reorder.
      if (!pinchTouchIdsRef.current) {
        pinchTouchIdsRef.current = [
          touches[0].identifier,
          touches[1].identifier,
        ];
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
      const nextScale = Math.max(
        1,
        Math.min(4, pinchStartScaleRef.current * ratio),
      );
      scaleRef.current = nextScale;
      avatarScale.setValue(nextScale);

      // When scale changes, clamp the current pan so the image can't drift out of the crop.
      const clamped = clampPan(panRef.current.x, panRef.current.y, nextScale);
      panRef.current = clamped;
      avatarPanX.setValue(clamped.x);
      avatarPanY.setValue(clamped.y);
      return;
    }

    if (touches.length === 1 && touchStartRef.current) {
      // Pan gesture
      pinchTouchIdsRef.current = null;
      const id = panTouchIdRef.current;
      const t =
        (id != null
          ? touches.find((touch: any) => touch.identifier === id)
          : null) ?? touches[0];
      if (!t) return;

      const dx = t.pageX - touchStartRef.current.startPageX;
      const dy = t.pageY - touchStartRef.current.startPageY;
      const next = clampPan(
        touchStartRef.current.panX + dx,
        touchStartRef.current.panY + dy,
        scaleRef.current,
      );

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
    const name = profileLabel.trim();
    // Return null if name is empty so profile.png icon is shown instead of "NA"
    if (!name) return null;
    return getInitialsFromName(profileLabel);
  }, [profileLabel]);

  const avatarColor = React.useMemo(() => {
    const name = profileLabel.trim();
    if (!name) return Colors.gray100;
    return fixedAvatarColor || Colors.gray100;
  }, [profileLabel, fixedAvatarColor]);

  React.useEffect(() => {
    let mounted = true;
    getDraftProfileAvatar()
      .then(draft => {
        if (!mounted) return;
        setCustomAvatar(draft);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

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
      const destPath = `${
        RNFS.DocumentDirectoryPath
      }/profile-avatar-src-${Date.now()}.${ext}`;
      try {
        await RNFS.copyFile(asset.uri, destPath);
      } catch {
        showToast(t(lang, 'photo_use_failed'), 'info');
        return;
      }

      const fileUri = `file://${destPath}`;

      // Get image dimensions and compute base scale to fit entire image in circle
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
          // Fallback if getSize fails
          const imgSize = {
            w: avatarEditorCircleSize,
            h: avatarEditorCircleSize,
          };
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
    try {
      await setDraftProfileAvatar(next);
    } catch {
      // ignore
    }

    setAvatarEditorVisible(false);
  };

  // Fade avatar changes over 0.2s total.
  React.useEffect(() => {
    const nextLetter = avatarLetter;
    const nextColor = avatarColor;
    const nextAvatar = customAvatar;

    // If the user has selected an image avatar, do not animate/fade the avatar when
    // the name (initials) changes. This avoids flicker while typing.
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
    Animated.timing(avatarOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayAvatarLetter(nextLetter);
      setDisplayAvatarColor(nextColor);
      setDisplayAvatar(nextAvatar);
      Animated.timing(avatarOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [avatarLetter, avatarColor, customAvatar, avatarOpacity]);

  // medical_general_info table
  const [dateOfBirth, setDateOfBirth] = React.useState(''); // YYYY-MM-DD
  const [sex, setSex] = React.useState(''); // Male/Female
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
    [],
  );
  const sexDropdownOptions = React.useMemo(
    () =>
      sexOptions.map(opt => ({
        key: opt,
        label: t(lang, opt === 'Male' ? 'sex_male' : 'sex_female'),
      })),
    [lang, sexOptions],
  );
  const bloodTypeDropdownOptions = React.useMemo(
    () => bloodTypeOptions.map(opt => ({ key: opt, label: opt })),
    [bloodTypeOptions],
  );

  type SelectKind = 'sex' | 'bloodType';
  const [openDropdown, setOpenDropdown] = React.useState<{
    kind: SelectKind;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const sexAnchorRef = React.useRef<View | null>(null);
  const bloodAnchorRef = React.useRef<View | null>(null);

  const [dobModalVisible, setDobModalVisible] = React.useState(false);
  const [dobTempDate, setDobTempDate] = React.useState<Date>(() => new Date());

  const textAreaLineHeight = 20;
  const textAreaPaddingVertical = 10;
  const textAreaMinHeight =
    textAreaLineHeight * 1 + textAreaPaddingVertical * 2;
  const textAreaMaxHeight =
    textAreaLineHeight * 4 + textAreaPaddingVertical * 2;
  const [textAreaHeights, setTextAreaHeights] = React.useState<
    Record<string, number>
  >({
    emergencyContact: textAreaMinHeight,
    insuranceProvider: textAreaMinHeight,
    insuranceNumber: textAreaMinHeight,
  });

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const openAnchoredDropdown = React.useCallback(
    (kind: SelectKind, anchorRef: React.RefObject<View | null>) => {
      const anchor = anchorRef.current;
      const root = rootRef.current;

      if (!anchor || !root) {
        setOpenDropdown({ kind, x: 16, y: 120, width: 240, height: 52 });
        return;
      }

      root.measureInWindow((rootX, rootY) => {
        anchor.measureInWindow((x, y, width, height) => {
          setOpenDropdown({
            kind,
            x: x - rootX,
            y: y - rootY,
            width,
            height,
          });
        });
      });
    },
    [],
  );

  const updateTextAreaHeight = (
    key: keyof typeof textAreaHeights,
    contentHeight: number,
  ) => {
    const next = clamp(contentHeight, textAreaMinHeight, textAreaMaxHeight);
    setTextAreaHeights(prev =>
      prev[key] === next ? prev : { ...prev, [key]: next },
    );
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

  const handleNumericChange = (
    field: 'heightCm' | 'weightKg',
    next: string,
  ) => {
    if (/^\d*$/.test(next)) {
      if (field === 'heightCm') setHeightCm(next);
      else setWeightKg(next);
      setFieldErrors(prev => ({ ...prev, [field]: false }));
      if (tooltip?.target === field) setTooltip(null);
      return;
    }

    setFieldErrors(prev => ({ ...prev, [field]: true }));
    setTooltip({ target: field, message: 'Numbers only', variant: 'error' });
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
            style={[
              styles.selectContainer,
              { marginBottom: 0 },
              open ? styles.selectContainerOpen : null,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
          >
            <Ionicons
              name={icon}
              size={18}
              color={open ? Colors.primary : Colors.textSubtle}
            />
            <Text
              style={[
                styles.selectText,
                !value ? styles.selectPlaceholder : null,
              ]}
            >
              {value || placeholder}
            </Text>
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={open ? Colors.primary : Colors.textSubtle}
            />
          </TouchableOpacity>
        </View>
        {/* Keep spacing outside the measured anchor so the dropdown positions flush to the field */}
        <View style={{ height: 12 }} />
      </View>
    );
  };

  const readPendingProfileConsents =
    async (): Promise<ProfileConsentsPayload | null> => {
      const raw = await AsyncStorage.getItem(KEY_PENDING_PROFILE_CONSENTS);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const consentGranted =
          parsed?.consentGranted ?? parsed?.consent_granted;
        if (typeof consentGranted === 'boolean') {
          return {
            consent_granted: consentGranted === true,
            source: 'App',
          };
        }
      } catch {
        return null;
      }

      return null;
    };

  React.useEffect(() => {
    readPendingProfileConsents()
      .then(v => setPendingConsents(v))
      .catch(() => setPendingConsents(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const medicalInfoLocked = pendingConsents?.consent_granted === false;

  const clearPendingProfileConsents = async () => {
    await AsyncStorage.removeItem(KEY_PENDING_PROFILE_CONSENTS);
  };

  const submit = async () => {
    const label = profileLabel.trim();
    if (!label) {
      setFieldErrors(prev => ({ ...prev, profileLabel: true }));
      setTooltip({
        target: 'profileLabel',
        message: t(lang, 'please_enter_profile_name'),
      });
      return;
    }

    if (await hasDuplicateProfileLabel(label)) {
      setFieldErrors(prev => ({ ...prev, profileLabel: true }));
      setTooltip({
        target: 'profileLabel',
        message: t(lang, 'duplicate_profile_name'),
      });
      return;
    }

    setSaving(true);
    setTooltip(null);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error(t(lang, 'missing_auth_token'));

      const pendingConsents = await readPendingProfileConsents();

      const allowHealthProfileStorage =
        pendingConsents?.consent_granted !== false;

      const medicalPayload = {
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

      // Prefer atomic endpoint so that if medical save fails, the profile row is not left behind.
      try {
        const createPayload: {
          profile_label: string;
          access_password?: string;
          medical_general_info?: any;
          profile_consents?: ProfileConsentsPayload;
        } = {
          profile_label: label,
        };

        if (allowHealthProfileStorage) {
          createPayload.medical_general_info = medicalPayload;
        }
        if (accessPassword.trim())
          createPayload.access_password = accessPassword;
        if (pendingConsents) createPayload.profile_consents = pendingConsents;

        const result = await createProfileWithMedical(token, createPayload);

        // If server didn't persist via /with-medical (older backend), try the dedicated endpoint.
        if (pendingConsents && !result?.consents) {
          try {
            await upsertProfileConsents(
              token,
              result.profile.id,
              pendingConsents,
            );
          } catch {
            // ignore; user can retry later.
          }
        }

        if (pendingConsents) {
          // Only clear once we've at least attempted to send.
          await clearPendingProfileConsents();
        }

        await addOrUpdateCachedProfile({
          ...result.profile,
          local_only: false,
        } as any);
        await setActiveProfileIdGlobal(result.profile.id);
        emitProfilesUpdated();

        if (customAvatar) {
          try {
            await setProfileAvatar(result.profile.id, customAvatar);
            await setDraftProfileAvatar(null);
          } catch {
            // ignore
          }
        }

        // Save avatar color for consistent rendering
        await saveAvatarColor(result.profile.id, avatarColor);

        onComplete(result.profile.id);
        return;
      } catch (err: any) {
        // Backwards-compatible fallback if the server doesn't have /profiles/with-medical yet.
        const msg = err?.message ? String(err.message) : '';
        const is404 =
          msg.toLowerCase().includes('status 404') ||
          msg.toLowerCase().includes(' 404');
        if (!is404) throw err;
      }

      const createPayload: { profile_label: string; access_password?: string } =
        { profile_label: label };
      if (accessPassword.trim()) createPayload.access_password = accessPassword;
      const prof = await createProfile(token, createPayload);

      if (allowHealthProfileStorage) {
        await upsertMedicalGeneral(token, prof.id, medicalPayload);
      }

      if (pendingConsents) {
        try {
          await upsertProfileConsents(token, prof.id, pendingConsents);
          await clearPendingProfileConsents();
        } catch {
          // ignore
        }
      }

      await addOrUpdateCachedProfile({ ...prof, local_only: false } as any);
      await setActiveProfileIdGlobal(prof.id);
      emitProfilesUpdated();

      if (customAvatar) {
        try {
          await setProfileAvatar(prof.id, customAvatar);
          await setDraftProfileAvatar(null);
        } catch {
          // ignore
        }
      }

      // Save avatar color for consistent rendering
      await saveAvatarColor(prof.id, avatarColor);

      onComplete(prof.id);
    } catch (e: any) {
      const msg = e?.message
        ? String(e.message)
        : t(lang, 'failed_create_profile');

      const lower = msg.toLowerCase();
      const isNetworkish =
        lower.includes('network request failed') ||
        lower.includes('failed to fetch') ||
        lower.includes('aborted') ||
        lower.includes('timeout');

      // If offline / network issue: save locally and queue for sync.
      if (isNetworkish) {
        const localId = -Math.floor(Date.now());
        const createOp: {
          profile_label: string;
          access_password?: string;
          medical_general_info?: any;
          profile_consents?: ProfileConsentsPayload;
        } = {
          profile_label: label,
        };
        if (accessPassword.trim()) createOp.access_password = accessPassword;
        const pendingConsents = await readPendingProfileConsents();
        if (pendingConsents) createOp.profile_consents = pendingConsents;

        if (pendingConsents?.consent_granted !== false) {
          createOp.medical_general_info = {
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
        }

        await cacheLocalProfileStub({ id: localId, profile_label: label });
        await enqueueCreateProfileWithMedical({
          localProfileId: localId,
          ...createOp,
        });
        await setActiveProfileIdGlobal(localId);
        emitProfilesUpdated();

        if (pendingConsents) {
          // Consent is now stored in the outbox op; safe to clear the pending cache.
          await clearPendingProfileConsents();
        }

        await AsyncStorage.setItem('activeProfileId', String(localId));

        if (customAvatar) {
          try {
            await setProfileAvatar(localId, customAvatar);
            await setDraftProfileAvatar(null);
          } catch {
            // ignore
          }
        }

        // Save avatar color for consistent rendering
        await saveAvatarColor(localId, avatarColor);

        showToast(t(lang, 'saved_offline'), 'info');
        onComplete(localId);
        return;
      }

      if (lower.includes('already exists') || lower.includes('duplicate')) {
        setTooltip({
          target: 'profileLabel',
          message: t(lang, 'duplicate_profile_name'),
        });
        setFieldErrors(prev => ({ ...prev, profileLabel: true }));
        return;
      }

      setTooltip({ target: 'submit', message: msg });
    } finally {
      setSaving(false);
    }
  };

  // When an inline tooltip shows above an input, scroll it into view so the user can read it.
  React.useEffect(() => {
    if (tooltip?.target === 'profileLabel') {
      // Small delay so layout is stable before scrolling.
      requestAnimationFrame(() => {
        const y = Math.max(profileLabelY - 120, 0);
        scrollRef.current?.scrollTo({ y, animated: true });
      });
    }
  }, [tooltip, profileLabelY]);

  const handleLogout = async () => {
    await clearUserSession();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.primary} />
      <InfoDialog
        visible={medicalLockedDialogVisible}
        title={t(lang, 'consent_required')}
        message={t(lang, 'consent_required_health_msg')}
        onClose={() => setMedicalLockedDialogVisible(false)}
      />

      <Modal
        visible={avatarEditorVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAvatarEditorVisible(false)}
      >
        <View style={styles.avatarEditorBackdrop}>
          <View style={styles.avatarEditorCard}>
            <Text style={styles.avatarEditorTitle}>
              {t(lang, 'adjust_photo')}
            </Text>
            <Text style={styles.avatarEditorSub}>
              {t(lang, 'drag_pinch_hint')}
            </Text>

            <View style={styles.avatarEditorPreviewWrap}>
              <View
                style={styles.avatarEditorCircle}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {avatarEditorUri ? (
                  <View pointerEvents="none">
                    <Animated.View
                      style={{
                        transform: [
                          { translateX: avatarPanX },
                          { translateY: avatarPanY },
                        ],
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
              <Pressable
                style={[
                  styles.avatarEditorBtn,
                  styles.avatarEditorBtnSecondary,
                ]}
                onPress={() => setAvatarEditorVisible(false)}
              >
                <Text style={styles.avatarEditorBtnSecondaryText}>
                  {t(lang, 'cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.avatarEditorBtn, styles.avatarEditorBtnPrimary]}
                onPress={applyAvatarEdits}
              >
                <Text style={styles.avatarEditorBtnPrimaryText}>
                  {t(lang, 'use_photo')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={r => {
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
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            />
            <View style={[styles.heroContent, { paddingTop: 18 + insets.top }]}>
              {onLogout ? (
                <Pressable
                  onPress={() => onLogout?.()}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: insets.top + 8,
                    zIndex: 30,
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  hitSlop={10}
                >
                  <Ionicons
                    name="chevron-back"
                    size={26}
                    color={Colors.textOnPrimary}
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={handlePickAvatar}
                hitSlop={10}
                style={styles.heroAvatarWrap}
              >
                <View
                  style={[
                    styles.heroAvatarClip,
                    displayAvatar
                      ? null
                      : displayAvatarLetter
                      ? { backgroundColor: displayAvatarColor }
                      : null,
                  ]}
                >
                  <Animated.View style={{ opacity: avatarOpacity }}>
                    {displayAvatar ? (
                      <CroppedAvatarImage avatar={displayAvatar} size={88} />
                    ) : displayAvatarLetter ? (
                      <Text style={styles.heroAvatarLetter}>
                        {displayAvatarLetter}
                      </Text>
                    ) : (
                      <Image
                        source={require('../../../../assets/android-res/drawable/profile.png')}
                        style={styles.heroAvatarIcon}
                        resizeMode="contain"
                      />
                    )}
                  </Animated.View>
                </View>

                {/* Indicator only (tap anywhere on the avatar circle) */}
                <View style={styles.heroEditBadge} pointerEvents="none">
                  <Ionicons name="pencil" size={14} color={Colors.text} />
                </View>
              </Pressable>

              <Text style={styles.heroTitle}>
                {t(lang, 'create_profile_title')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t(lang, 'create_profile_subtitle')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {tooltip?.target === 'submit' ? (
            <Text style={styles.error}>{tooltip.message}</Text>
          ) : null}

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="person-circle-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.sectionTitle}>
                {t(lang, 'profile_information')}
              </Text>
            </View>

            <Text style={styles.dropdownLabel}>
              {t(lang, 'profile_name_label')}
            </Text>
            <View
              style={styles.inlineFieldRow}
              onLayout={e => {
                setProfileLabelY(e.nativeEvent.layout.y);
              }}
            >
              <InputField
                value={profileLabel}
                onChangeText={v => {
                  setProfileLabel(v);
                  const trimmed = String(v || '').trim();
                  if (!trimmed) {
                    if (fixedAvatarColor) setFixedAvatarColor(null);
                  } else {
                    // Use deterministic color based on profile name
                    setFixedAvatarColor(getAvatarColorForProfile(trimmed));
                  }
                  setFieldErrors(prev => ({ ...prev, profileLabel: false }));
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
                hasError={fieldErrors.profileLabel}
                inputStyle={styles.input}
              />
              {tooltip?.target === 'profileLabel' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  onClose={() => setTooltip(null)}
                />
              ) : null}
            </View>

            <Text style={styles.dropdownLabel}>
              {t(lang, 'profile_password_label')}
            </Text>
            <View style={styles.inlineFieldRow}>
              <InputField
                value={accessPassword}
                onChangeText={setAccessPassword}
                placeholder={t(lang, 'optional_profile_password')}
                secureTextEntry={!showAccessPassword}
                autoCapitalize="none"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                inputStyle={[styles.input, { marginBottom: 0 }]}
                rightAccessory={
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowAccessPassword(s => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showAccessPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    <Ionicons
                      name={
                        showAccessPassword ? 'eye-off-outline' : 'eye-outline'
                      }
                      size={20}
                      color={Colors.textSubtle}
                    />
                  </TouchableOpacity>
                }
              />
            </View>
          </View>

          <View
            style={[
              styles.card,
              medicalInfoLocked ? styles.cardDisabled : null,
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="heart-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                {t(lang, 'health_profile_information')}
              </Text>
            </View>

            <View style={styles.inlineDropdownWrap}>
              <Text style={styles.dropdownLabel}>
                {t(lang, 'date_of_birth')}
              </Text>
              <TouchableOpacity
                style={styles.selectContainer}
                onPress={() => {
                  if (medicalInfoLocked) {
                    setMedicalLockedDialogVisible(true);
                    return;
                  }
                  openDobPicker();
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.textSubtle}
                />
                <Text
                  style={[
                    styles.selectText,
                    !dateOfBirth ? styles.selectPlaceholder : null,
                  ]}
                >
                  {dateOfBirth || t(lang, 'select_date')}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={Colors.textSubtle}
                />
              </TouchableOpacity>
            </View>

            <SelectField
              label={t(lang, 'biological_sex')}
              value={
                sex ? t(lang, sex === 'Male' ? 'sex_male' : 'sex_female') : ''
              }
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

            <View style={styles.halfWrapper}>
              <Text style={styles.dropdownLabel}>
                {t(lang, 'height_cm_label')}
              </Text>
              <InputField
                value={heightCm}
                onChangeText={v => handleNumericChange('heightCm', v)}
                placeholder={t(lang, 'height_placeholder')}
                keyboardType="numeric"
                inputMode="numeric"
                editable={!medicalInfoLocked}
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                hasError={fieldErrors.heightCm}
                inputStyle={styles.input}
              />
              {tooltip?.target === 'heightCm' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  onClose={() => setTooltip(null)}
                />
              ) : null}
            </View>

            <View style={styles.halfWrapper}>
              <Text style={styles.dropdownLabel}>
                {t(lang, 'weight_kg_label')}
              </Text>
              <InputField
                value={weightKg}
                onChangeText={v => handleNumericChange('weightKg', v)}
                placeholder={t(lang, 'weight_placeholder')}
                keyboardType="numeric"
                inputMode="numeric"
                editable={!medicalInfoLocked}
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                selectTextOnFocus={false}
                contextMenuHidden={true}
                disableFullscreenUI={true}
                textAlignVertical="center"
                hasError={fieldErrors.weightKg}
                inputStyle={styles.input}
              />
              {tooltip?.target === 'weightKg' ? (
                <TooltipError
                  message={tooltip.message}
                  variant={tooltip.variant}
                  onClose={() => setTooltip(null)}
                />
              ) : null}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                {t(lang, 'organ_donor_label')}
              </Text>
              <Switch
                value={organDonor}
                onValueChange={v => {
                  if (medicalInfoLocked) {
                    setMedicalLockedDialogVisible(true);
                    return;
                  }
                  setOrganDonor(v);
                }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={organDonor ? Colors.textOnPrimary : '#f4f3f4'}
                ios_backgroundColor={Colors.border}
              />
            </View>

            <DynamicTextFieldList
              label={t(lang, 'allergies_label')}
              placeholder={t(lang, 'allergies_placeholder')}
              values={allergies}
              onChangeValues={setAllergies}
              editable={!medicalInfoLocked}
              labelStyle={[styles.dropdownLabel, { marginTop: 8 }]}
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

            <Text style={styles.dropdownLabel}>
              {t(lang, 'emergency_contact_label')}
            </Text>
            <TextInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder={t(lang, 'emergency_contact_placeholder')}
              editable={!medicalInfoLocked}
              multiline
              numberOfLines={1}
              scrollEnabled={
                textAreaHeights.emergencyContact >= textAreaMaxHeight
              }
              textAlignVertical="top"
              onContentSizeChange={e =>
                updateTextAreaHeight(
                  'emergencyContact',
                  e.nativeEvent.contentSize.height,
                )
              }
              style={[
                styles.textArea,
                { height: textAreaHeights.emergencyContact },
              ]}
            />

            <Text style={styles.dropdownLabel}>
              {t(lang, 'insurance_provider_label')}
            </Text>
            <TextInput
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder={t(lang, 'insurance_provider_placeholder')}
              editable={!medicalInfoLocked}
              multiline
              numberOfLines={1}
              scrollEnabled={
                textAreaHeights.insuranceProvider >= textAreaMaxHeight
              }
              textAlignVertical="top"
              onContentSizeChange={e =>
                updateTextAreaHeight(
                  'insuranceProvider',
                  e.nativeEvent.contentSize.height,
                )
              }
              style={[
                styles.textArea,
                { height: textAreaHeights.insuranceProvider },
              ]}
            />

            <Text style={styles.dropdownLabel}>
              {t(lang, 'insurance_number_label')}
            </Text>
            <TextInput
              value={insuranceNumber}
              onChangeText={setInsuranceNumber}
              placeholder={t(lang, 'insurance_number_placeholder')}
              editable={!medicalInfoLocked}
              multiline
              numberOfLines={1}
              scrollEnabled={
                textAreaHeights.insuranceNumber >= textAreaMaxHeight
              }
              textAlignVertical="top"
              onContentSizeChange={e =>
                updateTextAreaHeight(
                  'insuranceNumber',
                  e.nativeEvent.contentSize.height,
                )
              }
              style={[
                styles.textArea,
                { height: textAreaHeights.insuranceNumber },
              ]}
            />

            {medicalInfoLocked ? (
              <Pressable
                style={styles.lockOverlay}
                onPress={() => setMedicalLockedDialogVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t(
                  lang,
                  'medical_info_locked_accessibility',
                )}
              >
                <Image
                  source={require('../../../../assets/android-res/drawable/lock.png')}
                  style={styles.lockIcon}
                  resizeMode="contain"
                />
              </Pressable>
            ) : null}
          </View>

          <Button
            label={t(lang, 'create_profile_btn')}
            loading={saving}
            style={styles.button}
            onPress={submit}
          />

          {/* Logout Button (only when no onLogout provided) */}
          {!onLogout ? (
            <Button
              label={t(lang, 'log_out')}
              style={styles.logoutButton}
              labelStyle={styles.logoutButtonText}
              onPress={handleLogout}
            />
          ) : null}
        </View>
      </ScrollView>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={dobModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDobModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {t(lang, 'select_dob_title')}
              </Text>

              <View
                style={{
                  overflow: 'hidden',
                  borderRadius: 12,
                  backgroundColor: Colors.surface,
                }}
              >
                <DateTimePicker
                  value={dobTempDate}
                  mode="date"
                  display="inline"
                  onChange={(_e, d) => d && setDobTempDate(d)}
                />
              </View>

              <View style={styles.modalRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => setDobModalVisible(false)}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnTextSecondary]}
                  >
                    {t(lang, 'cancel')}
                  </Text>
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

    </SafeAreaView>
    <InlineDropdown
      visible={!!openDropdown}
      anchor={openDropdown ?? { x: 0, y: 0, width: 0, height: 0 }}
      options={
        openDropdown?.kind === 'sex'
          ? sexDropdownOptions
          : bloodTypeDropdownOptions
      }
      selectedKey={openDropdown?.kind === 'sex' ? sex : bloodType}
      unselectLabel={t(lang, 'unselect')}
      onClose={() => setOpenDropdown(null)}
      onSelect={key => {
        if (medicalInfoLocked) {
          setMedicalLockedDialogVisible(true);
          return;
        }
        if (openDropdown?.kind === 'sex') setSex(key);
        if (openDropdown?.kind === 'bloodType') setBloodType(key);
        setOpenDropdown(null);
      }}
    />
    </View>
  );
}

// styles are extracted to CreateProfileScreen.styles.ts
