import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  message: string | null;
  visible: boolean;
  variant?: 'success' | 'error' | 'info';
  topOffset?: number;
};

const TopToast: React.FC<Props> = ({ message, visible, variant = 'info', topOffset = 10 }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 160 : 140,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  if (!message && !visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  const cardStyle =
    variant === 'error' ? styles.cardError : variant === 'success' ? styles.cardSuccess : styles.cardInfo;
  const textStyle =
    variant === 'error' ? styles.textDark : variant === 'success' ? styles.textLight : styles.textLight;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + Math.max(0, topOffset),
          opacity: anim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.cardBase, cardStyle]}>
        <Text style={[styles.textBase, textStyle]} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  cardBase: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  // Match TooltipError error bubble red.
  cardError: {
    backgroundColor: '#FCA5A5',
  },
  cardInfo: {
    backgroundColor: '#111827',
  },
  cardSuccess: {
    backgroundColor: '#16a34a',
  },
  textBase: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#111827',
  },
});

export default TopToast;
