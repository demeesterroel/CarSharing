// Shared paper-receipt theme constants — mirrors CSS custom properties in globals.css

export const paper = {
  paper: "#f5f0e6",
  paperDeep: "#ebe3d2",
  paperDark: "#d9ceb2",
  ink: "#1a1a1a",
  inkDim: "#555047",
  inkMute: "#8a8273",
  accent: "#a83929",
  green: "#4d6e35",
  blue: "#3d5a7a",
  amber: "#8a5a00",
} as const;

export const fontMono = "var(--font-courier-prime, 'Courier Prime', ui-monospace, monospace)";
export const fontSerif = "var(--font-fraunces, 'Fraunces', Georgia, serif)";
export const fontSans = "var(--font-inter, system-ui, sans-serif)";

/** Signed color: positive → green, negative → accent, zero → inkMute */
export const amtColor = (n: number) =>
  n > 0 ? paper.green : n < 0 ? paper.accent : paper.inkMute;

/** Sign prefix string: +, −, or empty */
export const signPrefix = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

/** Format euro amount: € 1.234,56 */
export function fmtMoney(n: number): string {
  return (
    "€\u00a0" +
    Math.abs(n).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
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
