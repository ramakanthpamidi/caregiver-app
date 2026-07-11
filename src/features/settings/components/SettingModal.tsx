import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { clearModalVisualProgress, pushModal, popModal, setModalVisualProgress } from '../../../shared/ui/statusBarManager';
import { BorderWidth, Colors, Radius, Spacing } from '../../../shared/theme/theme';

export type SettingModalHandle = {
  close: () => void;
};

export type SettingModalProps = {
  visible: boolean;
  onRequestClose?: () => void;
  children?: React.ReactNode;
};

const SettingModal = React.memo(
  React.forwardRef<SettingModalHandle, SettingModalProps>(function SettingModal(
    { visible, onRequestClose, children },
    ref
  ) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const backdrop = useRef(new Animated.Value(0)).current;
    const navProgress = useRef(new Animated.Value(0)).current;
    const [mounted, setMounted] = useState(visible);
    const didPushRef = useRef(false);
    const openAnimRef = useRef<(() => void) | null>(null);
    const navVisualIdRef = useRef(`setting-modal-nav-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
      const listenerId = navProgress.addListener(({ value }) => {
        setModalVisualProgress(navVisualIdRef.current, value);
      });
      setModalVisualProgress(navVisualIdRef.current, 0);

      return () => {
        navProgress.removeListener(listenerId);
        clearModalVisualProgress(navVisualIdRef.current);
      };
    }, [navProgress]);

    const doClose = useCallback(
      (callOnRequest = true) => {
        Animated.parallel([
          Animated.timing(backdrop, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.in(Easing.cubic),
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
            easing: Easing.in(Easing.cubic),
          }),
          Animated.timing(navProgress, {
            toValue: 0,
            duration: 220,
            useNativeDriver: false,
            easing: Easing.in(Easing.cubic),
          }),
        ]).start(() => {
          if (didPushRef.current) {
            didPushRef.current = false;
            try {
              popModal();
            } catch {
              // ignore
            }
          }
          setMounted(false);
          if (callOnRequest && typeof onRequestClose === 'function') onRequestClose();
        });
      },
      [backdrop, fadeAnim, navProgress, onRequestClose]
    );

    // Handle open/close transitions.
    // Fade-in starts after two rAFs (~33ms) so layout settles before animating,
    // without the 300-700ms Android onShow delay.
    useEffect(() => {
      if (visible && !mounted) {
        // Reset animation values BEFORE mounting to prevent flash
        fadeAnim.setValue(0);
        backdrop.setValue(0);
        navProgress.setValue(0);
        if (!didPushRef.current) {
          didPushRef.current = true;
          try { pushModal(); } catch {}
        }
        setMounted(true);
        let cancelled = false;
        const id1 = requestAnimationFrame(() => {
          const id2 = requestAnimationFrame(() => {
            if (cancelled) return;
            Animated.parallel([
              Animated.timing(backdrop, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
                easing: Easing.out(Easing.cubic),
              }),
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
                easing: Easing.out(Easing.cubic),
              }),
              Animated.timing(navProgress, {
                toValue: 1,
                duration: 150,
                useNativeDriver: false,
                easing: Easing.out(Easing.cubic),
              }),
            ]).start();
          });
          if (cancelled) cancelAnimationFrame(id2);
        });
        openAnimRef.current = () => { cancelled = true; cancelAnimationFrame(id1); };
      } else if (!visible && mounted) {
        openAnimRef.current?.();
        openAnimRef.current = null;
        doClose(false);
      }
    }, [visible, mounted, backdrop, doClose, fadeAnim, navProgress]);

    useEffect(() => {
      // Safety: if this component unmounts while still "open", ensure we decrement.
      return () => {
        openAnimRef.current?.();
        openAnimRef.current = null;
        if (didPushRef.current) {
          didPushRef.current = false;
          try {
            popModal();
          } catch {
            // ignore
          }
        }
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        close: () => doClose(true),
      }),
      [doClose]
    );

    if (!mounted) return null;

    const childArray = React.Children.toArray(children);
    const headerChild = childArray.length > 0 ? childArray[0] : null;
    const bodyChildren = childArray.length > 1 ? childArray.slice(1) : [];

    return (
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        hardwareAccelerated
        onRequestClose={() => doClose(true)}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => doClose(true)}>
            <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.sheet, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('screen').height, 0] }) }] }]}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              stickyHeaderIndices={headerChild ? [0] : undefined}
              showsVerticalScrollIndicator={false}
            >
              {headerChild ? <View style={styles.stickyHeader}>{headerChild}</View> : null}
              {bodyChildren}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  })
);

export default SettingModal;

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  sheet: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    maxHeight: '70%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  scroll: {
    // keep ScrollView full width of sheet
  },
  scrollContent: {
    paddingBottom: 54,
  },
  stickyHeader: {
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.md,
    paddingTop: 2,
    borderBottomWidth: BorderWidth.sm,
    borderBottomColor: Colors.borderSoft,
    zIndex: 2,
  },
});
