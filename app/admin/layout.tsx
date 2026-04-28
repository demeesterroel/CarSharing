"use client";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useReservations } from "./_shared";

function SubNav() {
  const t = useT();
  const pathname = usePathname();
  const { data: reservations = [] } = useReservations();
  const pendingCount = reservations.filter((r) => r.status === "pending").length;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const year = new Date().getFullYear();

  const SUB_PAGES = [
    { href: "/admin",         label: t("admin.sub_inbox") + (mounted && pendingCount > 0 ? ` (${pendingCount})` : "") },
    { href: "/admin/cars",       label: t("admin.sub_cars") },
    { href: "/admin/members",    label: t("admin.sub_members") },
    { href: "/admin/hygiene",    label: t("admin.sub_data") },
    { href: "/admin/settlement", label: t("admin.sub_settlement") },
    { href: "/admin/payout",  label: t("admin.sub_payout") },
  ];

  return (
    <>
      <PageHeader
        title={t("page.admin")}
        subtitle={t("admin.subtitle", { year })}
      />
      <div style={{ display: "flex", overflowX: "auto", gap: 0, borderBottom: `1.5px dashed ${paper.ink}`, background: paper.paper }}>
        {SUB_PAGES.map((item) => {
          const active = item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "10px 14px",
                fontFamily: fontMono, fontSize: 9, fontWeight: 700,
                letterSpacing: 1.5, textTransform: "uppercase",
                background: active ? paper.ink : "transparent",
                color: active ? paper.paper : paper.ink,
                border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                textDecoration: "none", display: "inline-block",
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
