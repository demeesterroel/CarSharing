"use client";
import type { Reservation } from "@/types";
import { paper, fontMono, fontSerif, fmtDate } from "@/lib/paper-theme";
import { useLocale } from "@/components/locale-provider";
import { CarBadge } from "@/components/car-badge";

export interface ReservationCardProps {
  reservation: Reservation;
  onClick?: () => void;
}

export function ReservationCard({ reservation, onClick }: ReservationCardProps) {
  const { locale } = useLocale();
  const isPending = reservation.status === "pending";
  const days = Math.round((new Date(reservation.end_date + "T00:00:00Z").getTime() - new Date(reservation.start_date + "T00:00:00Z").getTime()) / 86400000) + 1;
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", marginBottom: 8,
      background: isPending
        ? `repeating-linear-gradient(-45deg, ${paper.paperDeep}, ${paper.paperDeep} 4px, ${paper.paper} 4px, ${paper.paper} 10px)`
        : paper.paper,
      border: "none",
      borderTop: "none", borderRight: "none", borderBottom: "none",
      borderLeft: `3px ${isPending ? "dashed" : "solid"} ${isPending ? paper.amber : paper.green}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      cursor: onClick ? "pointer" : "default",
      textAlign: "left",
      appearance: "none",
    }}>
      <CarBadge short={reservation.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, fontWeight: 600, color: paper.ink, lineHeight: 1.2 }}>
          {reservation.person_name}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {fmtDate(reservation.start_date, locale)}{reservation.start_date !== reservation.end_date ? ` → ${fmtDate(reservation.end_date, locale)}` : ""}
        </div>
        {reservation.note && (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, marginTop: 2 }}>
            {reservation.note}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.ink, whiteSpace: "nowrap" }}>
          {days}d
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: isPending ? paper.amber : paper.green }}>
          {isPending ? "?" : "✓"}
        </div>
      </div>
    </button>
  );
}
