"use client";
import { CarBadge } from "@/components/car-badge";
import { useLocale } from "@/components/locale-provider";
import { PendingBadge } from "@/components/pending-badge";
import { fmtDate, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import type { Reservation } from "@/types";

export interface ReservationCardProps {
  reservation: Reservation;
  onClick?: () => void;
}

export function ReservationCard({ reservation, onClick }: ReservationCardProps) {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const isPending = reservation.status === "pending";
  const days =
    Math.round(
      (new Date(reservation.end_date + "T00:00:00Z").getTime() -
        new Date(reservation.start_date + "T00:00:00Z").getTime()) /
        86400000
    ) + 1;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        marginBottom: mono ? 0 : 8,
        background: isPending
          ? `repeating-linear-gradient(45deg, ${tokens.paper} 0 4px, ${tokens.paperDark} 4px 6px)`
          : mono
            ? "transparent"
            : tokens.paper,
        border: "none",
        borderTop: "none",
        borderRight: "none",
        borderBottom: mono ? `1px solid ${tokens.paperDark}` : "none",
        borderLeft: mono
          ? "none"
          : `3px ${isPending ? "dashed" : "solid"} ${isPending ? tokens.amber : tokens.green}`,
        boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        appearance: "none",
      }}
    >
      <CarBadge short={reservation.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 15,
            fontWeight: 600,
            color: tokens.ink,
            lineHeight: 1.2,
          }}
        >
          {reservation.person_name}
          {reservation.id < 0 && <PendingBadge />}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: mono ? 11.5 : 10,
            color: tokens.inkDim,
            letterSpacing: mono ? 0 : 1,
            marginTop: 2,
          }}
        >
          {fmtDate(reservation.start_date, locale)}
          {reservation.start_date !== reservation.end_date
            ? ` → ${fmtDate(reservation.end_date, locale)}`
            : ""}
          {reservation.start_time && reservation.end_time
            ? ` · ${reservation.start_time}–${reservation.end_time}`
            : ""}
        </div>
        {reservation.note && (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: tokens.inkDim, marginTop: 2 }}>
            {reservation.note}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: tokens.ink,
            whiteSpace: "nowrap",
          }}
        >
          {days}d
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: mono ? 11.5 : 10,
            fontWeight: 700,
            color: isPending ? tokens.amber : tokens.green,
          }}
        >
          {isPending ? "?" : "✓"}
        </div>
      </div>
    </button>
  );
}
