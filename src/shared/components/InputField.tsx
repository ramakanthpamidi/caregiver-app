import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BorderWidth, Colors, Layout, Radius, Spacing, Typography } from '../theme/theme';

type InputFieldProps = TextInputProps & {
  hasError?: boolean;
  rightAccessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

const InputField = React.forwardRef<TextInput, InputFieldProps>(function InputField(
  { hasError = false, rightAccessory, containerStyle, inputStyle, ...props },
  ref,
) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          hasError ? styles.inputError : null,
          rightAccessory ? styles.inputWithAccessory : null,
          inputStyle,
        ]}
        placeholderTextColor={Colors.textDisabled}
        {...props}
      />
      {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  input: {
    height: Layout.inputHeight,
    borderWidth: BorderWidth.sm,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: Colors.surfaceMuted,
    includeFontPadding: false,
    fontSize: 15,
    lineHeight: Typography.lineHeight.sm,
    color: Colors.text,
  },
  inputWithAccessory: {
    paddingRight: 48,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  rightAccessory: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InputField;
