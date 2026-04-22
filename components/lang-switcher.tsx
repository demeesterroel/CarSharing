"use client";
import { useLocale, type Locale } from "@/components/locale-provider";
import { paper, fontMono } from "@/lib/paper-theme";

export function LangSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div style={{ display: "flex" }}>
      {(["nl", "en"] as Locale[]).map((lang, i) => (
        <button
          key={lang}
          onClick={() => setLocale(lang)}
          style={{
            padding: "3px 8px",
            fontFamily: fontMono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            background: locale === lang ? paper.ink : "transparent",
            color: locale === lang ? paper.paper : paper.ink,
            border: `1.5px solid ${paper.ink}`,
            borderRight: i === 0 ? "none" : undefined,
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
