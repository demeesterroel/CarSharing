"use client";
import { useLocale, type Locale } from "@/components/locale-provider";
import { useTheme } from "@/lib/theme-context";
import { paper, fontMono } from "@/lib/paper-theme";

export function LangSwitcher() {
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";

  return (
    <div
      style={{
        display: "flex",
        border: mono ? `1px solid ${paper.paperDark}` : `1.5px solid ${paper.ink}`,
        borderRadius: "var(--radius-pill, 999px)",
        padding: 2,
        gap: 1,
      }}
    >
      {(["nl", "en"] as Locale[]).map((lang) => (
        <button
          key={lang}
          onClick={() => setLocale(lang)}
          style={{
            padding: "2px 9px",
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: mono ? 0 : 1.5,
            textTransform: "uppercase" as const,
            background: locale === lang ? paper.ink : "transparent",
            color: locale === lang ? paper.paper : mono ? paper.inkDim : paper.ink,
            border: "none",
            borderRadius: "var(--radius-pill, 999px)",
            cursor: "pointer",
            lineHeight: 1.6,
          }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
