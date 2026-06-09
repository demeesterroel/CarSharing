"use client";
import { useT } from "@/components/locale-provider";
import { fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import pkg from "@/package.json";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { LangSwitcher } from "./lang-switcher";
import { NotificationBell } from "./notification-bell";
import { OfflineBadge } from "./offline-badge";

const version = pkg.version;

// Height of the sticky title bar (padding 6+10 + font 26*1.1 ≈ 29 + border 1.5 ≈ 47px).
// Used by consumers to offset a second sticky element below it.
export const TITLE_BAR_HEIGHT = 47;

interface Props {
  title: React.ReactNode;
  subtitle?: string;
  right?: React.ReactNode;
  titleSize?: number;
}

export function PageHeader({ title, subtitle, right, titleSize = 26 }: Props) {
  const t = useT();
  const router = useRouter();
  const { theme } = useTheme();
  const mono = theme === "mono";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <>
      {/* Scrolls away: org name — hidden in mono */}
      {!mono && (
        <div style={{ background: tokens.paper, padding: "18px 20px 4px" }}>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 9,
              color: tokens.inkDim,
              letterSpacing: 2,
              textTransform: "uppercase" as const,
            }}
          >
            {t("brand.tagline")}
          </div>
        </div>
      )}

      {/* Sticky: title + controls on same row */}
      <div
        className="page-header-border"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: tokens.paper,
          borderBottom: mono ? `1px solid ${tokens.paperDark}` : `1.5px dashed ${tokens.ink}`,
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
            color: tokens.ink,
            letterSpacing: "var(--title-tracking, -0.5px)",
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
          <NotificationBell />
          <LangSwitcher />
          <button
            onClick={handleLogout}
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
            style={{
              padding: "4px 7px",
              background: "transparent",
              color: tokens.inkDim,
              border: `1.5px solid ${tokens.paperDark}`,
              borderRadius: mono ? "var(--radius-sm, 6px)" : 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Power size={13} strokeWidth={1.75} />
          </button>
          <a
            href={`https://github.com/demeesterroel/CarSharing/releases/tag/v${version}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: mono
                ? "var(--font-jetbrains-mono, 'JetBrains Mono', monospace)"
                : fontMono,
              fontSize: 8,
              color: tokens.inkDim,
              letterSpacing: mono ? 0 : 1,
              textDecoration: "none",
            }}
          >
            v{version}
          </a>
        </div>
      </div>

      {/* Scrolls away: subtitle (admin only) */}
      {subtitle && (
        <div style={{ background: tokens.paper, padding: "6px 20px 10px" }}>
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 10,
              color: tokens.inkDim,
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
