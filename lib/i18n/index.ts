import { en } from "./messages/en";
import { nl, type MessageKey, type Messages } from "./messages/nl";

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

export function buildMissingLabel(fields: (string | false | null | undefined)[]): string {
  const missing = fields.filter(Boolean) as string[];
  if (missing.length === 0) return "";
  return `${t("field.fields_missing")}:\n${missing.map((f) => `  ${f}`).join("\n")}`;
}

export type { MessageKey } from "./messages/nl";
