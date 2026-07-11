import React from 'react';
import { View, StyleSheet, StatusBar, Animated, BackHandler, Dimensions, Easing } from 'react-native';
import { DefaultTheme, NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { Colors } from '../../../shared/theme/theme';
import DataManagementScreen from '../screens/DataManagementScreen';

export type DataManagementOverlayProps = {
  visible: boolean;
  profileId?: number | null;
  onClose?: () => void;
};

export default function DataManagementOverlay({ visible, onClose }: DataManagementOverlayProps) {
  const [mounted, setMounted] = React.useState<boolean>(visible);
  const anim = React.useRef(new Animated.Value(0)).current; // 0 hidden -> 1 visible
  const windowH = Dimensions.get('window').height;

  React.useEffect(() => {
    if (!mounted) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });

    return () => sub.remove();
  }, [mounted, onClose]);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [windowH, 0] });

  return (
    <View style={styles.absContainer} pointerEvents="box-none">
      {/* Force status bar to pure white */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        <NavigationIndependentTree>
          <NavigationContainer theme={DefaultTheme}>
            <DataManagementScreen onCloseOverlay={onClose} />
          </NavigationContainer>
        </NavigationIndependentTree>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  absContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
