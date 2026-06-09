"use client";
import { useLocale, useT } from "@/components/locale-provider";
import { fmtDate, fontMono, tokens } from "@/lib/theme-tokens";
import { useTheme } from "@/lib/theme-context";
import type { Reservation } from "@/types";
import { useState } from "react";

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
  const { theme } = useTheme();
  const mono = theme === "mono";
  const [pickFrom, setPickFrom] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(initialOffset);

  const today = new Date().toISOString().slice(0, 10);
  const stripStart = addDays(mondayOf(today), weekOffset * 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));
  const dayNames: string[] = Array(7);
  days.slice(0, 7).forEach((d) => {
    const date = new Date(`${d}T00:00:00Z`);
    dayNames[date.getUTCDay()] = date
      .toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })
      .replace(/\.$/, "");
  });

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

  function handleCell(day: string) {
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

  const navBtn: React.CSSProperties = mono
    ? {
        fontFamily: fontMono,
        fontSize: 14,
        fontWeight: 700,
        background: "transparent",
        border: `1px solid ${tokens.paperDark}`,
        borderRadius: "var(--radius-pill, 999px)",
        color: tokens.inkDim,
        cursor: "pointer",
        padding: "0 10px",
        lineHeight: "28px",
        flexShrink: 0,
      }
    : {
        fontFamily: fontMono,
        fontSize: 14,
        fontWeight: 700,
        background: "transparent",
        border: `1px solid ${tokens.paperDark}`,
        color: tokens.inkDim,
        cursor: "pointer",
        padding: "0 8px",
        lineHeight: "28px",
        flexShrink: 0,
      };

  return (
    <div>
      {/* Nav bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div
          style={
            mono
              ? {
                  flex: 1,
                  padding: "4px 10px",
                  border: `1px solid ${pickFrom ? tokens.accent : tokens.paperDark}`,
                  borderRadius: "var(--radius-sm, 6px)",
                  background: "transparent",
                  fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)",
                  fontSize: 13,
                  color: tokens.ink,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  minHeight: 28,
                }
              : {
                  flex: 1,
                  padding: "4px 10px",
                  border: `1.5px dashed ${pickFrom ? tokens.accent : tokens.inkMute}`,
                  background: tokens.paperDeep,
                  fontFamily: fontMono,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: tokens.ink,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  minHeight: 28,
                }
          }
        >
          {pickFrom ? (
            <>
              <span>
                {mono ? "● " : "● "}
                {t("calendar.pick_start", { date: fmtDate(pickFrom, locale as "nl" | "en") })}
              </span>
              <button
                type="button"
                onClick={() => setPickFrom(null)}
                aria-label={t("action.cancel_selection")}
                style={{
                  border: "none",
                  background: "transparent",
                  fontFamily: fontMono,
                  fontSize: 12,
                  cursor: "pointer",
                  color: tokens.inkDim,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <span style={{ color: mono ? tokens.ink : tokens.inkDim }}>
              {monthRange(days[0], days[13], locale)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          aria-label={t("calendar.prev_weeks")}
          style={navBtn}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o + 1)}
          aria-label={t("calendar.next_weeks")}
          style={navBtn}
        >
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

            let bg: string = tokens.paper;
            let fg: string = tokens.ink;
            let border: string = `1px solid ${tokens.paperDark}`;

            if (isPickStart) {
              bg = tokens.accent;
              fg = tokens.paper;
              border = mono ? `2px solid ${tokens.accent}` : `2px solid ${tokens.ink}`;
            } else if (res) {
              if (isPending) {
                bg = `repeating-linear-gradient(45deg, ${tokens.paper} 0 4px, ${tokens.paperDark} 4px 6px)`;
                fg = tokens.inkDim;
              } else {
                bg = tokens.ink;
                fg = tokens.paper;
              }
              // Show selection on top of any reservation
              border = inRange
                ? `2px solid ${tokens.accent}`
                : isPending
                  ? `1.5px dashed ${tokens.amber}`
                  : `1px solid ${tokens.paperDark}`;
            } else if (inRange) {
              if (mono) {
                bg = "rgba(185, 28, 28, 0.08)";
                border = `2px solid ${tokens.accent}`;
                fg = tokens.ink;
              } else {
                bg = `repeating-linear-gradient(45deg, ${tokens.paperDeep} 0 4px, ${tokens.paperDark} 4px 6px)`;
                border = `2px dashed ${tokens.accent}`;
                fg = tokens.ink;
              }
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
                  borderRadius: mono ? "var(--radius-xs, 4px)" : 0,
                  fontFamily: fontMono,
                  fontSize: 9,
                  minHeight: 44,
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 8, opacity: 0.75 }}>{dayNames[d.getUTCDay()]}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{d.getUTCDate()}</div>
                <div style={{ fontSize: 7, marginTop: 1, opacity: isFirst && res ? 0.85 : 0 }}>
                  {isFirst && res ? res.person_name?.slice(0, 4) : "·"}
                </div>
                {isFirst && isPending && (
                  <div
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      fontSize: 9,
                      color: tokens.amber,
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
