import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BadgeSeverity } from '../../../features/alerts/lib/alertNotifications';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

const BADGE_COLOR: Record<NonNullable<BadgeSeverity>, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
};

const TAB_I18N: Record<string, string> = {
  Home: 'tab_home',
  Alerts: 'tab_alerts',
  Trends: 'tab_trends',
  Devices: 'tab_devices',
  Settings: 'tab_settings',
};

const ITEMS = [
  { key: 'Home', icon: require('../../../../assets/android-res/drawable/home.png') },
  { key: 'Alerts', icon: require('../../../../assets/android-res/drawable/alert.png') },
  { key: 'Trends', icon: require('../../../../assets/android-res/drawable/trend.png') },
  { key: 'Devices', icon: require('../../../../assets/android-res/drawable/device.png') },
  { key: 'Settings', icon: require('../../../../assets/android-res/drawable/setting.png') },
];

// Memoized nav item — uses animated opacity for smooth active-state cross-fade
const NavItem = React.memo(function NavItem({ 
  item, 
  onPress,
  badge,
  lang,
  activeOpacity,
}: { 
  item: typeof ITEMS[0]; 
  onPress: () => void;
  badge?: BadgeSeverity;
  lang: 'en' | 'th';
  activeOpacity: Animated.AnimatedInterpolation<number>;
}) {
  const label = t(lang, TAB_I18N[item.key] || item.key);
  return (
    <TouchableOpacity
      style={styles.navItem}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <Image
          source={item.icon}
          style={styles.navIconImage}
          resizeMode="contain"
        />
        <Animated.View style={[styles.navIconActiveOverlay, { opacity: activeOpacity }]} pointerEvents="none">
          <Image
            source={item.icon}
            style={[styles.navIconImage, { tintColor: '#064b75' }]}
            resizeMode="contain"
          />
        </Animated.View>
        {!!badge && (
          <View style={[styles.badge, { backgroundColor: BADGE_COLOR[badge] }]} />
        )}
      </View>
      <View style={styles.navLabelWrap}>
        <Text style={styles.navText}>{label}</Text>
        <Animated.Text
          style={[styles.navText, styles.navActiveText, styles.navLabelActiveOverlay, { opacity: activeOpacity }]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
});

const BottomNav = React.memo(function BottomNav({ active = 'Home', onPress, alertBadge, tabPosition }: { active?: string; onPress?: (key: string) => void; alertBadge?: BadgeSeverity; tabPosition?: Animated.Value }) {
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const effectiveActive = ITEMS.some((it) => it.key === active) ? active : 'Home';
  const activeIndex = ITEMS.findIndex((it) => it.key === effectiveActive);
  const bottomInset = Math.max(0, insets.bottom);
  // Use tabPosition from parent (drives screen slide) so the indicator moves in perfect sync.
  // Fall back to a local animated value if not provided.
  const fallbackAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;
  const slideAnim = tabPosition ?? fallbackAnim;
  const [containerWidth, setContainerWidth] = useState(0);

  // Per-item animated opacity so icon/text color cross-fades with the indicator
  const itemActiveOpacities = useMemo(() => {
    return ITEMS.map((_, i) =>
      slideAnim.interpolate({
        inputRange: ITEMS.map((__, j) => j),
        outputRange: ITEMS.map((__, j) => (j === i ? 1 : 0)),
        extrapolate: 'clamp',
      }),
    );
  }, [slideAnim]);

  // Only animate the fallback (standalone) value; when tabPosition is provided the parent drives it.
  useEffect(() => {
    if (tabPosition) return;
    const idx = ITEMS.findIndex((it) => it.key === effectiveActive);
    if (idx >= 0) {
      Animated.spring(fallbackAnim, {
        toValue: idx,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
        mass: 0.5,
      }).start();
    }
  }, [effectiveActive, fallbackAnim, tabPosition]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Memoize press handlers to prevent re-renders
  const pressHandlers = useMemo(() => {
    return ITEMS.map((item) => () => onPress && onPress(item.key));
  }, [onPress]);

  // Calculate indicator position based on container width
  // Account for paddingHorizontal (6 on each side = 12 total)
  const horizontalPadding = 6;
  const usableWidth = containerWidth - horizontalPadding * 2;
  const itemWidth = usableWidth / ITEMS.length;
  const indicatorWidth = 32;

  // Memoize indicator style
  const indicatorStyle = useMemo(() => {
    if (containerWidth <= 0) return null;
    return [
      styles.slideIndicator,
      {
        width: indicatorWidth,
        transform: [
          {
            translateX: slideAnim.interpolate({
              inputRange: ITEMS.map((_, i) => i),
              // Add horizontalPadding offset to account for container padding
              outputRange: ITEMS.map((_, i) => horizontalPadding + i * itemWidth + (itemWidth - indicatorWidth) / 2),
            }),
          },
        ],
      },
    ];
  }, [containerWidth, slideAnim, itemWidth]);

  return (
    <View
      style={[
        styles.bottomNav,
        {
          bottom: 0,
          height: 70 + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
      onLayout={handleLayout}
    >
      {/* Sliding indicator */}
      {indicatorStyle && (
        <Animated.View style={indicatorStyle} />
      )}
      {ITEMS.map((it, index) => (
        <NavItem
          key={it.key}
          item={it}
          onPress={pressHandlers[index]}
          badge={it.key === 'Alerts' ? alertBadge : undefined}
          lang={lang}
          activeOpacity={itemActiveOpacities[index]}
        />
      ))}
    </View>
  );
});

export default BottomNav;

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    // subtle outline + light shadow for a soft elevated look
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
    zIndex: 2000,
    paddingHorizontal: 6,
  },
  slideIndicator: {
    position: 'absolute',
    top: 4,
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#064b75',
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  navIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#f3f4f6', marginBottom: 4 },
  navIconImage: { width: 26, height: 26, marginBottom: 4 },
  navIconActiveOverlay: { position: 'absolute' as const, top: 0, left: 0 },
  navLabelWrap: { alignItems: 'center' as const, position: 'relative' as const },
  navLabelActiveOverlay: { position: 'absolute' as const },
  navText: { fontSize: 11, color: '#6b7280' },
  navActiveText: { color: '#064b75', fontWeight: '700' },
});
