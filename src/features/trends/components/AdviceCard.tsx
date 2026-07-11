import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import { BorderWidth, Colors, Radius, Spacing, Typography } from '../../../shared/theme/theme';

type Props = {
  rows?: AdviceRowModel[];
  onExport?: () => void;
};

export type AdviceRowModel = {
  key: string;
  icon: any;
  tint: string;
  background: string;
  title: string;
  body: string;
};

function AdviceRow({
  icon,
  tint,
  title,
  body,
  background,
}: {
  icon: any;
  tint: string;
  title: string;
  body: string;
  background: string;
}) {
  return (
    <View style={[styles.row, { backgroundColor: background }]}>
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Image source={icon} style={styles.icon} resizeMode="contain" />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.rowTitle, { color: tint }]}>{title}</Text>
          <Text style={styles.rowBody}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

const defaultRows: AdviceRowModel[] = [
  {
    key: 'bp-default',
    icon: require('../../../../assets/android-res/drawable/pressure.png'),
    tint: Colors.success,
    background: Colors.successSoft,
    title: 'Blood Pressure',
    body: 'Track blood pressure regularly and follow your care plan.',
  },
  {
    key: 'glucose-default',
    icon: require('../../../../assets/android-res/drawable/glucose.png'),
    tint: Colors.info,
    background: Colors.infoSoft,
    title: 'Blood Sugar',
    body: 'Monitor glucose trends and keep a consistent routine.',
  },
  {
    key: 'overall-default',
    icon: require('../../../../assets/android-res/drawable/rhythm.png'),
    tint: Colors.primary,
    background: Colors.primarySoft,
    title: 'Overall Health',
    body: 'Use trends to spot changes early and discuss concerns with your clinician.',
  },
];

export default function AdviceCard({ rows, onExport }: Props) {
  const { lang } = useLanguage();
  const items = rows && rows.length > 0 ? rows : defaultRows;

  return (
    <View style={styles.container}>
      {items.map((row, index) => (
        <React.Fragment key={row.key || `${row.title}-${index}`}>
          <AdviceRow
            icon={row.icon}
            tint={row.tint}
            background={row.background}
            title={row.title}
            body={row.body}
          />
          {index < items.length - 1 ? <View style={styles.rowSpacer} /> : null}
        </React.Fragment>
      ))}

      <Pressable
        style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.9 }]}
        onPress={onExport}
      >
        <Image source={require('../../../../assets/android-res/drawable/export.png')} style={styles.exportIcon} resizeMode="contain" />
        <Text style={styles.exportText}>{t(lang, 'export_health_report')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  row: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  rowSpacer: {
    height: Spacing.md - Spacing.xs,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 32,
    marginRight: Spacing.md,
    paddingTop: 2,
    alignItems: 'center',
  },
  icon: {
    width: 18,
    height: 18,
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: Typography.size.md,
    lineHeight: Typography.lineHeight.md,
    fontWeight: Typography.weight.bold,
  },
  rowBody: {
    marginTop: Spacing.xs,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weight.medium,
  },
  exportBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    minHeight: 52,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportIcon: {
    width: 18,
    height: 18,
    tintColor: Colors.textOnPrimary,
    marginRight: Spacing.sm + Spacing.xs,
  },
  exportText: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weight.bold,
    fontSize: Typography.size.sm,
    lineHeight: Typography.lineHeight.sm,
  },
});
