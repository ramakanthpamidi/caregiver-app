import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingDraft } from '../../../shared/contexts/onboardingDraftContext';
import LegalSections from '../../../shared/components/LegalSections';
import { useAppNavigation } from '../../../shared/navigation/useAppNavigation';
import { TERMS_OF_SERVICE_SECTIONS } from '../content/termsOfService';
import { TERMS_OF_SERVICE_SECTIONS_TH } from '../content/termsOfService.th';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import styles from './TermScreen.styles';

const TermScreen: React.FC = () => {
  const { navigate, params } = useAppNavigation();
  const { lang } = useLanguage();
  const flow = params?.flow as string | undefined;
  const profileId = params?.profileId;
  const inSettingsFlow = flow === 'settings';
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingDraft();
  const [accepted, setAccepted] = useState(onboarding.legalAcceptance.tosAccepted);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sections = lang === 'th' ? TERMS_OF_SERVICE_SECTIONS_TH : TERMS_OF_SERVICE_SECTIONS;
  const footerPaddingBottom = 16 + Math.max(insets.bottom, 10);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleToggleAccepted = () => {
    if (!hasReachedBottom) {
      scrollToBottom();
      return;
    }
    setAccepted((v) => {
      const next = !v;
      onboarding.setLegalAcceptance((prev) => ({ ...prev, tosAccepted: next }));
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const paddingToBottom = 24;
          const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
          if (atBottom && !hasReachedBottom) setHasReachedBottom(true);
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBody}>{t(lang, 'term_header1')}</Text>
          <Text style={styles.headerBody}>{t(lang, 'term_header2')}</Text>
          <View style={styles.divider} />
        </View>

        <LegalSections
          sections={sections}
          styles={{
            section: styles.section,
            sectionTitle: styles.sectionTitle,
            paragraph: styles.paragraph,
            bulletList: styles.bulletList,
            bulletItem: styles.bulletItem,
          }}
        />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        {inSettingsFlow ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              navigate('PolicyScreen', {
                flow: 'settings',
                profileId,
              });
            }}
          >
            <Text style={styles.buttonText}>{t(lang, 'next')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.checkboxRow}
              activeOpacity={0.8}
              onPress={handleToggleAccepted}
            >
              <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                {accepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxText}>
                {t(lang, 'term_checkbox')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !accepted && styles.buttonDisabled]}
              disabled={!accepted}
              onPress={() => {
                if (!hasReachedBottom) {
                  scrollToBottom();
                  return;
                }
                const nextFlow = inSettingsFlow ? 'settings' : (flow || 'signup');
                navigate('PolicyScreen', { flow: nextFlow });
              }}
            >
              <Text style={styles.buttonText}>{t(lang, 'accept_continue')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

// styles moved to TermScreen.styles.ts

export default TermScreen;
