"use client";
import { useT } from "@/components/locale-provider";
import { PageHeader, TITLE_BAR_HEIGHT } from "@/components/page-header";
import { useMe } from "@/hooks/use-me";
import { fontMono, tokens } from "@/lib/theme-tokens";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useInboxCount } from "./_shared";

const OWNER_PAGES = ["/admin", "/admin/settlement", "/admin/vehicles"];

function SubNav() {
  const t = useT();
  const pathname = usePathname();
  const { data: me } = useMe();
  const { count: inboxCount, isLoading: isInboxLoading } = useInboxCount();
  const year = new Date().getFullYear();

  const ALL_PAGES = [
    {
      href: "/admin",
      label: isInboxLoading
        ? t("admin.sub_inbox") + " (—)"
        : t("admin.sub_inbox") + (inboxCount > 0 ? ` (${inboxCount})` : ""),
    },
    { href: "/admin/vehicles", label: t("admin.sub_cars") },
    { href: "/admin/members", label: t("admin.sub_members") },
    { href: "/admin/settlement", label: t("admin.sub_settlement") },
    { href: "/admin/payments", label: t("admin.sub_payments") },
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
          borderBottom: `1.5px dashed ${tokens.ink}`,
          background: tokens.paper,
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
                background: active ? tokens.ink : "transparent",
                color: active ? tokens.paper : tokens.ink,
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

// The /admin area is for admins and car owners only. Bounce everyone else to the
// dashboard — including an admin cloaked as a plain member, whose useMe reflects
// the cloaked (non-admin, non-owner) identity (#179). Page-level data APIs already
// enforce this server-side; this stops the shells/chrome from rendering at all.
function AdminAccessGuard() {
  const { data: me, isFetched } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (isFetched && me && !me.isAdmin && !me.isOwner) {
      router.replace("/");
    }
  }, [isFetched, me, router]);
  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <AdminAccessGuard />
      <Suspense>
        <SubNav />
      </Suspense>
      {children}
    </div>
  );
}
