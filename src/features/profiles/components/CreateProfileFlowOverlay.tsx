import React from 'react';
import { Animated, BackHandler, Dimensions, Easing, StyleSheet, useWindowDimensions, View, Text, ActivityIndicator, InteractionManager } from 'react-native';
import { HeaderBackButton } from '@react-navigation/elements';
import { NavigationContainer, NavigationIndependentTree, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PolicyScreen from '../../legal/screens/PolicyScreen';
import ConsentScreen from '../../legal/screens/ConsentScreen';
import CreateProfileScreen from '../screens/CreateProfileScreen';
import { OnboardingDraftProvider } from '../../../shared/contexts/onboardingDraftContext';

const Stack = createNativeStackNavigator();
const IndependentNavigationContainer: any = NavigationContainer as any;

const navRef = (() => {
  try {
    if (typeof createNavigationContainerRef === 'function') return createNavigationContainerRef();
  } catch {
    // ignore
  }
  return {
    isReady: () => false,
    canGoBack: () => false,
    goBack: () => {},
    reset: () => {},
    resetRoot: () => {},
  } as any;
})();

export type CreateProfileFlowOverlayProps = {
  visible: boolean;
  preload?: boolean;
  onClose: () => void;
  onComplete?: (profileId?: number) => void | Promise<void>;
};

export default function CreateProfileFlowOverlay({ visible, preload = false, onClose, onComplete }: CreateProfileFlowOverlayProps) {
  const { width } = useWindowDimensions();
  const screenWidth = Math.max(width || 0, Dimensions.get('window').width || 0, 1);
  const [mounted, setMounted] = React.useState<boolean>(visible || preload);
  const [contentMounted, setContentMounted] = React.useState<boolean>(visible);
  // 0 = on-screen, 1 = off-screen right
  const overlayX = React.useRef(new Animated.Value(visible ? 0 : 1)).current;
  const closingRef = React.useRef(false);
  const [navKey, setNavKey] = React.useState(0);
  const resettingRef = React.useRef(false);

  const resetToRoot = React.useCallback(() => {
    try {
      if (!navRef.isReady()) return;
      resettingRef.current = true;
      const state = { index: 0, routes: [{ name: 'PolicyScreen', params: { flow: 'addProfile' } }] };
      // v6 compat: resetRoot exists on navigation container ref
      (navRef as any).resetRoot?.(state);
      (navRef as any).reset?.(state);
      // Clear flag on next frame so user back handling works normally.
      requestAnimationFrame(() => {
        resettingRef.current = false;
      });
    } catch {
      // ignore
      resettingRef.current = false;
    }
  }, []);

  // Preload navigator content in the background (keeps first open snappy).
  React.useEffect(() => {
    if (!preload) return;
    if (contentMounted) return;
    const handle = InteractionManager.runAfterInteractions(() => {
      setMounted(true);
      setContentMounted(true);
    });
    return () => handle.cancel();
  }, [preload, contentMounted]);

  React.useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);

      // If content isn't mounted yet, mount it right away but allow the slide animation to start.
      if (!contentMounted) {
        setContentMounted(true);
        // Force a fresh nav container instance on the very first mount only.
        setNavKey((k) => k + 1);
      } else {
        // Reset stack back to Policy when re-opening.
        resetToRoot();
      }

      try {
        overlayX.stopAnimation();
      } catch {
        // ignore
      }
      overlayX.setValue(1);

      // Start transition on the next frame for a responsive forward navigation feel.
      const handle = requestAnimationFrame(() => {
        Animated.timing(overlayX, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });

      return () => cancelAnimationFrame(handle);
    }

    if (!mounted) return;
    closingRef.current = true;
    Animated.timing(overlayX, {
      toValue: 1,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (!preload) {
        setMounted(false);
        setContentMounted(false);
        return;
      }
      // Keep mounted when preloading so the next open is instant.
      overlayX.setValue(1);
    });
  }, [visible, mounted, preload, contentMounted, overlayX, resetToRoot]);

  const requestClose = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [onClose]);

  // On Android, rendering a navigator inside a native `Modal` can crash because
  // `react-native-screens` tries to attach fragments under a non-ReactRootView.
  // We avoid `Modal` entirely and render an in-tree absolute overlay.
  React.useEffect(() => {
    if (!mounted) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prefer stack back within the flow; close the overlay only at root.
      if (navRef.isReady() && navRef.canGoBack()) {
        navRef.goBack();
        return true;
      }
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, requestClose]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      needsOffscreenAlphaCompositing
      style={[
        styles.overlayRoot,
        {
          // Keep opacity during close so the slide-out is visible.
          // When not visible, the view is translated fully off-screen and pointerEvents is none.
          opacity: 1,
        },
        {
          transform: [
            {
              translateX: overlayX.interpolate({
                inputRange: [0, 1],
                outputRange: [0, screenWidth],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <OnboardingDraftProvider>
        {contentMounted ? (
          <NavigationIndependentTree>
          <IndependentNavigationContainer key={navKey} ref={navRef as any}>
            <Stack.Navigator
              initialRouteName="PolicyScreen"
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 220,
              }}
            >
              <Stack.Screen
                name="PolicyScreen"
                component={PolicyScreen as any}
                initialParams={{ flow: 'addProfile' }}
                options={() => ({
                  headerShown: true,
                  // Render a left header button even on the initial route so users can close the overlay
                  headerLeft: (props) => (
                    <HeaderBackButton
                      {...props}
                      onPress={requestClose}
                      tintColor="#064b75"
                      // Make the touchable area circular to match other auth headers
                      style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginLeft: 4 }}
                      // ripple color on Android
                      pressColor="rgba(6,75,117,0.12)"
                    />
                  ),
                  title: 'Privacy Policy',
                  headerTitleAlign: 'center',
                  headerTintColor: '#064b75',
                  headerTitleStyle: { color: '#064b75' },
                })}
                listeners={{
                  beforeRemove: (e) => {
                    // During internal resets (re-open), allow navigation actions to proceed.
                    if (resettingRef.current) return;

                    // Intercept user back navigation on the first screen to close overlay.
                    const actionType = (e as any)?.data?.action?.type;
                    const isBackLike =
                      actionType === 'GO_BACK' ||
                      actionType === 'POP' ||
                      actionType === 'POP_TO_TOP' ||
                      actionType === 'NAVIGATE_DEPRECATED';

                    if (actionType == null || isBackLike) {
                      e.preventDefault();
                      requestClose();
                    }
                  },
                }}
              />
              <Stack.Screen
                name="ConsentScreen"
                component={ConsentScreen as any}
                initialParams={{ flow: 'addProfile' }}
                options={{
                  headerShown: true,
                  title: 'Consent',
                  headerTitleAlign: 'center',
                  headerTintColor: '#064b75',
                  headerTitleStyle: { color: '#064b75' },
                }}
              />
              <Stack.Screen name="CreateProfile" options={{ headerShown: false }}>
                {() => (
                  <CreateProfileScreen
                    onComplete={async (profileId?: number) => {
                      try {
                        await onComplete?.(profileId);
                      } finally {
                        requestClose();
                      }
                    }}
                    onLogout={requestClose}
                  />
                )}
              </Stack.Screen>
            </Stack.Navigator>
          </IndependentNavigationContainer>
          </NavigationIndependentTree>
        ) : (
          <View style={styles.loadingRoot}>
            <ActivityIndicator size="large" color="#064b75" />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}
      </OnboardingDraftProvider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f9fafb',
    // ensure this sits above the rest of the UI
    zIndex: 9999,
    elevation: 9999,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#374151',
  },
});
