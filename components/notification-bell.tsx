"use client";
import { useT } from "@/components/locale-provider";
import { apiFetch } from "@/lib/api/client";
import { fontMono, tokens } from "@/lib/theme-tokens";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";

export function NotificationBell() {
  const t = useT();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread"],
    queryFn: () => apiFetch("/api/notifications/unread-count"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const count = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      title={count > 0 ? t("notif.unread_badge").replace("{count}", String(count)) : t("notif.page_title")}
      aria-label={count > 0 ? t("notif.unread_badge").replace("{count}", String(count)) : t("notif.page_title")}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 7px",
        color: count > 0 ? tokens.ink : tokens.inkDim,
        textDecoration: "none",
      }}
    >
      <Bell size={15} strokeWidth={1.75} />
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            minWidth: 14,
            height: 14,
            borderRadius: "50%",
            background: tokens.accent,
            color: "white",
            fontFamily: fontMono,
            fontSize: 8,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 2px",
            lineHeight: 1,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
