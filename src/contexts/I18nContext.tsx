'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import frMessages from '@/locales/fr.json';

type Locale = 'fr' | 'ar' | 'en';
type Messages = typeof frMessages;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextType>({
  locale: 'fr',
  setLocale: () => {},
  t: (key: string) => key,
  dir: 'ltr',
});

// Cache loaded translations
const translationCache: Record<string, Messages> = {
  fr: frMessages,
};

async function loadMessages(locale: Locale): Promise<Messages> {
  if (translationCache[locale]) return translationCache[locale];
  try {
    const mod = await import(`@/locales/${locale}.json`);
    translationCache[locale] = mod.default;
    return mod.default;
  } catch {
    return frMessages; // Fallback to French
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return key as fallback
    }
  }
  return typeof current === 'string' ? current : path;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');
  const [messages, setMessages] = useState<Messages>(frMessages);

  useEffect(() => {
    // Load saved locale from localStorage
    const saved = localStorage.getItem('corner_locale') as Locale | null;
    if (saved && ['fr', 'ar', 'en'].includes(saved)) {
      setLocaleState(saved);
      loadMessages(saved).then(setMessages);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('corner_locale', newLocale);
    loadMessages(newLocale).then(setMessages);

    // Update HTML dir and lang
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages as unknown as Record<string, unknown>, key);
  }, [messages]);

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}

export const localeNames: Record<Locale, string> = {
  fr: 'Francais',
  ar: 'العربية',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  ar: '🇲🇦',
  en: '🇬🇧',
};
