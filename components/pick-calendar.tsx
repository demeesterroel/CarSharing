"use client";
import { useState } from "react";
import type { Reservation } from "@/types";
import { paper, fontMono, fmtDate } from "@/lib/paper-theme";
import { useT, useLocale } from "@/components/locale-provider";

function shortMonth(iso: string, locale: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString(locale, { month: "short", timeZone: "UTC" })
    .replace(/\.$/, "");
}

function monthRange(first: string, last: string, locale: string): string {
  const m0 = shortMonth(first, locale);
  const m1 = shortMonth(last, locale);
  const y0 = new Date(`${first}T00:00:00Z`).getUTCFullYear();
  const y1 = new Date(`${last}T00:00:00Z`).getUTCFullYear();
  if (m0 === m1 && y0 === y1) return `${m0} ${y0}`;
  if (y0 === y1) return `${m0} – ${m1} ${y1}`;
  return `${m0} ${y0} – ${m1} ${y1}`;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

interface Props {
  reservations: Reservation[];
  carId?: number;
  excludeId?: number;
  from: string | null;
  to: string | null;
  onRangePick: (from: string, to: string) => void;
  initialOffset?: number;
}

export function PickCalendar({
  reservations,
  carId,
  excludeId,
  from,
  to,
  onRangePick,
  initialOffset = 0,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [pickFrom, setPickFrom] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(initialOffset);

  const today = new Date().toISOString().slice(0, 10);
  const stripStart = addDays(mondayOf(today), weekOffset * 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));
  // Derive short weekday labels from Intl — no hardcoded arrays needed.
  const dayNames = days
    .slice(0, 7)
    .map((d) =>
      new Date(`${d}T00:00:00Z`)
        .toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })
        .replace(/\.$/, "")
    );

  function getReservation(day: string): Reservation | undefined {
    return reservations.find(
      (r) =>
        r.car_id === carId &&
        r.status !== "rejected" &&
        !(excludeId && r.id === excludeId) &&
        day >= r.start_date &&
        day <= r.end_date
    );
  }

  // A day is blocked only if it's strictly inside a reservation (not on its boundary).
  // Boundary days (start/end) can be shared between consecutive reservations.
  function isBlockedDay(day: string): boolean {
    return reservations.some(
      (r) =>
        r.car_id === carId &&
        r.status !== "rejected" &&
        !(excludeId && r.id === excludeId) &&
        day > r.start_date &&
        day < r.end_date
    );
  }

  function handleCell(day: string) {
    if (isBlockedDay(day)) return;
    if (!pickFrom) {
      setPickFrom(day);
      return;
    }
    const newFrom = pickFrom <= day ? pickFrom : day;
    const newTo = pickFrom <= day ? day : pickFrom;
    setPickFrom(null);
    onRangePick(newFrom, newTo);
  }

  const rows: string[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  const navBtn: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 14,
    fontWeight: 700,
    background: "transparent",
    border: `1px solid ${paper.paperDark}`,
    color: paper.inkDim,
    cursor: "pointer",
    padding: "0 8px",
    lineHeight: "28px",
    flexShrink: 0,
  };

  return (
    <div>
      {/* Nav bar: status message left, ‹ › right — always same height */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div
          style={{
            flex: 1,
            padding: "4px 10px",
            border: `1.5px dashed ${pickFrom ? paper.accent : paper.inkMute}`,
            background: paper.paperDeep,
            fontFamily: fontMono,
            fontSize: 10,
            letterSpacing: 1,
            color: paper.ink,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: 28,
          }}
        >
          {pickFrom ? (
            <>
              <span>
                ● {t("calendar.pick_start", { date: fmtDate(pickFrom, locale as "nl" | "en") })}
              </span>
              <button
                type="button"
                onClick={() => setPickFrom(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontFamily: fontMono,
                  fontSize: 12,
                  cursor: "pointer",
                  color: paper.inkDim,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <span style={{ color: paper.inkDim }}>{monthRange(days[0], days[13], locale)}</span>
          )}
        </div>
        <button type="button" onClick={() => setWeekOffset((o) => o - 1)} style={navBtn}>
          ‹
        </button>
        <button type="button" onClick={() => setWeekOffset((o) => o + 1)} style={navBtn}>
          ›
        </button>
      </div>

      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
            marginBottom: rowIdx < rows.length - 1 ? 2 : 0,
          }}
        >
          {row.map((day) => {
            const res = getReservation(day);
            const isPending = res?.status === "pending";
            const isFirst = res && day === res.start_date;
            const isPickStart = pickFrom === day;
            const inRange = !pickFrom && from && to && day >= from && day <= to;

            let bg: string = paper.paper;
            let fg: string = paper.ink;
            let border: string = `1px solid ${paper.paperDark}`;

            if (isPickStart) {
              bg = paper.accent;
              fg = paper.paper;
              border = `1.5px solid ${paper.ink}`;
            } else if (res) {
              if (isPending) {
                bg = `repeating-linear-gradient(45deg, ${paper.paper} 0 4px, ${paper.paperDark} 4px 6px)`;
                border = `1.5px dashed ${paper.amber}`;
                fg = paper.inkDim;
              } else {
                bg = paper.ink;
                fg = paper.paper;
              }
            } else if (inRange) {
              bg = `repeating-linear-gradient(45deg, ${paper.paperDeep} 0 4px, ${paper.paperDark} 4px 6px)`;
              border = `1.5px dashed ${paper.blue}`;
              fg = paper.ink;
            }

            const d = new Date(`${day}T00:00:00Z`);

            return (
              <div
                key={day}
                onClick={() => handleCell(day)}
                title={res ? `${res.person_name}${isPending ? " (aanvraag)" : ""}` : ""}
                style={{
                  padding: "5px 2px",
                  textAlign: "center",
                  background: bg,
                  color: fg,
                  border,
                  fontFamily: fontMono,
                  fontSize: 9,
                  minHeight: 44,
                  position: "relative",
                  cursor: isBlockedDay(day) ? "default" : "pointer",
                }}
              >
                <div style={{ fontSize: 8, opacity: 0.75 }}>{dayNames[d.getUTCDay()]}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{d.getUTCDate()}</div>
                {isFirst && res && (
                  <div style={{ fontSize: 7, marginTop: 1, opacity: 0.85 }}>
                    {res.person_name?.slice(0, 4)}
                  </div>
                )}
                {isFirst && isPending && (
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      fontSize: 9,
                      color: paper.amber,
                      fontWeight: 700,
                    }}
                  >
                    ?
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
