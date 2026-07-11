import React from 'react';
import { Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearModalVisualProgress, popModal, pushModal, setModalVisualProgress } from '../ui/statusBarManager';
import { useDialogPortal } from './DialogPortalProvider';

const FADE_IN_MS = 200;
const FADE_OUT_MS = 200;

type Props = {
  visible: boolean;
  onRequestClose?: () => void;
  disableBackdropClose?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  cardStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

const DialogFrame: React.FC<Props> = ({ visible, onRequestClose, disableBackdropClose, cardStyle, children }) => {
  const portal = useDialogPortal();
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const navProgress = React.useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(false);
  const pushedRef = React.useRef(false);
  const openAnimRef = React.useRef<(() => void) | null>(null);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const portalIdRef = React.useRef(`dialog-frame-${Math.random().toString(36).slice(2)}`);
  const navVisualIdRef = React.useRef(`dialog-nav-${Math.random().toString(36).slice(2)}`);

  const frozenChildrenRef = React.useRef<React.ReactNode>(null);
  if (visible) {
    frozenChildrenRef.current = children;
  }
  const displayChildren = visible ? children : frozenChildrenRef.current;

  React.useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardOpen(true);
      const h = Number((e as any)?.endCoordinates?.height);
      setKeyboardHeight(Number.isFinite(h) ? h : 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  React.useEffect(() => {
    const listenerId = navProgress.addListener(({ value }) => {
      setModalVisualProgress(navVisualIdRef.current, value);
    });
    setModalVisualProgress(navVisualIdRef.current, 0);

    return () => {
      navProgress.removeListener(listenerId);
      clearModalVisualProgress(navVisualIdRef.current);
    };
  }, [navProgress]);

  React.useEffect(() => {
    if (visible && !mounted) {
      opacity.setValue(0);
      navProgress.setValue(0);
      setMounted(true);

      const startOpenAnimation = () => {
        if (!pushedRef.current) {
          pushedRef.current = true;
          try { pushModal(); } catch {}
        }
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(navProgress, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]).start();
      };

      let cancelled = false;
      let id1 = 0;
      let id2 = 0;

      id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => {
          if (cancelled) return;
          startOpenAnimation();
        });
        if (cancelled && id2) cancelAnimationFrame(id2);
      });

      openAnimRef.current = () => {
        cancelled = true;
        if (id1) cancelAnimationFrame(id1);
        if (id2) cancelAnimationFrame(id2);
      };
    } else if (!visible && mounted) {
      openAnimRef.current?.();
      openAnimRef.current = null;

      if (pushedRef.current) {
        pushedRef.current = false;
        try { popModal(); } catch {}
      }

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(navProgress, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [mounted, navProgress, opacity, visible]);

  React.useEffect(() => {
    return () => {
      openAnimRef.current?.();
      openAnimRef.current = null;
      if (pushedRef.current) {
        pushedRef.current = false;
        try { popModal(); } catch {}
      }
    };
  }, []);

  // Always keep a stable ref for onRequestClose so the BackHandler
  // only re-registers when mounted changes, not on every render.
  const onRequestCloseRef = React.useRef(onRequestClose);
  React.useLayoutEffect(() => { onRequestCloseRef.current = onRequestClose; });
  const hasRequestClose = Boolean(onRequestClose);

  // Bind directly to Android hardware back while a portal-backed dialog is mounted.
  // Registering on the next frame makes this listener sit above navigator listeners,
  // so pressing back closes the active dialog before underlying screens react.
  React.useEffect(() => {
    if (!portal || !mounted || !hasRequestClose) return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      sub = BackHandler.addEventListener('hardwareBackPress', () => {
        console.log('[DialogFrame] hardwareBackPress handler called');
        if (!onRequestCloseRef.current) return false;
        onRequestCloseRef.current();
        return true;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      sub?.remove();
    };
  }, [hasRequestClose, mounted, portal]);

  // Register with the shared portal back stack so the topmost portal overlay
  // always handles Android back first.
  React.useEffect(() => {
    if (!portal) return;
    if (!mounted) {
      portal.removeBackHandler(portalIdRef.current);
      return;
    }
    portal.setBackHandler(portalIdRef.current, () => {
      if (!onRequestCloseRef.current) return false;
      onRequestCloseRef.current();
      return true;
    });
    return () => portal.removeBackHandler(portalIdRef.current);
  }, [portal, mounted]);

  // Cleanup portal entry on unmount.
  React.useEffect(() => {
    return () => {
      portal?.removeBackHandler(portalIdRef.current);
      portal?.removeEntry(portalIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackdropPress = React.useCallback(() => {
    console.log('[DialogFrame] backdrop pressed', { disableBackdropClose });
    if (disableBackdropClose) return;
    onRequestClose?.();
  }, [disableBackdropClose, onRequestClose]);

  const overlayPadding = 18;
  const overlayPaddingTop = overlayPadding + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
  const backdropBottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const keyboardOpenBottomPadding = 18;

  const frameBody = (
    <Animated.View style={[styles.overlayAnim, { opacity }]} needsOffscreenAlphaCompositing>
      <View style={[styles.overlay, { paddingTop: overlayPaddingTop, paddingHorizontal: overlayPadding, paddingBottom: overlayPadding }]}>
        <Pressable
          style={[
            styles.backdropTouch,
            backdropBottomInset > 0 ? { bottom: backdropBottomInset } : null,
          ]}
          onPress={handleBackdropPress}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={[styles.kav, keyboardOpen ? styles.kavKeyboardOpen : null]}
          pointerEvents="box-none"
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardOpen ? styles.scrollContentKeyboardOpen : null,
              keyboardOpen && keyboardHeight > 0
                ? { paddingBottom: keyboardHeight + keyboardOpenBottomPadding }
                : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={[styles.card, cardStyle]} onPress={() => {}}>
              {displayChildren}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Animated.View>
  );

  // Portal: inject/remove the dialog from the shared portal layer.
  React.useEffect(() => {
    if (!portal) return;
    if (!mounted) {
      portal.removeEntry(portalIdRef.current);
      return;
    }
    portal.setEntry(
      portalIdRef.current,
      <View style={styles.portalRoot} pointerEvents="box-none">
        {frameBody}
      </View>,
    );
  }, [frameBody, mounted, portal]);

  if (!mounted) return null;

  // In portal mode the dialog is rendered via the portal layer (same Android
  // window as the Activity) so NavigationBarColor.setColor works correctly.
  if (portal) return null;

  // Fallback for screens not wrapped in DialogPortalProvider.
  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={onRequestClose}
    >
      {frameBody}
    </Modal>
  );
};

const styles = StyleSheet.create({
  portalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10001,
    elevation: 10001,
  },
  overlayAnim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
  },
  kav: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  kavKeyboardOpen: {
    justifyContent: 'flex-start',
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  scrollContentKeyboardOpen: {
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
});

export default DialogFrame;
