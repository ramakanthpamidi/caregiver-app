import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import DialogFrame from '../../../shared/components/DialogFrame';

type Props = {
  visible: boolean;
  title: string;
  value: string;
  onChangeValue: (v: string) => void;
  errorText?: string | null;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

const NamePromptModal: React.FC<Props> = ({
  visible,
  title,
  value,
  onChangeValue,
  errorText,
  submitting,
  onCancel,
  onSubmit,
}) => {
  return (
    <DialogFrame visible={visible} onRequestClose={onCancel}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>

        <TextInput
          value={value}
          onChangeText={onChangeValue}
          placeholder="User name"
          autoCapitalize="words"
          style={[styles.input, errorText ? styles.inputError : null]}
          multiline={false}
          numberOfLines={1}
          scrollEnabled={false}
          selectTextOnFocus={false}
          contextMenuHidden={true}
          disableFullscreenUI={true}
          textAlignVertical="center"
        />


        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onCancel} disabled={submitting}>
            <Text style={[styles.btnText, styles.btnTextSecondary]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, submitting ? { opacity: 0.8 } : null]} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </DialogFrame>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 48,
    backgroundColor: '#fff',
    includeFontPadding: false,
  },
  inputError: { borderColor: '#b22121' },
  errorText: { marginTop: 8, color: '#b22121', fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#064b75' },
  btnSecondary: { backgroundColor: '#F3F4F6' },
  btnText: { color: '#fff', fontWeight: '800' },
  btnTextSecondary: { color: '#111827' },
});

export default NamePromptModal;
