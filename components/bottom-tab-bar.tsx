"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Navigation, Fuel, CalendarPlus, Receipt, Settings, type LucideIcon } from "lucide-react";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useMe } from "@/hooks/use-me";

const BASE_TABS: { href: string; labelKey: "nav.dashboard" | "nav.trips" | "nav.fuel" | "nav.tab.reservations" | "nav.tab.expenses"; Icon: LucideIcon }[] = [
  { href: "/", labelKey: "nav.dashboard", Icon: House },
  { href: "/trips", labelKey: "nav.trips", Icon: Navigation },
  { href: "/fuel", labelKey: "nav.fuel", Icon: Fuel },
  { href: "/calendar", labelKey: "nav.tab.reservations", Icon: CalendarPlus },
  { href: "/expenses", labelKey: "nav.tab.expenses", Icon: Receipt },
];

const ADMIN_TAB: { href: string; labelKey: "nav.admin"; Icon: LucideIcon } = {
  href: "/admin",
  labelKey: "nav.admin",
  Icon: Settings,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
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
  border: "none",
});



export function BottomTabBar() {
  const t = useT();
  const pathname = usePathname();
  const { data: me } = useMe();

  if (pathname === "/login" || pathname.startsWith("/invite")) return null;

  const showAdmin = me?.isAdmin || me?.isOwner;
  const tabs = showAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav
      aria-label={t("nav.primary")}
      className="bottom-nav-paper"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        maxWidth: 480,
        margin: "0 auto",
        // Force GPU compositing layer — prevents iOS Safari from dropping
        // position:fixed during scroll (known WebKit compositing bug).
        WebkitTransform: "translateZ(0)",
        transform: "translateZ(0)",
      }}
    >
      {tabs.map(({ href, labelKey, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            style={tabStyle(active)}
          >
            <Icon size={17} strokeWidth={1.75} />
            <span className="bottom-nav-label">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
