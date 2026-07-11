import React, { useRef, useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LegalSections from '../../../shared/components/LegalSections';
import { PRIVACY_POLICY_SECTIONS } from '../content/privacyPolicy';
import { PRIVACY_POLICY_SECTIONS_TH } from '../content/privacyPolicy.th';
import { useOnboardingDraft } from '../../../shared/contexts/onboardingDraftContext';
import { useAppNavigation } from '../../../shared/navigation/useAppNavigation';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';
import styles from './PolicyScreen.styles';

const PolicyScreen: React.FC = () => {
  const { navigate, params } = useAppNavigation();
  const { lang } = useLanguage();
  const onboarding = useOnboardingDraft();
  const flow = params?.flow;
  const isSettingsFlow = flow === 'settings';
  const insets = useSafeAreaInsets();
  const profileId = params?.profileId;
  const [accepted, setAccepted] = useState(onboarding.legalAcceptance.policyAccepted);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sections = lang === 'th' ? PRIVACY_POLICY_SECTIONS_TH : PRIVACY_POLICY_SECTIONS;
  const footerPaddingBottom = 18 + Math.max(insets.bottom, 10);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleToggleAccepted = () => {
    if (isSettingsFlow) return;
    if (!hasReachedBottom) {
      scrollToBottom();
      return;
    }
    setAccepted((v) => {
      const next = !v;
      onboarding.setLegalAcceptance((prev) => ({ ...prev, policyAccepted: next }));
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
        <View style={styles.header}>
          <Text style={styles.headerBody}>{t(lang, 'policy_header1')}</Text>
          {isSettingsFlow ? null : <Text style={styles.headerBody}>{t(lang, 'term_header2')}</Text>}
          <View style={styles.divider} />
        </View>

        <LegalSections
          sections={sections}
          styles={{
            section: styles.section,
            sectionTitle: styles.sectionTitle,
            subTitle: styles.subTitle,
            paragraph: styles.paragraph,
            bulletList: styles.bulletList,
            bulletItem: styles.bulletItem,
          }}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        {isSettingsFlow ? (
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              navigate('ConsentScreen', {
                flow: 'settings',
                profileId,
              });
            }}
          >
            <Text style={styles.buttonText}>{t(lang, 'next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.checkboxRow} activeOpacity={0.8} onPress={handleToggleAccepted}>
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>{accepted && <Text style={styles.checkmark}>✓</Text>}</View>
            <Text style={styles.checkboxText}>{t(lang, 'policy_checkbox')}</Text>
          </TouchableOpacity>
        )}

        {!isSettingsFlow ? (
          <TouchableOpacity
            style={[
              styles.button,
              !accepted && styles.buttonDisabled,
            ]}
            disabled={!accepted}
            onPress={() => {
              navigate('ConsentScreen', { flow: flow || 'signup' });
            }}
          >
            <Text style={styles.buttonText}>{t(lang, 'accept_continue')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

// styles moved to PolicyScreen.styles.ts

export default PolicyScreen;
