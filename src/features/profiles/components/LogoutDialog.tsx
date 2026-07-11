import React from 'react';
import { BackHandler, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DialogFrame from '../../../shared/components/DialogFrame';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  onRequestClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
};

const LogoutDialog: React.FC<Props> = ({
  visible,
  title,
  message,
  onRequestClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  const onRequestCloseRef = React.useRef(onRequestClose);

  React.useLayoutEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  React.useEffect(() => {
    if (!visible || !onRequestClose) return;

    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!onRequestCloseRef.current) return false;
        onRequestCloseRef.current();
        return true;
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      sub?.remove();
    };
  }, [onRequestClose, visible]);

  return (
    <DialogFrame visible={visible} onRequestClose={onRequestClose}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onRequestClose}>
          <Text style={styles.secondaryText}>{cancelText}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={onConfirm}>
          <Text style={styles.primaryText}>{confirmText}</Text>
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
    marginBottom: 10,
  },
  message: { fontSize: 13, lineHeight: 20, color: '#374151', marginBottom: 10 },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: '#064b75',
    fontWeight: '800',
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryText: { color: '#fff', fontWeight: '800' },
});

export default LogoutDialog;
