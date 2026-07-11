import React from 'react';
import { LanguageProvider } from '../../shared/i18n/LanguageContext';
import { OnboardingDraftProvider } from '../../shared/contexts/onboardingDraftContext';

type AppProvidersProps = {
  children: React.ReactNode;
};

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <LanguageProvider>
      <OnboardingDraftProvider>{children}</OnboardingDraftProvider>
    </LanguageProvider>
  );
}
