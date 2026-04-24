"use client";
import { useState, useEffect } from "react";
import type { Reservation } from "@/types";
import { paper, fontMono, fmtDate } from "@/lib/paper-theme";
import { useT, useLocale } from "@/components/locale-provider";

const DAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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

export function PickCalendar({ reservations, carId, excludeId, from, to, onRangePick, initialOffset = 0 }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const dayNames = locale === "nl" ? DAYS_NL : DAYS_EN;
  const [pickFrom, setPickFrom] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(initialOffset);

  useEffect(() => { setPickFrom(null); }, [from, to]);

  const today = new Date().toISOString().slice(0, 10);
  const stripStart = addDays(mondayOf(today), weekOffset * 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));

  function getReservation(day: string): Reservation | undefined {
    return reservations.find(
      (r) => r.car_id === carId && r.status !== "rejected" &&
        !(excludeId && r.id === excludeId) &&
        day >= r.start_date && day <= r.end_date
    );
  }

  function handleCell(day: string) {
    if (getReservation(day)) return;
    if (!pickFrom) { setPickFrom(day); return; }
    const newFrom = pickFrom <= day ? pickFrom : day;
    const newTo   = pickFrom <= day ? day : pickFrom;
    setPickFrom(null);
    onRangePick(newFrom, newTo);
  }

  const rows: string[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  const navBtn: React.CSSProperties = {
    fontFamily: fontMono, fontSize: 14, fontWeight: 700,
    background: "transparent", border: `1px solid ${paper.paperDark}`,
    color: paper.inkDim, cursor: "pointer", padding: "0 8px",
    lineHeight: "28px", flexShrink: 0,
  };

  return (
    <div>
      {/* Nav bar: status message left, ‹ › right — always same height */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{
          flex: 1, padding: "4px 10px",
          border: `1.5px dashed ${paper.accent}`,
          background: paper.paperDeep,
          fontFamily: fontMono, fontSize: 10, letterSpacing: 1, color: paper.ink,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          minHeight: 28,
          visibility: pickFrom ? "visible" : "hidden",
        }}>
          <span>● {pickFrom && t("calendar.pick_start", { date: fmtDate(pickFrom, locale as "nl" | "en") })}</span>
          <button
            type="button"
            onClick={() => setPickFrom(null)}
            style={{
              border: "none", background: "transparent",
              fontFamily: fontMono, fontSize: 12, cursor: "pointer",
              color: paper.inkDim, lineHeight: 1, padding: 0,
            }}
          >✕</button>
        </div>
        <button type="button" onClick={() => setWeekOffset((o) => o - 1)} style={navBtn}>‹</button>
        <button type="button" onClick={() => setWeekOffset((o) => o + 1)} style={navBtn}>›</button>
      </div>

      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2, marginBottom: rowIdx < rows.length - 1 ? 2 : 0,
        }}>
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
              bg = paper.accent; fg = paper.paper; border = `1.5px solid ${paper.ink}`;
            } else if (res) {
              if (isPending) {
                bg = `repeating-linear-gradient(45deg, ${paper.paper} 0 4px, ${paper.paperDark} 4px 6px)`;
                border = `1.5px dashed ${paper.amber}`;
                fg = paper.inkDim;
              } else {
                bg = paper.ink; fg = paper.paper;
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
                  padding: "5px 2px", textAlign: "center",
                  background: bg, color: fg, border,
                  fontFamily: fontMono, fontSize: 9,
                  minHeight: 44, position: "relative",
                  cursor: res ? "default" : "pointer",
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
                  <div style={{
                    position: "absolute", top: 2, right: 2,
                    fontSize: 9, color: paper.amber, fontWeight: 700,
                  }}>?</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
