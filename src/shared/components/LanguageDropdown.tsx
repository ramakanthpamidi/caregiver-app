import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

const OPTIONS: { value: 'en' | 'th'; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'th', label: 'ไทย', flag: '🇹🇭' },
];

const LanguageDropdown: React.FC = () => {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const current = OPTIONS.find((o) => o.value === lang) || OPTIONS[0];
  const anchorRef = React.useRef<View>(null);
  const [anchorLayout, setAnchorLayout] = React.useState({ x: 0, y: 0, w: 0, h: 0 });

  const measure = () => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setAnchorLayout({ x, y, w, h });
    });
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        ref={anchorRef}
        style={styles.button}
        activeOpacity={0.75}
        onPress={() => {
          measure();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Change language"
      >
        <Text style={styles.flag}>{current.flag}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                top: anchorLayout.y + anchorLayout.h + 4,
                right: 16,
              },
            ]}
          >
            {OPTIONS.map((opt) => {
              const selected = opt.value === lang;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.menuItem, selected ? styles.menuItemSelected : null]}
                  activeOpacity={0.75}
                  onPress={() => {
                    setLang(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.menuFlag}>{opt.flag}</Text>
                  <Text style={[styles.menuLabel, selected ? styles.menuLabelSelected : null]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8,
    right: 16,
    zIndex: 100,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  flag: {
    fontSize: 18,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  menuItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  menuFlag: {
    fontSize: 16,
    marginRight: 10,
  },
  menuLabel: {
    fontSize: 14,
    color: '#374151',
  },
  menuLabelSelected: {
    fontWeight: '700',
    color: '#064b75',
  },
});

export default LanguageDropdown;
