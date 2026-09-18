import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { evaluateBmi, bmiCategoryKey, type LatestWeightBmi } from '../lib/weightBmi';
import { getStatusColor, getStatusBgColor } from '../../../shared/lib/healthThresholds';
import { Colors, Radius, Spacing, Shadows } from '../../../shared/theme/theme';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

const weightIcon = require('../../../../assets/android-res/drawable/weight.png');

/**
 * Full-width "Weight & Body Composition" card for the Trends overview. Shows the
 * latest weight + BMI (with WHO category badge) and the scale's full body-
 * composition readout. Data is fetched once on the Trends screen and passed in.
 */
export default function WeightBmiTile({
  latest,
  onPress,
}: {
  latest: LatestWeightBmi | null;
  onPress?: () => void;
}) {
  const { lang } = useLanguage();

  const bmi = latest?.bmi ?? null;
  const status = bmi != null ? evaluateBmi(bmi) : null;
  const accent = status ? getStatusColor(status) : Colors.text;
  const badge = bmi != null ? t(lang, bmiCategoryKey(bmi)) : null;

  const chips = latest
    ? ([
        latest.fatPct != null ? { k: 'fat', l: t(lang, 'body_fat'), v: `${latest.fatPct}%` } : null,
        latest.musclePct != null ? { k: 'muscle', l: t(lang, 'muscle'), v: `${latest.musclePct}%` } : null,
        latest.waterPct != null ? { k: 'water', l: t(lang, 'water'), v: `${latest.waterPct}%` } : null,
        latest.proteinPct != null ? { k: 'protein', l: t(lang, 'protein'), v: `${latest.proteinPct}%` } : null,
        latest.visceralFat != null ? { k: 'visceral', l: t(lang, 'visceral_fat'), v: `${latest.visceralFat}` } : null,
        latest.bmr != null ? { k: 'bmr', l: t(lang, 'bmr'), v: `${latest.bmr}` } : null,
        latest.boneMassKg != null ? { k: 'bone', l: t(lang, 'bone_mass'), v: `${latest.boneMassKg} kg` } : null,
        latest.bodyAge != null ? { k: 'bodyAge', l: t(lang, 'body_age'), v: `${latest.bodyAge}` } : null,
      ].filter(Boolean) as { k: string; l: string; v: string }[])
    : [];

  const Container: any = onPress ? Pressable : View;

  return (
    <Container style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <Image source={weightIcon} style={[styles.icon, { tintColor: accent }]} resizeMode="contain" />
        <Text style={styles.title} numberOfLines={1}>{t(lang, 'weight_bmi_trend_title')}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: status ? getStatusBgColor(status) : Colors.surfaceMuted }]}>
            <Text style={[styles.badgeText, { color: accent }]} numberOfLines={1}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.valuesRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t(lang, 'weight_scale')}</Text>
          <Text style={[styles.metricValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {latest ? `${latest.kg.toFixed(1)} ${t(lang, 'weight_kg_suffix')}` : '--'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t(lang, 'bmi_label')}</Text>
          <Text style={[styles.metricValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {bmi != null ? bmi.toFixed(1) : '--'}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.grid}>
          {chips.map(c => (
            <View key={c.k} style={styles.chip}>
              <Text style={styles.chipValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{c.v}</Text>
              <Text style={styles.chipLabel} numberOfLines={1}>{c.l}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{t(lang, 'weight_bmi_trend_empty')}</Text>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.soft,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  icon: { width: 22, height: 22, marginRight: Spacing.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Spacing.md,
  },
  metric: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, color: Colors.textSubtle, fontWeight: '600', marginBottom: 2 },
  metricValue: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#D1D5DB', marginHorizontal: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  chip: { width: '23%', alignItems: 'center', paddingVertical: 6 },
  chipValue: { fontSize: 15, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  chipLabel: { fontSize: 10, lineHeight: 13, color: Colors.textSubtle, textAlign: 'center', marginTop: 1 },
  empty: { fontSize: 12, color: Colors.textSubtle, textAlign: 'center', paddingVertical: Spacing.sm },
});
