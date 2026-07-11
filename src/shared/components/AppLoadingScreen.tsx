import React from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors, Motion, Spacing, Typography } from '../theme/theme';
import { ToastHost } from '../ui/toast';

type Props = {
  title?: string;
  subtitle?: string;
  imageSource?: ImageSourcePropType;
  imageSize?: number;
  backgroundColor?: string;
};

export default function AppLoadingScreen({
  title = 'Well Screen',
  subtitle,
  imageSource = require('../../../assets/android-res/drawable/WellScreen512BG.png'),
  imageSize = 88,
  backgroundColor = Colors.surface,
}: Props) {
  const opacity = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: Motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: Motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} translucent={false} />
      <View style={[styles.screen, { backgroundColor }]}>
        <Animated.View style={[styles.center, { opacity }]}>
          <Image
            source={imageSource}
            style={{ width: imageSize, height: imageSize }}
            resizeMode="contain"
          />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>
      </View>
      <ToastHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: Spacing.xl,
    fontSize: Typography.size['3xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.size.sm,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
});
