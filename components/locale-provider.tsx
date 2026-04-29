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
  const [locale, setLocaleState] = useState<Locale>("nl");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    const active = stored === "en" || stored === "nl" ? stored : "nl";
    if (active !== "nl") {
      setModuleLocale(active);
      setLocaleState(active);
    }
  }, []);

  const handleSetLocale = (l: Locale) => {
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
