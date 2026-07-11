import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingDraft } from '../../../shared/contexts/onboardingDraftContext';
import { useAppNavigation } from '../../../shared/navigation/useAppNavigation';
import { CONSENT_NOTICE } from '../content/consentNotice';
import { CONSENT_NOTICE_TH } from '../content/consentNotice.th';
import { usePolicyConsentFlowClose } from '../lib/policyConsentFlow';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { t } from '../../../shared/i18n';

const KEY_PENDING_PROFILE_CONSENTS = 'pendingProfileConsents.v1';

const ConsentScreen: React.FC = () => {
  const { navigate, goBack, resetTo, params } = useAppNavigation();
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const onboarding = useOnboardingDraft();
  const closeOverlay = usePolicyConsentFlowClose();
  const notice = lang === 'th' ? CONSENT_NOTICE_TH : CONSENT_NOTICE;

  const flow = params?.flow;
  const isSettingsFlow = flow === 'settings';
  const [hasReachedBottom, setHasReachedBottom] = useState(
    onboarding.legalAcceptance.consentAccepted ||
      onboarding.consentAcknowledgement.acknowledged,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const footerPaddingBottom = 18 + Math.max(insets.bottom, 10);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleAccept = () => {
    if (isSettingsFlow) {
      if (closeOverlay) closeOverlay();
      else goBack();
      return;
    }

    if (!hasReachedBottom) {
      scrollToBottom();
      return;
    }

    onboarding.setConsentAcknowledgement({ acknowledged: true });
    onboarding.setLegalAcceptance(prev => ({ ...prev, consentAccepted: true }));

    // Persist for post-login profile creation flow.
    // ConsentScreen runs before a profile exists, so we queue it for later.
    AsyncStorage.setItem(
      KEY_PENDING_PROFILE_CONSENTS,
      JSON.stringify({
        version: 2,
        consentGranted: true,
        consentChoices: { 1: true, 2: true, 3: true, 4: true },
        acknowledged: true,
        savedAt: new Date().toISOString(),
      }),
    ).catch(() => {
      // Non-fatal; we'll still proceed.
    });

    const flowParam = params?.flow;
    if (flowParam === 'addProfile') {
      // In-app add-profile flow: proceed to CreateProfile screen.
      navigate('CreateProfile');
      return;
    }

    // Default onboarding flow (pre-login).
    resetTo('Signup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={e => {
          const { layoutMeasurement, contentOffset, contentSize } =
            e.nativeEvent;
          const paddingToBottom = 24;
          const atBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;
          if (atBottom && !hasReachedBottom) setHasReachedBottom(true);
        }}
      >
        <View style={styles.header}>
          <Text style={styles.headerBody}>{t(lang, 'consent_header1')}</Text>
          <Text style={styles.headerBody}>{t(lang, 'consent_header2')}</Text>
          <View style={styles.divider} />

          <Text style={styles.meta}>{notice.title}</Text>
          <Text style={styles.meta}>
            {t(lang, 'last_updated')} {notice.lastUpdated}
          </Text>

          {notice.introParagraphs.map(p => (
            <Text key={p} style={styles.headerBody}>
              {p}
            </Text>
          ))}
        </View>

        {notice.options.map((opt, idx) => (
          <View key={opt.key} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {idx + 1}. {opt.title}
            </Text>

            <Text style={styles.paragraph}>{t(lang, 'data_involved')}</Text>
            <View style={styles.bulletList}>
              {opt.dataInvolved.map(item => (
                <Text key={`${opt.key}-d-${item}`} style={styles.bulletItem}>
                  • {item}
                </Text>
              ))}
            </View>

            <Text style={styles.paragraph}>{t(lang, 'purpose')}</Text>
            <View style={styles.bulletList}>
              {opt.purposes.map(item => (
                <Text key={`${opt.key}-p-${item}`} style={styles.bulletItem}>
                  • {item}
                </Text>
              ))}
            </View>

            {opt.noticeTitle ? (
              <Text style={styles.paragraph}>{opt.noticeTitle}</Text>
            ) : null}
            {opt.noticeBody ? (
              <Text style={styles.paragraph}>{opt.noticeBody}</Text>
            ) : null}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            5. {notice.acknowledgement.title}
          </Text>
          <Text style={styles.paragraph}>{notice.acknowledgement.intro}</Text>
          <View style={styles.bulletList}>
            {notice.acknowledgement.bullets.map(b => (
              <Text key={`ack-${b}`} style={styles.bulletItem}>
                • {b}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
        {isSettingsFlow ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleAccept}
          >
            <Text style={styles.buttonText}>{t(lang, 'close')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={handleAccept}
          >
            <Text style={styles.buttonText}>{t(lang, 'accept_continue')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

import styles from './ConsentScreen.styles';

export default ConsentScreen;
