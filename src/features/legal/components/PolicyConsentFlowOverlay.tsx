import React from 'react';
import { Animated, BackHandler, Dimensions, Easing, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { HeaderBackButton } from '@react-navigation/elements';
import { NavigationContainer, NavigationIndependentTree, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PolicyScreen from '../screens/PolicyScreen';
import ConsentScreen from '../screens/ConsentScreen';
import TermScreen from '../screens/TermScreen';
import { OnboardingDraftProvider } from '../../../shared/contexts/onboardingDraftContext';
import { PolicyConsentFlowProvider } from '../lib/policyConsentFlow';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

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

export type PolicyConsentFlowOverlayProps = {
  visible: boolean;
  profileId?: number | null;
  initialRoute?: 'PolicyScreen' | 'ConsentScreen' | 'TermScreen';
  onClose: () => void;
};

export default function PolicyConsentFlowOverlay({ visible, profileId, initialRoute, onClose }: PolicyConsentFlowOverlayProps) {
  const { lang } = useLanguage();
  const { height } = useWindowDimensions();
  const screenHeight = Math.max(height || 0, Dimensions.get('window').height || 0, 1);
  const overlayY = React.useRef(new Animated.Value(1)).current;
  const closingRef = React.useRef(false);
  const resettingRef = React.useRef(false);
  const propsInitialRoute = initialRoute ?? 'PolicyScreen';

  // Incrementing containerKey remounts the entire NavigationContainer,
  // guaranteeing zero stale state and no screen flash.
  const [containerKey, setContainerKey] = React.useState(0);
  const pendingSlideInRef = React.useRef(false);
  const hasOpenedRef = React.useRef(false);

  React.useEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      closingRef.current = false;

      try { overlayY.stopAnimation(); } catch { /* ignore */ }
      overlayY.setValue(1); // keep off-screen while container remounts

      // Remount the entire NavigationContainer so it initializes fresh
      // with the correct initialRouteName. The slide-in animation is
      // triggered by the containerKey useEffect below after React commits.
      pendingSlideInRef.current = true;
      setContainerKey(k => k + 1);
      return;
    }

    // Don't animate close if we've never opened (initial mount with visible=false)
    if (!hasOpenedRef.current) return;

    closingRef.current = true;
    Animated.timing(overlayY, {
      toValue: 1,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, overlayY]);

  // After the new NavigationContainer commits (containerKey changed), wait one
  // animation frame for the native side to render the initial screen, then slide in.
  React.useEffect(() => {
    if (!pendingSlideInRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (!pendingSlideInRef.current) return;
      pendingSlideInRef.current = false;
      Animated.timing(overlayY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => cancelAnimationFrame(raf);
  }, [containerKey, overlayY]);

  const requestClose = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [onClose]);

  const buildHeaderOptions = React.useCallback(
    (routeName: 'PolicyScreen' | 'ConsentScreen' | 'TermScreen', title: string) => ({
      headerShown: true,
      ...(propsInitialRoute === routeName
        ? {
            headerLeft: (props: any) => (
              <HeaderBackButton
                {...props}
                onPress={requestClose}
                tintColor="#064b75"
                style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginLeft: 4 }}
                pressColor="rgba(6,75,117,0.12)"
              />
            ),
          }
        : {}),
      title,
      headerTitleAlign: 'center' as const,
      headerTintColor: '#064b75',
      headerTitleStyle: { color: '#064b75' },
    }),
    [propsInitialRoute, requestClose],
  );

  const buildRootCloseListener = React.useCallback(
    (routeName: 'PolicyScreen' | 'ConsentScreen' | 'TermScreen') => {
      if (propsInitialRoute !== routeName) return undefined;

      return {
        beforeRemove: (e: any) => {
          if (resettingRef.current) return;

          const actionType = e?.data?.action?.type;
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
      };
    },
    [propsInitialRoute, requestClose],
  );

  React.useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navRef.isReady() && navRef.canGoBack()) {
        navRef.goBack();
        return true;
      }
      requestClose();
      return true;
    });

    return () => sub.remove();
  }, [visible, requestClose]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      needsOffscreenAlphaCompositing
      style={[
        styles.overlayRoot,
        {
          transform: [
            {
              translateY: overlayY.interpolate({
                inputRange: [0, 1],
                outputRange: [0, screenHeight],
                extrapolate: 'clamp',
              }),
            },
          ],
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <PolicyConsentFlowProvider close={requestClose}>
        <OnboardingDraftProvider>
          <NavigationIndependentTree>
          <IndependentNavigationContainer
              key={containerKey}
              ref={navRef as any}
            >
              <Stack.Navigator
                initialRouteName={propsInitialRoute}
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  animationDuration: 220,
                }}
              >
                <Stack.Screen
                  name="TermScreen"
                  component={TermScreen as any}
                  initialParams={{ flow: 'settings', profileId }}
                  options={() => buildHeaderOptions('TermScreen', t(lang, 'nav_terms_of_service'))}
                  listeners={buildRootCloseListener('TermScreen')}
                />
                <Stack.Screen
                  name="PolicyScreen"
                  component={PolicyScreen as any}
                  initialParams={{ flow: 'settings', profileId }}
                  options={() => buildHeaderOptions('PolicyScreen', t(lang, 'nav_privacy_policy'))}
                  listeners={buildRootCloseListener('PolicyScreen')}
                />
                <Stack.Screen
                  name="ConsentScreen"
                  component={ConsentScreen as any}
                  initialParams={{ flow: 'settings', profileId }}
                  options={() => buildHeaderOptions('ConsentScreen', t(lang, 'nav_consent'))}
                  listeners={buildRootCloseListener('ConsentScreen')}
                />
              </Stack.Navigator>
            </IndependentNavigationContainer>
          </NavigationIndependentTree>
        </OnboardingDraftProvider>
      </PolicyConsentFlowProvider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f9fafb',
    zIndex: 9999,
    elevation: 9999,
  },
});
