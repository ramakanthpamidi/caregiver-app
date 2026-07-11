export const Colors = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  cardAlt: '#FCFDFE',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FB',
  surfaceRaised: '#FFFFFF',
  overlay: 'rgba(17, 24, 39, 0.48)',

  primary: '#064B75',
  primaryDark: '#053A5B',
  primarySoft: '#E6F2F8',
  secondary: '#0EA5E9',
  secondarySoft: '#E0F2FE',
  accent: '#10B981',
  accentSoft: '#D1FAE5',

  text: '#111827',
  textMuted: '#4B5563',
  textSubtle: '#6B7280',
  textDisabled: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderSoft: '#EEF2F7',
  borderStrong: '#CBD5E1',

  success: '#059669',
  successSoft: '#D1FAE5',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#2563EB',
  infoSoft: '#DBEAFE',

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  backdrop: 'rgba(17, 24, 39, 0.32)',
  transparent: 'transparent',
} as const;

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const Radius = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  round: 999,
  pill: 999,
  full: 9999,
} as const;

export const Typography = {
  fontFamily: {
    regular: 'Roboto',
    medium: 'Roboto',
    semibold: 'Roboto',
    bold: 'Roboto',
    monospace: 'monospace',
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 30,
    '2xl': 34,
    '3xl': 38,
    '4xl': 42,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  caption: 14,
  body: 14,
  bodyLg: 16,
  title: 18,
  headline: 28,
} as const;

export const IconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

export const BorderWidth = {
  none: 0,
  hairline: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
} as const;

export const Opacity = {
  disabled: 0.5,
  subtle: 0.72,
  muted: 0.64,
  overlay: 0.48,
  invisible: 0,
  visible: 1,
} as const;

export const Shadows = {
  none: {
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export const Motion = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 200,
    slow: 320,
  },
  easing: {
    standard: 'easeInOut',
    enter: 'easeOut',
    exit: 'easeIn',
  },
} as const;

export const Layout = {
  screenMaxWidth: 480,
  contentMaxWidth: 720,
  bottomTabHeight: 70,
  headerHeight: 56,
  inputHeight: 52,
  buttonHeight: 52,
  iconButtonSize: 44,
} as const;

export const ZIndex = {
  base: 0,
  content: 10,
  sticky: 100,
  dropdown: 400,
  overlay: 800,
  modal: 1000,
  toast: 1100,
  tooltip: 1200,
} as const;

export const Theme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  typography: Typography,
  iconSize: IconSize,
  borderWidth: BorderWidth,
  opacity: Opacity,
  shadows: Shadows,
  motion: Motion,
  layout: Layout,
  zIndex: ZIndex,
} as const;

export type AppTheme = typeof Theme;
