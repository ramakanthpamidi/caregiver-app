import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors } from '../../../shared/theme/theme';
import styles from '../screens/HomeScreen.styles';

export type BodyCompositionData = {
  fat: number | null;
  muscle: number | null;
  water: number | null;
  protein: number | null;
  visceral: number | null;
  bmr: number | null;
  bone: number | null;
  bodyAge: number | null;
} | null;

export type HomeVitalCardItem = {
  id: string;
  title: string;
  icon: any;
  deviceName?: string | null;
  valueText?: string | null;
  valueLine2?: string | null;
  accentColor?: string | null;
  bmiHintText?: string | null;
  composition?: BodyCompositionData;
  hasDevice?: boolean;
  isConnected?: boolean;
  hasMultipleDevices?: boolean;
  locked?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

type Props = {
  cards: HomeVitalCardItem[];
};

const VitalCard = React.memo(function VitalCard({
  id,
  title,
  icon,
  deviceName: _deviceName,
  valueText,
  valueLine2,
  accentColor,
  bmiHintText,
  composition,
  hasDevice = true,
  isConnected = false,
  hasMultipleDevices: _hasMultipleDevices = false,
  locked = false,
  onPress,
  onLongPress,
}: HomeVitalCardItem) {
  const { lang } = useLanguage();
  // The weight card spans the full row so it can show the full body-composition
  // readout from the scale.
  const isWeightCard = id === 'weight';
  const isLongCard = isWeightCard;
  const displayValue =
    valueText && String(valueText).trim().length > 0
      ? valueText
      : isConnected
        ? '00'
        : '--';
  const displayBmi =
    valueText && String(valueText).trim().length > 0
      ? valueText
      : '--';
  const displayWeightWithUnit =
    valueLine2 && String(valueLine2).trim().length > 0
      ? valueLine2
      : '--';
  const bmiLabel = t(lang, 'report_bmi').replace(/[\s:：]+$/g, '');
  const valueColor = accentColor || Colors.text;

  const compositionChips = composition
    ? ([
        composition.fat != null ? { key: 'fat', label: t(lang, 'body_fat'), value: `${composition.fat}%` } : null,
        composition.muscle != null ? { key: 'muscle', label: t(lang, 'muscle'), value: `${composition.muscle}%` } : null,
        composition.water != null ? { key: 'water', label: t(lang, 'water'), value: `${composition.water}%` } : null,
        composition.protein != null ? { key: 'protein', label: t(lang, 'protein'), value: `${composition.protein}%` } : null,
        composition.visceral != null ? { key: 'visceral', label: t(lang, 'visceral_fat'), value: `${composition.visceral}` } : null,
        composition.bmr != null ? { key: 'bmr', label: t(lang, 'bmr'), value: `${composition.bmr}` } : null,
        composition.bone != null ? { key: 'bone', label: t(lang, 'bone_mass'), value: `${composition.bone} kg` } : null,
        composition.bodyAge != null ? { key: 'bodyAge', label: t(lang, 'body_age'), value: `${composition.bodyAge}` } : null,
      ].filter(Boolean) as { key: string; label: string; value: string }[])
    : [];

  if (locked) {
    return (
      <TouchableOpacity
        style={[styles.vitalCard, isLongCard ? styles.vitalCardLong : null, styles.vitalCardLocked]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.vitalCardTopRow}>
          <Image
            source={icon}
            style={[styles.vitalCardIcon, styles.vitalCardIconDisabled]}
            resizeMode="contain"
          />
          <Text
            style={[styles.vitalCardTitle, styles.vitalCardTitleDisabled]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {title}
          </Text>
        </View>

        <View style={[styles.vitalCardValueArea, isLongCard ? styles.vitalCardValueAreaLong : null]}>
          <Text style={styles.vitalCardNoDevice} numberOfLines={2}>
            {t(lang, 'consent_required')}
          </Text>
        </View>

        <Text style={styles.vitalCardHintDisabled}>
          {t(lang, 'update_policy_consent')}
        </Text>

        <View style={styles.vitalCardLockOverlay} pointerEvents="none">
          <Image
            source={require('../../../../assets/android-res/drawable/lock.png')}
            style={styles.vitalCardLockIcon}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>
    );
  }

  if (!hasDevice) {
    return (
      <TouchableOpacity
        style={[styles.vitalCard, isLongCard ? styles.vitalCardLong : null, styles.vitalCardDisabled]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={styles.vitalCardTopRow}>
          <Image
            source={icon}
            style={[styles.vitalCardIcon, styles.vitalCardIconDisabled]}
            resizeMode="contain"
          />
          <Text
            style={[styles.vitalCardTitle, styles.vitalCardTitleDisabled]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {title}
          </Text>
        </View>

        <View style={styles.vitalCardEmptyState}>
          <Text style={styles.vitalCardNoDevice} numberOfLines={2}>
            {t(lang, 'no_device_connected')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
      <TouchableOpacity
      style={[styles.vitalCard, isLongCard ? styles.vitalCardLong : null]}
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.vitalCardTopRow}>
        <Image source={icon} style={styles.vitalCardIcon} resizeMode="contain" />
        <Text
          style={styles.vitalCardTitle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.9}
        >
          {title}
        </Text>
      </View>

      <View style={[styles.vitalCardValueArea, isLongCard ? styles.vitalCardValueAreaLong : null]}>
        {isWeightCard ? (
          <View style={styles.weightFullWrap}>
            <View style={styles.weightFullHeader}>
              <View style={styles.weightFullMetric}>
                <Text style={styles.weightSplitLabel} numberOfLines={1}>{title}</Text>
                <Text
                  style={[styles.weightBmiSubValue, { color: valueColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {displayWeightWithUnit}
                </Text>
              </View>
              <View style={styles.weightSplitDivider} />
              <View style={styles.weightFullMetric}>
                <Text style={styles.weightSplitLabel} numberOfLines={1}>{bmiLabel}</Text>
                <Text
                  style={[styles.weightBmiSubValue, { color: valueColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {displayBmi}
                </Text>
              </View>
            </View>

            {compositionChips.length > 0 ? (
              <View style={styles.compositionGrid}>
                {compositionChips.map(c => (
                  <View key={c.key} style={styles.compositionChip}>
                    <Text style={styles.compositionValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {c.value}
                    </Text>
                    <Text style={styles.compositionLabel} numberOfLines={1}>{c.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              bmiHintText ? (
                <Text style={styles.weightSplitHint} numberOfLines={2}>{bmiHintText}</Text>
              ) : null
            )}
          </View>
        ) : (
          <>
            <Text
              style={valueLine2 ? styles.vitalCardValue : styles.vitalCardValueLarge}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {displayValue}
            </Text>
            {valueLine2 ? (
              <Text
                style={styles.vitalCardValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {valueLine2}
              </Text>
            ) : null}
          </>
        )}
      </View>

    </TouchableOpacity>
  );
});

const HomeVitalsGrid = React.memo(function HomeVitalsGrid({ cards }: Props) {
  return (
    <View style={styles.vitalsGrid}>
      {cards.map(card => (
        <VitalCard key={card.id} {...card} />
      ))}
    </View>
  );
});

export default HomeVitalsGrid;
