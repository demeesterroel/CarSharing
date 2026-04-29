"use client";
import type { Trip } from "@/types";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate } from "@/lib/paper-theme";
import { useLocale } from "@/components/locale-provider";
import { CarBadge } from "@/components/car-badge";

export interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const { locale } = useLocale();
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: paper.paper,
        padding: "12px 14px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        borderLeft: `3px solid ${paper.accent}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CarBadge short={trip.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 15,
            color: !trip.location && !trip.gps_coords && trip.parking ? paper.inkDim : paper.ink,
            fontStyle: !trip.location && !trip.gps_coords && trip.parking ? "italic" : "normal",
            fontWeight: 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {trip.location ?? trip.gps_coords ?? trip.parking ?? "—"}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkDim,
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          {trip.person_name} · {fmtDate(trip.date, locale)} ·{" "}
          {trip.start_odometer.toLocaleString("nl-BE")} →{" "}
          {trip.end_odometer.toLocaleString("nl-BE")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: paper.accent,
            whiteSpace: "nowrap",
          }}
        >
          {fmtMoney(trip.amount)}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>{trip.km} km</div>
      </div>
    </button>
  );
}
