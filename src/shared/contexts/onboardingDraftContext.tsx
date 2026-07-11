import React, { createContext, useContext, useMemo, useState } from 'react';

export type LegalAcceptance = {
  tosAccepted: boolean;
  policyAccepted: boolean;
  consentAccepted: boolean;
};

export type ConsentAcknowledgement = {
  acknowledged: boolean;
};

export type SignupDraft = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type OnboardingDraftContextValue = {
  legalAcceptance: LegalAcceptance;
  setLegalAcceptance: React.Dispatch<React.SetStateAction<LegalAcceptance>>;

  consentAcknowledgement: ConsentAcknowledgement;
  setConsentAcknowledgement: React.Dispatch<React.SetStateAction<ConsentAcknowledgement>>;

  signupDraft: SignupDraft;
  setSignupDraft: React.Dispatch<React.SetStateAction<SignupDraft>>;

  resetDraft: () => void;
};

const OnboardingDraftContext = createContext<OnboardingDraftContextValue | undefined>(undefined);

export const OnboardingDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [legalAcceptance, setLegalAcceptance] = useState<LegalAcceptance>({
    tosAccepted: false,
    policyAccepted: false,
    consentAccepted: false,
  });

  const [consentAcknowledgement, setConsentAcknowledgement] = useState<ConsentAcknowledgement>({ acknowledged: false });


  const [signupDraft, setSignupDraft] = useState<SignupDraft>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const resetDraft = () => {
    setLegalAcceptance({ tosAccepted: false, policyAccepted: false, consentAccepted: false });
    setConsentAcknowledgement({ acknowledged: false });
    setSignupDraft({ name: '', email: '', password: '', confirmPassword: '' });
  };

  const value = useMemo<OnboardingDraftContextValue>(
    () => ({
      legalAcceptance,
      setLegalAcceptance,
      consentAcknowledgement,
      setConsentAcknowledgement,
      signupDraft,
      setSignupDraft,
      resetDraft,
    }),
    [legalAcceptance, consentAcknowledgement, signupDraft]
  );

  return <OnboardingDraftContext.Provider value={value}>{children}</OnboardingDraftContext.Provider>;
};

export const useOnboardingDraft = () => {
  const ctx = useContext(OnboardingDraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within an OnboardingDraftProvider');
  return ctx;
};
