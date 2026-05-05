"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader, TITLE_BAR_HEIGHT } from "@/components/page-header";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useReservations, useOwnerCarShorts } from "./_shared";
import { useMe } from "@/hooks/use-me";

const OWNER_PAGES = ["/admin", "/admin/hygiene", "/admin/settlement", "/admin/payout"];

function SubNav() {
  const t = useT();
  const pathname = usePathname();
  const { data: reservations = [] } = useReservations();
  const { data: me } = useMe();
  const ownerCarShorts = useOwnerCarShorts();
  const pendingCount = reservations.filter(
    (r) => r.status === "pending" && (!ownerCarShorts || ownerCarShorts.has(r.car_short ?? ""))
  ).length;

  const year = new Date().getFullYear();

  const ALL_PAGES = [
    {
      href: "/admin",
      label: t("admin.sub_inbox") + (pendingCount > 0 ? ` (${pendingCount})` : ""),
    },
    { href: "/admin/cars", label: t("admin.sub_cars") },
    { href: "/admin/members", label: t("admin.sub_members") },
    { href: "/admin/hygiene", label: t("admin.sub_data") },
    { href: "/admin/settlement", label: t("admin.sub_settlement") },
    { href: "/admin/payout", label: t("admin.sub_payout") },
    { href: "/admin/settings", label: t("admin.sub_settings") },
  ];

  const SUB_PAGES = me?.isAdmin ? ALL_PAGES : ALL_PAGES.filter((p) => OWNER_PAGES.includes(p.href));

  return (
    <>
      <PageHeader title={t("page.admin")} subtitle={t("admin.subtitle", { year })} />
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 0,
          borderBottom: `1.5px dashed ${paper.ink}`,
          background: paper.paper,
          position: "sticky",
          top: TITLE_BAR_HEIGHT,
          zIndex: 19,
        }}
      >
        {SUB_PAGES.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "10px 14px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                background: active ? paper.ink : "transparent",
                color: active ? paper.paper : paper.ink,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <Suspense>
        <SubNav />
      </Suspense>
      {children}
    </div>
  );
}
