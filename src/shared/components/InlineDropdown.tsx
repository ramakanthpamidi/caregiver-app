/**
 * InlineDropdown — a non-Modal dropdown overlay.
 *
 * Unlike AnchoredDropdown (which uses a native Modal), this component renders
 * an absolutely-positioned View inside the same view hierarchy. This avoids
 * the coordinate-space issues that occur when a Modal is opened from inside a
 * view rendered with `renderToHardwareTextureAndroid` (e.g. CreateProfileFlowOverlay)
 * or a DialogFrame portal layer (GoalDialog).
 *
 * Usage: render this component at the ROOT of your screen/dialog JSX so it
 * visually floats over all sibling content. Pass anchor coordinates obtained
 * from `measureInWindow`.
 */
import React from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  /** Horizontal/vertical edge inset when clamping to viewport bounds. */
  viewportPadding?: number;
  onSelect: (key: string) => void;
  onClose: () => void;
};

const ROW_HEIGHT = 48;
const MAX_DROPDOWN_HEIGHT = 280;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const InlineDropdown: React.FC<Props> = ({
  visible,
  anchor,
  options,
  selectedKey,
  unselectLabel,
  viewportPadding = 16,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  const window = Dimensions.get('window');
  const totalRows = options.length + (unselectLabel ? 1 : 0);
  const desiredMaxHeight = Math.min(ROW_HEIGHT * totalRows, MAX_DROPDOWN_HEIGHT);

  const width = Math.min(anchor.width, window.width - viewportPadding * 2);
  const anchorCenter = anchor.x + Math.round(anchor.width / 2);
  const left = clamp(
    anchorCenter - Math.round(width / 2),
    viewportPadding,
    window.width - viewportPadding - width
  );

  const availableBelow = window.height - (anchor.y + anchor.height);
  const availableAbove = anchor.y;
  const openBelow =
    availableBelow >= Math.min(desiredMaxHeight, 180) ||
    availableBelow >= availableAbove;

  const maxHeight = openBelow
    ? Math.min(desiredMaxHeight, availableBelow - viewportPadding)
    : Math.min(desiredMaxHeight, availableAbove - viewportPadding);

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
    zIndex: 9999,
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
    <>
      {/* Invisible backdrop to capture taps outside */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      {/* Dropdown popover */}
      <View style={popoverStyle}>
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
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
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
});

export default InlineDropdown;
