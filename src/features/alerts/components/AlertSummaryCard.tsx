import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Radius } from '../../../shared/theme/theme';

type Props = {
  label: string;
  count: number;
  color: string;
  bgColor: string;
};

const AlertSummaryCard = React.memo(function AlertSummaryCard({
  label,
  count,
  color,
  bgColor,
}: Props) {
  return (
    <View
      style={[styles.tile, { backgroundColor: bgColor, borderColor: bgColor }]}
    >
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.count, { color }]}>{count}</Text>
    </View>
  );
});

export default AlertSummaryCard;

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    minHeight: 116,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 9,
  },
  label: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    color: '#69788C',
    fontWeight: '600',
  },
  count: {
    marginTop: 18,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
});
