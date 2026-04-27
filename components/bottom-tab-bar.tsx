"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useMe } from "@/hooks/use-me";
import { useOnlineState } from "@/lib/offline/online-state";

const BASE_TABS = [
  { href: "/",         labelKey: "nav.dashboard" as const,        icon: "◉" },
  { href: "/trips",    labelKey: "nav.trips" as const,             icon: "↦" },
  { href: "/fuel",     labelKey: "nav.fuel" as const,              icon: "⛽" },
  { href: "/calendar", labelKey: "nav.tab.reservations" as const,  icon: "▦" },
  { href: "/expenses", labelKey: "nav.tab.expenses" as const,      icon: "₪" },
];

const ADMIN_TAB = { href: "/admin", labelKey: "nav.admin" as const, icon: "✎" };

export function BottomTabBar() {
  const t = useT();
  const pathname = usePathname();
  const { data: me } = useMe();
  const { online } = useOnlineState();

  if (pathname === "/login" || pathname.startsWith("/invite")) return null;

  const tabs = (me?.isAdmin || me?.isOwner) ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

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
      {tabs.map(({ href, labelKey, icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const offlineBlocked = !online && href === "/admin";
        return (
          <Link
            key={href}
            href={offlineBlocked ? "#" : href}
            aria-current={active ? "page" : undefined}
            onClick={offlineBlocked ? (e) => {
              e.preventDefault();
              toast.error(t("offline.admin_unavailable"));
            } : undefined}
            style={{
              flex: 1,
              padding: "10px 2px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              fontFamily: fontMono,
              background: active ? paper.ink : "transparent",
              color: active ? paper.paper : offlineBlocked ? paper.inkMute : paper.ink,
              textDecoration: "none",
              minWidth: 0,
              cursor: offlineBlocked ? "default" : "pointer",
              opacity: offlineBlocked ? 0.45 : 1,
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
