"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { setLocale as setModuleLocale, t, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "carsharing_locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "nl",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // useState initializer runs once at mount. On the client, reset the module-level
  // activeLocale to "nl" so the initial render always matches the server HTML.
  // Without this, stale HMR state can leave activeLocale as "en" before effects run.
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "nl";
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === "en" || stored === "nl" ? stored : "nl";
  });

  useEffect(() => {
    setModuleLocale(locale);
  }, [locale]);

  const handleSetLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setModuleLocale(l);
    setLocaleState(l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  useContext(LocaleContext); // subscribe to locale changes → triggers re-render on switch
  return t;
}

export type { Locale } from "@/lib/i18n";
