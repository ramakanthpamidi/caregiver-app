// components/FormInput.js
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING, shadow } from '../constants/theme';

export default function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  icon,
  required = false,
  hint,
  containerStyle,
}) {
  const [focused, setFocused]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          multiline && styles.inputWrapperMulti,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.secondary : COLORS.textMuted}
            style={styles.icon}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textDisabled}
          secureTextEntry={isPassword && !showPass}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMulti]}
        />

        {isPassword ? (
          <TouchableOpacity onPress={() => setShowPass((s) => !s)} style={styles.eyeBtn}>
            <Ionicons
              name={showPass ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textBody,
    marginBottom: SPACING.xs,
    letterSpacing: 0.2,
  },
  required: {
    color: COLORS.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    paddingHorizontal: SPACING.md,
    ...shadow.xs,
  },
  inputWrapperFocused: {
    borderColor: COLORS.secondary,
    ...shadow.sm,
  },
  inputWrapperMulti: {
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textDark,
    paddingVertical: 13,
  },
  inputMulti: {
    paddingTop: 4,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  eyeBtn: {
    padding: SPACING.xs,
  },
  hint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});