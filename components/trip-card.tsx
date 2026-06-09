"use client";
import { CarBadge } from "@/components/car-badge";
import { useLocale } from "@/components/locale-provider";
import { PendingBadge } from "@/components/pending-badge";
import { useTheme } from "@/lib/theme-context";
import { fmtDate, fmtMoney, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type { Trip } from "@/types";

export interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const isParkingOnly = !trip.location && !trip.gps_coords && trip.parking;

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        appearance: "none",
        background: mono ? "transparent" : tokens.paper,
        padding: "12px 14px",
        marginBottom: mono ? 0 : 8,
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: "none",
        borderRight: "none",
        borderBottom: mono ? `1px solid ${tokens.paperDark}` : "none",
        borderLeft: mono ? "none" : `3px solid ${tokens.accent}`,
        boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CarBadge short={trip.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: mono ? 14.5 : 15,
            color: isParkingOnly ? tokens.inkDim : tokens.ink,
            fontStyle: isParkingOnly ? "italic" : "normal",
            fontWeight: mono ? 500 : 600,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {trip.location ?? trip.gps_coords ?? trip.parking ?? "—"}
          {trip.id < 0 && <PendingBadge />}
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
          {trip.person_name} · {fmtDate(trip.date, locale)} ·{" "}
          {trip.start_odometer.toLocaleString("nl-BE")}
          {mono ? " – " : " → "}
          {trip.end_odometer.toLocaleString("nl-BE")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 14,
            fontWeight: 700,
            color: tokens.accent,
            whiteSpace: "nowrap",
          }}
        >
          {fmtMoney(trip.amount)}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: mono ? 11.5 : 10, color: tokens.inkDim }}>
          {trip.km} km
        </div>
      </div>
    </button>
  );
}
