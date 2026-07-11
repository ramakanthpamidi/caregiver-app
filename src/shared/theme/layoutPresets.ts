import { StyleSheet } from 'react-native';

import { Colors, Layout, Radius, Shadows, Spacing } from './theme';

export const LayoutPresets = StyleSheet.create({
  fill: {
    flex: 1,
  },
  itemsCenter: {
    alignItems: 'center',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: Colors.background,
  },
  screenContent: {
    width: '100%',
    maxWidth: Layout.screenMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  centeredScreen: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  centeredContent: {
    width: '100%',
    maxWidth: Layout.screenMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  pageSection: {
    width: '100%',
    marginBottom: Spacing['2xl'],
  },
  card: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadows.soft,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LayoutPresets;
