import { nl, type MessageKey, type Messages } from "./messages/nl";

type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function t(key: MessageKey, params?: Params): string {
  const template: Messages[MessageKey] = nl[key];
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type { MessageKey } from "./messages/nl";
