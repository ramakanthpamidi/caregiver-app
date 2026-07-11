import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { Colors } from '../../../shared/theme/theme';
import styles from '../screens/HomeScreen.styles';

export type HomeVitalCardItem = {
  id: string;
  title: string;
  icon: any;
  deviceName?: string | null;
  valueText?: string | null;
  valueLine2?: string | null;
  accentColor?: string | null;
  bmiHintText?: string | null;
  hasDevice?: boolean;
  isConnected?: boolean;
  hasMultipleDevices?: boolean;
  locked?: boolean;
  onPress?: () => void;
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
  hasDevice = true,
  isConnected = false,
  hasMultipleDevices: _hasMultipleDevices = false,
  locked = false,
  onPress,
}: HomeVitalCardItem) {
  const { lang } = useLanguage();
  const isLongCard = id === 'weight';
  const isWeightCard = id === 'weight';
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
          <View style={styles.weightSplitRow}>
            <View style={styles.weightSplitMetric}>
              <Text style={styles.weightSplitLabel} numberOfLines={1}>
                {bmiLabel}
              </Text>
              <Text
                style={[styles.weightSplitValue, { color: valueColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {displayBmi}
              </Text>
              {bmiHintText ? (
                <Text style={styles.weightSplitHint} numberOfLines={2}>
                  {bmiHintText}
                </Text>
              ) : null}
            </View>

            <View style={styles.weightSplitDivider} />

            <View style={styles.weightSplitMetric}>
              <Text style={styles.weightSplitLabel} numberOfLines={1}>
                {title}
              </Text>
              <Text
                style={[styles.weightSplitValue, { color: valueColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {displayWeightWithUnit}
              </Text>
            </View>
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
