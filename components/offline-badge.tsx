"use client";
import { useOnlineState } from "@/lib/offline/online-state";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export function OfflineBadge() {
  const t = useT();
  const { online, staleness } = useOnlineState();

  if (online) return null;

  const isStale = staleness !== "fresh";
  const color = isStale ? paper.amber : paper.inkDim;
  const tooltip = isStale ? t("offline.tooltip_stale") : t("offline.tooltip_fresh");

  return (
    <span
      role="status"
      aria-live="polite"
      title={tooltip}
      style={{
        padding: "3px 8px",
        fontFamily: fontMono,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        background: "transparent",
        color,
        border: `1.5px solid ${color}`,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {t("offline.label")}
      {isStale && ` · ${t("offline.stale_suffix")}`}
    </span>
  );
}
