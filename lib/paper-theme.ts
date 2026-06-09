// Shared paper-receipt theme constants — mirrors CSS custom properties in globals.css

export const paper = {
  paper: "var(--paper)",
  paperDeep: "var(--paper-deep)",
  paperDark: "var(--paper-dark)",
  ink: "var(--ink)",
  inkDim: "var(--ink-dim)",
  inkMute: "var(--ink-mute)",
  accent: "var(--accent)",
  green: "var(--green)",
  blue: "var(--blue)",
  amber: "var(--amber)",
  amberBg: "var(--amber-bg)",
  amberBorder: "var(--amber-border)",
  amberTint: "var(--amber-tint)",
} as const;

export const fontMono = "var(--font-mono)";
export const fontSerif = "var(--font-serif)";
export const fontSans = "var(--font-sans)";

/** Signed color: positive → green, negative → accent, zero → inkMute */
export const amtColor = (n: number) => (n > 0 ? paper.green : n < 0 ? paper.accent : paper.inkMute);

/** Sign prefix string: +, −, or empty */
export const signPrefix = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** Format euro amount: € 1.234,56 */
export function fmtMoney(n: number): string {
  return (
    "€\u00a0" +
    Math.abs(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/**
 * Format a cost / outgoing amount as a negative euro value: − € 1.234,56
 * Always prepends the minus sign (U+2212), regardless of the input's sign,
 * so callers can pass the stored (positive) cost value directly.
 */
export function fmtMoneyOut(n: number): string {
  return "− " + fmtMoney(n);
}

/** Format km with thousands separator */
export function fmtKm(n: number): string {
  return n.toLocaleString("nl-BE") + "\u00a0km";
}

const MONTHS_NL = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];
const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDate(iso: string, lang: "nl" | "en" = "nl"): string {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDate();
  const mo = (lang === "nl" ? MONTHS_NL : MONTHS_EN)[d.getMonth()];
  const dow = (lang === "nl" ? DAYS_NL : DAYS_EN)[d.getDay()];
  return `${dow} ${day} ${mo}`;
}

export function fmtYearMonth(iso: string, lang: "nl" | "en" = "nl"): string {
  const [y, m] = iso.split("-");
  const mo = (lang === "nl" ? MONTHS_NL : MONTHS_EN)[parseInt(m, 10) - 1];
  return `${mo} ${y}`;
}
