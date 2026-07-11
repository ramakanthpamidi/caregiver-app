import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DialogFrame from './DialogFrame';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  primaryText?: string;
  primaryVariant?: 'default' | 'danger';
  secondaryText?: string;
  onClose: () => void;
  onSecondary?: () => void;
};

const InfoDialog: React.FC<Props> = ({
  visible,
  title,
  message,
  primaryText = 'OK',
  primaryVariant = 'default',
  secondaryText,
  onClose,
  onSecondary,
}) => {
  return (
    <DialogFrame visible={visible} onRequestClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>

      <View style={styles.buttonsRow}>
        {secondaryText ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onSecondary || onClose}>
            <Text style={styles.secondaryText}>{secondaryText}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.primaryButton, primaryVariant === 'danger' ? styles.primaryButtonDanger : null]}
          onPress={onClose}
        >
          <Text style={styles.primaryText}>{primaryText}</Text>
        </TouchableOpacity>
      </View>
    </DialogFrame>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryText: {
    color: '#111827',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#064b75',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryButtonDanger: {
    // Match the destructive button color used in RemoveDeviceDialog.
    backgroundColor: '#DC2626',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
});

export default InfoDialog;
