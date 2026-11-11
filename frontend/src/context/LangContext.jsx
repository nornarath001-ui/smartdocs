import { createContext, useContext, useEffect, useState } from 'react';
import { translations } from '../i18n/translations';
import { extra } from '../i18n/extra';

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'km');

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) =>
    translations[lang]?.[key] ?? extra[lang]?.[key] ??
    translations.en[key] ?? extra.en[key] ?? key;
  const toggleLang = () => setLang((l) => (l === 'en' ? 'km' : 'en'));

  return <LangContext.Provider value={{ lang, t, toggleLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
