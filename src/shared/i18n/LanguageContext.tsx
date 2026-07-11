import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Lang = 'en' | 'th';

type LanguageContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    (async () => {
      try {
        const stored = (await AsyncStorage.getItem('appLanguage')) as Lang | null;
        if (stored === 'en' || stored === 'th') setLangState(stored);
      } catch {}
    })();
  }, []);

  const setLang = React.useCallback((value: Lang) => {
    setLangState(value);
    AsyncStorage.setItem('appLanguage', value).catch(() => {});
  }, []);

  const ctx = React.useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return (
    <LanguageContext.Provider value={ctx}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
