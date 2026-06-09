"use client";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api/client";
import { notificationHref } from "@/lib/notification-href";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import type { Notification } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}

export default function NotificationsPage() {
  const t = useT();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
  });

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  async function handleMarkAllRead() {
    try {
      await apiFetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh" }}>
      <PageHeader
        title={t("notif.page_title")}
        right={
          notifications.length > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              style={{
                padding: "4px 8px",
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "transparent",
                border: `1.5px solid ${unreadCount > 0 ? paper.ink : paper.paperDark}`,
                color: unreadCount > 0 ? paper.ink : paper.inkMute,
                cursor: unreadCount > 0 ? "pointer" : "default",
                opacity: unreadCount > 0 ? 1 : 0.55,
              }}
            >
              {unreadCount > 0 ? `${t("notif.mark_all_read")} (${unreadCount})` : t("notif.mark_all_read")}
            </button>
          ) : undefined
        }
      />

      {isLoading && (
        <div
          style={{
            padding: "32px 20px",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("state.loading")}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.inkDim,
            letterSpacing: 1,
          }}
        >
          {t("notif.empty")}
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <div style={{ padding: "12px 0" }}>
          {notifications.map((n) => {
            const href = notificationHref(n);
            const isUnread = n.read_at === null;
            const inner = (
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${paper.paperDark}`,
                  background: isUnread ? paper.paper : paper.paperDeep,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  opacity: isUnread ? 1 : 0.7,
                }}
              >
                <div>
                  {isUnread && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: paper.accent,
                        marginRight: 6,
                        verticalAlign: "middle",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: fontSerif,
                      fontSize: 13,
                      color: paper.ink,
                    }}
                  >
                    {n.message}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkMute,
                    letterSpacing: 1,
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {relativeTime(n.created_at)}
                </span>
              </div>
            );

            if (href) {
              return (
                <Link key={n.id} href={href} style={{ textDecoration: "none", display: "block" }}>
                  {inner}
                </Link>
              );
            }
            return <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
