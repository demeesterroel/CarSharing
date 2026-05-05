"use client";
import { useRouter } from "next/navigation";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { LangSwitcher } from "./lang-switcher";
import { OfflineBadge } from "./offline-badge";
import pkg from "@/package.json";

const version = pkg.version;

// Height of the sticky title bar (padding 6+10 + font 26*1.1 ≈ 29 + border 1.5 ≈ 47px).
// Used by consumers to offset a second sticky element below it.
export const TITLE_BAR_HEIGHT = 47;

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  titleSize?: number;
}

export function PageHeader({ title, subtitle, right, titleSize = 26 }: Props) {
  const t = useT();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <>
      {/* Scrolls away: org name */}
      <div style={{ background: paper.paper, padding: "18px 20px 4px" }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: paper.inkDim,
            letterSpacing: 2,
            textTransform: "uppercase" as const,
          }}
        >
          {t("brand.tagline")}
        </div>
      </div>

      {/* Sticky: title + controls on same row */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: paper.paper,
          borderBottom: `1.5px dashed ${paper.ink}`,
          padding: "6px 20px 10px",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: titleSize,
            fontWeight: 700,
            color: paper.ink,
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 12 }}
        >
          <OfflineBadge />
          {right}
          <LangSwitcher />
          <button
            onClick={handleLogout}
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
            style={{
              padding: "3px 8px",
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: "transparent",
              color: paper.inkDim,
              border: `1.5px solid ${paper.paperDark}`,
              cursor: "pointer",
              lineHeight: 1.6,
            }}
          >
            ⏻
          </button>
          <span
            style={{ fontFamily: fontMono, fontSize: 8, color: paper.inkDim, letterSpacing: 1 }}
          >
            v{version}
          </span>
        </div>
      </div>

      {/* Scrolls away: subtitle (admin only) */}
      {subtitle && (
        <div style={{ background: paper.paper, padding: "6px 20px 10px" }}>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 10,
              color: paper.inkDim,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
            }}
          >
            {subtitle}
          </div>
        </div>
      )}
    </>
  );
}
