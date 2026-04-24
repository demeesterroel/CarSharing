import { nl, type MessageKey, type Messages } from "./messages/nl";
import { en } from "./messages/en";

type Params = Record<string, string | number>;
const PLACEHOLDER = /\{(\w+)\}/g;

const locales = { nl, en } as const;
export type Locale = keyof typeof locales;

// Always "nl" at module level — avoids SSR/client hydration mismatch.
// The LocaleProvider sets the correct locale from localStorage after hydration.
let activeLocale: Locale = "nl";

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale) {
  activeLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("carsharing_locale", locale);
  }
}

export function t(key: MessageKey, params?: Params): string {
  const messages: Messages = locales[activeLocale];
  const template: string = messages[key];
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type { MessageKey } from "./messages/nl";
