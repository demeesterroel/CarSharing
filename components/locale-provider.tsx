"use client";
import { setLocale as setModuleLocale, t, type Locale } from "@/lib/i18n";
import React, { createContext, useContext, useState } from "react";

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
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "nl";
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    const l = stored === "en" || stored === "nl" ? stored : "nl";
    // Sync module locale immediately so t() returns the correct language on first render.
    // Without this, t() uses the default "nl" until useEffect fires, which never triggers
    // a re-render — leaving hard-navigated pages permanently in Dutch.
    setModuleLocale(l);
    return l;
  });

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
