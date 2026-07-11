import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  message?: string | null;
  variant?: 'error' | 'info';
  onClose?: () => void;
  position?: 'above' | 'below';
};

const TOOLTIP_WIDTH = 220;

const TooltipError: React.FC<Props> = ({
  message,
  variant = 'error',
  onClose,
  position = 'above',
}) => {
  if (!message) return null;
  const bubbleStyle = variant === 'info' ? styles.bubbleInfo : styles.bubbleError;
  const pointerStyle = variant === 'info' ? styles.pointerInfo : styles.pointerError;
  const textStyle = variant === 'info' ? styles.textInfo : styles.textError;
  return (
    <View
      style={[
        styles.wrapper,
        position === 'below' ? styles.wrapperBelow : styles.wrapperAbove,
        { transform: [{ translateX: -(TOOLTIP_WIDTH / 2) }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onClose}
        disabled={!onClose}
        hitSlop={8}
        style={styles.pressable}
        accessibilityRole={onClose ? 'button' : undefined}
        accessibilityLabel={onClose ? 'Dismiss message' : undefined}
      >
        <View style={[styles.bubbleBase, bubbleStyle, { width: TOOLTIP_WIDTH }]}>
          <Text style={[styles.textBase, textStyle]}>{message}</Text>
        </View>
        <View
          style={[
            styles.pointerBase,
            pointerStyle,
            position === 'below' ? styles.pointerBelow : styles.pointerAbove,
          ]}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: '50%',
    alignItems: 'center',
    zIndex: 30,
  },
  wrapperAbove: {
    bottom: '100%',
    marginBottom: 14,
  },
  wrapperBelow: {
    top: '100%',
    marginTop: 14,
  },
  pressable: {
    alignItems: 'center',
  },
  bubbleBase: {
    padding: 10,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  // Pastel tones
  bubbleError: { backgroundColor: '#FCA5A5' },
  bubbleInfo: { backgroundColor: '#FEF3C7' },

  textBase: { fontSize: 13 },
  textError: { color: '#111827' },
  textInfo: { color: '#111827' },

  pointerBase: {
    width: 14,
    height: 14,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    left: 12,
  },
  pointerAbove: {
    bottom: -7,
  },
  pointerBelow: {
    top: -7,
  },
  pointerError: { backgroundColor: '#FCA5A5' },
  pointerInfo: { backgroundColor: '#FEF3C7' },
});

export default TooltipError;
