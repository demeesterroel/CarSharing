"use client";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

export function PendingBadge() {
  const t = useT();
  return (
    <span
      title={t("offline.pending_tooltip")}
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontFamily: fontMono,
        fontSize: 8,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: paper.amber,
        border: `1px dashed ${paper.amber}`,
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    >
      ↻ {t("offline.pending")}
    </span>
  );
}
