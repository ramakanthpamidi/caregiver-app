import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '../theme/theme';

export type DropdownOption = {
  key: string;
  label: string;
};

type AnchorLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  anchor: AnchorLayout;
  options: DropdownOption[];
  selectedKey: string | null;
  /** Optional "unselect" row at the top of the list. */
  unselectLabel?: string;
  anchorMask?: {
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    text: string;
    placeholder?: boolean;
  };
  onSelect: (key: string) => void;
  onClose: () => void;
};

const ROW_HEIGHT = 48;
const MAX_DROPDOWN_HEIGHT = 280;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const AnchoredDropdown: React.FC<Props> = ({
  visible,
  anchor,
  options,
  selectedKey,
  unselectLabel,
  anchorMask,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  const window = Dimensions.get('window');
  const totalRows = options.length + (unselectLabel ? 1 : 0);
  const desiredMaxHeight = Math.min(ROW_HEIGHT * totalRows, MAX_DROPDOWN_HEIGHT);

  const width = Math.min(anchor.width, window.width - 32);
  const anchorCenter = anchor.x + Math.round(anchor.width / 2);
  const left = clamp(anchorCenter - Math.round(width / 2), 16, window.width - 16 - width);

  const availableBelow = window.height - (anchor.y + anchor.height);
  const availableAbove = anchor.y;
  const openBelow =
    availableBelow >= Math.min(desiredMaxHeight, 180) ||
    availableBelow >= availableAbove;

  const maxHeight = openBelow
    ? Math.min(desiredMaxHeight, availableBelow - 16)
    : Math.min(desiredMaxHeight, availableAbove - 16);

  const popoverStyle: any = {
    position: 'absolute',
    left,
    width,
    maxHeight,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 20,
  };

  if (openBelow) {
    popoverStyle.top = anchor.y + anchor.height;
    popoverStyle.borderLeftWidth = 1;
    popoverStyle.borderRightWidth = 1;
    popoverStyle.borderBottomWidth = 1;
    popoverStyle.borderTopWidth = 0;
    popoverStyle.borderTopLeftRadius = 0;
    popoverStyle.borderTopRightRadius = 0;
    popoverStyle.borderBottomLeftRadius = Radius.md;
    popoverStyle.borderBottomRightRadius = Radius.md;
  } else {
    popoverStyle.bottom = window.height - anchor.y;
    popoverStyle.borderLeftWidth = 1;
    popoverStyle.borderRightWidth = 1;
    popoverStyle.borderTopWidth = 1;
    popoverStyle.borderBottomWidth = 0;
    popoverStyle.borderBottomLeftRadius = 0;
    popoverStyle.borderBottomRightRadius = 0;
    popoverStyle.borderTopLeftRadius = Radius.md;
    popoverStyle.borderTopRightRadius = Radius.md;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={popoverStyle} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {unselectLabel ? (
              <Pressable
                style={[
                  styles.option,
                  styles.optionFirst,
                  !selectedKey ? styles.optionSelected : null,
                ]}
                onPress={() => onSelect('')}
              >
                <View style={styles.optionRow}>
                  <Text style={[styles.optionText, styles.unselectText]}>
                    {unselectLabel}
                  </Text>
                  {!selectedKey ? <Text style={styles.check}>✓</Text> : null}
                </View>
              </Pressable>
            ) : null}
            {options.map((opt) => {
              const isSelected = opt.key === selectedKey;
              return (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.option,
                    !unselectLabel && opt === options[0] ? styles.optionFirst : null,
                    isSelected ? styles.optionSelected : null,
                  ]}
                  onPress={() => onSelect(opt.key)}
                >
                  <View style={styles.optionRow}>
                    <Text style={styles.optionText}>{opt.label}</Text>
                    {isSelected ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
        {anchorMask ? (
          <View
            pointerEvents="none"
            style={[
              styles.anchorMask,
              {
                left: anchor.x,
                top: anchor.y,
                width: anchor.width,
                height: anchor.height,
              },
            ]}
          >
            <Ionicons name={anchorMask.iconName} size={18} color={Colors.primary} />
            <Text
              style={[
                styles.anchorMaskText,
                anchorMask.placeholder ? styles.anchorMaskPlaceholder : null,
              ]}
            >
              {anchorMask.text}
            </Text>
            <Ionicons name="chevron-up" size={18} color={Colors.primary} />
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionFirst: {
    borderTopWidth: 0,
  },
  optionText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  unselectText: {
    color: Colors.textSubtle,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionSelected: {
    backgroundColor: Colors.gray100,
  },
  check: {
    color: Colors.primary,
    fontWeight: '900',
    fontSize: 16,
  },
  anchorMask: {
    position: 'absolute',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  anchorMaskText: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  anchorMaskPlaceholder: {
    color: Colors.textDisabled,
  },
});

export default AnchoredDropdown;
