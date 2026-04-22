"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

const TABS = [
  { href: "/",         labelKey: "nav.dashboard" as const,        icon: "◉" },
  { href: "/trips",    labelKey: "nav.trips" as const,             icon: "↦" },
  { href: "/fuel",     labelKey: "nav.fuel" as const,              icon: "⛽" },
  { href: "/calendar", labelKey: "nav.tab.reservations" as const,  icon: "▦" },
  { href: "/expenses", labelKey: "nav.tab.expenses" as const,      icon: "₪" },
  { href: "/admin",    labelKey: "nav.admin" as const,             icon: "✎" },
];

export function BottomTabBar() {
  const t = useT();
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      aria-label={t("nav.primary")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: paper.paper,
        borderTop: `1.5px dashed ${paper.ink}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {TABS.map(({ href, labelKey, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1,
              padding: "10px 2px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              fontFamily: fontMono,
              background: active ? paper.ink : "transparent",
              color: active ? paper.paper : paper.ink,
              textDecoration: "none",
              minWidth: 0,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
            <span style={{
              fontSize: 8,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}>
              {t(labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
