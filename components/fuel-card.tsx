"use client";
import type { FuelFillup } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate } from "@/lib/paper-theme";
import { useT, useLocale } from "@/components/locale-provider";
import { useTheme } from "@/lib/theme-context";
import { CarBadge } from "@/components/car-badge";
import { PendingBadge } from "@/components/pending-badge";

export interface FuelCardProps {
  fuel: FuelFillup;
  onClick?: () => void;
}

export function FuelCard({ fuel, onClick }: FuelCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: mono ? "transparent" : paper.paper,
        padding: "12px 14px",
        marginBottom: mono ? 0 : 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "none",
        borderRight: "none",
        borderBottom: mono ? `1px solid ${paper.paperDark}` : "none",
        borderLeft: mono ? "none" : `3px solid ${paper.green}`,
        boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CarBadge short={fuel.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: mono ? 14.5 : 15,
            color: paper.ink,
            fontWeight: mono ? 500 : 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {fuel.liters.toFixed(1)}L {t("fuel.card_refueled")}
          {fuel.location ? ` · ${fuel.location}` : ""}
          {fuel.id < 0 && <PendingBadge />}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: mono ? 11.5 : 10,
            color: paper.inkDim,
            letterSpacing: mono ? 0 : 1,
            marginTop: 2,
          }}
        >
          {fuel.person_name} · {fmtDate(fuel.date, locale)}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: fuel.settled_outside === 1 ? paper.inkMute : paper.green,
            whiteSpace: "nowrap",
          }}
        >
          {fmtMoney(fuel.amount)}
          {fuel.settled_outside === 1 && (
            <span
              style={{
                display: "inline-block",
                padding: "1px 5px",
                fontFamily: fontMono,
                fontSize: 8,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: paper.inkMute,
                border: `1px solid ${paper.paperDark}`,
                marginLeft: 5,
                verticalAlign: "middle",
              }}
            >
              {t("badge.settled_outside")}
            </span>
          )}
        </div>
        {fuel.price_per_liter && (
          <div style={{ fontFamily: fontMono, fontSize: mono ? 11.5 : 10, color: paper.inkDim }}>
            €{fuel.price_per_liter.toFixed(3)}/L
          </div>
        )}
      </div>
    </button>
  );
}
