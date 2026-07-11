import React from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

type Props = {
  label: string;
  placeholder: string;
  values: string[];
  onChangeValues: (nextValues: string[]) => void;
  editable?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

function ensureRows(values: string[]): string[] {
  return values.length > 0 ? values : [''];
}

function compactRows(values: string[]): string[] {
  const nonEmpty = values
    .map((value) => String(value ?? ''))
    .filter((value) => value.trim().length > 0);

  // Always keep one trailing empty row so the next entry can be added naturally.
  return [...nonEmpty, ''];
}

function rowsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const DynamicTextFieldList: React.FC<Props> = ({
  label,
  placeholder,
  values,
  onChangeValues,
  editable = true,
  labelStyle,
  inputStyle,
  containerStyle,
}) => {
  const rows = ensureRows(values);

  const updateRow = React.useCallback(
    (index: number, nextText: string) => {
      if (!editable) return;

      const prevText = rows[index] ?? '';
      const next = rows.slice();
      next[index] = nextText;

      // As soon as user starts typing in the last row, show the next row immediately.
      if (
        index === rows.length - 1 &&
        prevText.trim().length === 0 &&
        nextText.trim().length > 0
      ) {
        next.push('');
      }

      onChangeValues(next);
    },
    [editable, rows, onChangeValues]
  );

  const handleBlur = React.useCallback(
    (index: number) => {
      if (!editable) return;

      const current = ensureRows(values);
      const isEmpty = !String(current[index] ?? '').trim();
      if (!isEmpty) return;

      const compacted = compactRows(current);
      if (!rowsEqual(current, compacted)) {
        onChangeValues(compacted);
      }
    },
    [editable, values, onChangeValues]
  );

  return (
    <View style={containerStyle}>
      <Text style={labelStyle}>{label}</Text>
      {rows.map((value, index) => (
        <TextInput
          key={`row-${index}`}
          value={value}
          onChangeText={(text) => updateRow(index, text)}
          onBlur={() => handleBlur(index)}
          placeholder={placeholder}
          editable={editable}
          multiline={false}
          numberOfLines={1}
          scrollEnabled={false}
          selectTextOnFocus={false}
          contextMenuHidden={true}
          disableFullscreenUI={true}
          textAlignVertical="center"
          returnKeyType="done"
          style={inputStyle}
        />
      ))}
    </View>
  );
};

export default DynamicTextFieldList;
