import React, { createContext, useContext, useMemo } from 'react';
import { Animated } from 'react-native';

export type TabKey = 'Home' | 'Alerts' | 'Trends' | 'Profile' | 'Devices' | 'Settings';
export type TrendDetailMetric = 'bp' | 'glucose' | 'temp' | 'spo2';

export type ProfileHeaderProps = {
  greeting?: string;
  name?: string;
  dateLabel?: string;
  avatarSource?: any;
  initials?: string;
};

type OpenProfileOpts = { startHeight?: number; header?: ProfileHeaderProps } | undefined;

type TabNavigationContextValue = {
  navigateTo: (key: TabKey) => void;
  openProfileSheet: (opts?: OpenProfileOpts) => void;
  profileSheetOpen: boolean;
  profileSheetHeader?: ProfileHeaderProps;
  profileSheetAnim: Animated.Value;
};

const ActiveTabContext = createContext<TabKey | null>(null);
const TabNavigationActionsContext = createContext<TabNavigationContextValue | null>(null);

type TrendDetailRequestListener = (metric: TrendDetailMetric) => void;
const trendDetailRequestSubs = new Set<TrendDetailRequestListener>();
let pendingTrendDetailRequest: TrendDetailMetric | null = null;
let trendDetailOverlayVisible = false;
let trendDetailOverlayCloseHandler: (() => void) | null = null;

export function requestTrendDetail(metric: TrendDetailMetric) {
  pendingTrendDetailRequest = metric;
  for (const cb of Array.from(trendDetailRequestSubs)) {
    try {
      cb(metric);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeTrendDetailRequest(cb: TrendDetailRequestListener) {
  trendDetailRequestSubs.add(cb);
  return () => {
    trendDetailRequestSubs.delete(cb);
  };
}

export function takePendingTrendDetailRequest(): TrendDetailMetric | null {
  const next = pendingTrendDetailRequest;
  pendingTrendDetailRequest = null;
  return next;
}

export function setTrendDetailOverlayState(visible: boolean, closeHandler?: () => void) {
  trendDetailOverlayVisible = visible;
  trendDetailOverlayCloseHandler = visible ? (closeHandler ?? null) : null;
}

export function closeTrendDetailOverlay(): boolean {
  if (!trendDetailOverlayVisible || !trendDetailOverlayCloseHandler) return false;

  const close = trendDetailOverlayCloseHandler;
  trendDetailOverlayVisible = false;
  trendDetailOverlayCloseHandler = null;

  try {
    close();
    return true;
  } catch {
    return false;
  }
}

export function TabNavigationProvider({
  active,
  navigateTo,
  openProfileSheet,
  profileSheetOpen,
  profileSheetHeader,
  profileSheetAnim,
  children,
}: React.PropsWithChildren<{
  active: TabKey;
  navigateTo: (key: TabKey) => void;
  openProfileSheet: (opts?: OpenProfileOpts) => void;
  profileSheetOpen: boolean;
  profileSheetHeader?: ProfileHeaderProps;
  profileSheetAnim: Animated.Value;
}>) {
  const actionsValue = useMemo(
    () => ({ navigateTo, openProfileSheet, profileSheetOpen, profileSheetHeader, profileSheetAnim }),
    [navigateTo, openProfileSheet, profileSheetOpen, profileSheetHeader, profileSheetAnim],
  );

  return (
    <ActiveTabContext.Provider value={active}>
      <TabNavigationActionsContext.Provider value={actionsValue}>{children}</TabNavigationActionsContext.Provider>
    </ActiveTabContext.Provider>
  );
}

export function useActiveTab() {
  const active = useContext(ActiveTabContext);
  if (!active) throw new Error('useActiveTab must be used within TabNavigationProvider');
  return active;
}

export function useTabNavigationActions() {
  const ctx = useContext(TabNavigationActionsContext);
  if (!ctx) throw new Error('useTabNavigationActions must be used within TabNavigationProvider');
  return ctx;
}

// Backwards-compatible hook (prefer useActiveTab + useTabNavigationActions for performance)
export function useTabNavigation() {
  const active = useActiveTab();
  const actions = useTabNavigationActions();
  return { active, ...actions };
}
