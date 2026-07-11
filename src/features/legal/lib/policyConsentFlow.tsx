import React from 'react';

export type PolicyConsentFlowController = {
  close: () => void;
};

const PolicyConsentFlowContext = React.createContext<PolicyConsentFlowController | null>(null);

export function PolicyConsentFlowProvider({ close, children }: { close: () => void; children: React.ReactNode }) {
  return <PolicyConsentFlowContext.Provider value={{ close }}>{children}</PolicyConsentFlowContext.Provider>;
}

export function usePolicyConsentFlowClose(): (() => void) | null {
  return React.useContext(PolicyConsentFlowContext)?.close ?? null;
}
