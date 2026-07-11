// constants/theme.js
export const COLORS = {
  // Brand palette
  primary:      '#0D2137',
  primaryMid:   '#1B4F72',
  primaryLight: '#2E86AB',
  secondary:    '#00B4D8',
  accent:       '#48CAE4',
  accentLight:  '#ADE8F4',

  // Surface
  background:   '#EBF3F9',
  surface:      '#F8FBFD',
  white:        '#FFFFFF',
  divider:      '#D0E1ED',

  // Text
  textDark:     '#0D2137',
  textBody:     '#2C4A62',
  textMuted:    '#7A96AB',
  textDisabled: '#B0C4D2',

  // Semantic
  success:      '#1A9E6A',
  successBg:    '#D6F5EC',
  successDark:  '#0F6647',
  warning:      '#D97706',
  warningBg:    '#FEF3C7',
  danger:       '#DC2626',
  dangerBg:     '#FEE2E2',
  info:         '#2563EB',
  infoBg:       '#DBEAFE',

  // Device colours
  deviceOximeter:    '#EF4444',
  deviceBP:          '#8B5CF6',
  deviceWeight:      '#F59E0B',
  deviceThermo:      '#EC4899',
  deviceGluco:       '#10B981',
  deviceHW:          '#06B6D4',
  deviceCGM:         '#3B82F6',
  deviceWatch:       '#6366F1',
};

export const SPACING = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const RADIUS = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  full: 999,
};

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  hero: 42,
};

export const FONT_WEIGHT = {
  regular:   '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
};

export const LINE_HEIGHT = {
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

export const shadow = {
  xs: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
};