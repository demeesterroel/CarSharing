"use client";
import { useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/hooks/use-dashboard";
import { useTrips } from "@/hooks/use-trips";
import { useFuelFillups } from "@/hooks/use-fuel-fillups";
import { useReservations } from "@/hooks/use-reservations";
import { useExpenses } from "@/hooks/use-expenses";
import { MultiFab } from "@/components/fab";
import { paper, fontMono, fontSerif, fmtMoney, fmtDate, fmtKm } from "@/lib/paper-theme";
import type { Trip, FuelFillup, Reservation, Expense } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { TripForm } from "@/app/trips/trip-form";
import { FuelForm } from "@/app/fuel/fuel-form";
import { ExpenseForm } from "@/app/expenses/expense-form";
import { ReservationForm } from "@/app/calendar/reservation-form";
import { toast } from "sonner";
import { useT } from "@/components/locale-provider";
import {
  useCreateTrip, useCreateFuelFillup, useCreateExpense, useCreateReservation,
} from "./dashboard-hooks";

// ── Primitives ────────────────────────────────────────────────────
function Perf({ margin = "12px 0" }: { margin?: string }) {
  return <div style={{ height: 0, borderTop: `1.5px dashed ${paper.ink}`, margin }} />;
}

function ReceiptRow({
  label, value, big, color,
}: { label: string; value: string; big?: boolean; color?: string }) {
  const c = color ?? paper.ink;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      fontFamily: fontMono, padding: "4px 0",
    }}>
      <span style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: big ? 11 : 10, color: paper.inkDim, whiteSpace: "nowrap", marginRight: 12 }}>
        {label}
      </span>
      <span style={{ fontWeight: big ? 700 : 600, fontSize: big ? 17 : 13, whiteSpace: "nowrap", color: c }}>
        {value}
      </span>
    </div>
  );
}

function CarStamp({ code }: { code: string }) {
  return (
    <div style={{
      padding: "6px 8px", textAlign: "center",
      border: `1.5px solid ${paper.ink}`,
      background: paper.ink, color: paper.paper,
      fontFamily: fontMono, fontSize: 11, fontWeight: 700, letterSpacing: 2,
      display: "inline-block", minWidth: 42, flexShrink: 0,
    }}>{code}</div>
  );
}

// ── Balance Receipt ───────────────────────────────────────────────
function BalanceReceipt({ year, personName }: { year: number; personName: string }) {
  const t = useT();
  const { data: rows = [] } = useDashboard(year);
  const myRow = rows.find((r) => r.person_name === personName);
  if (!myRow) return null;

  const positive = myRow.balance >= 0;
  const stampColor = positive ? paper.green : paper.accent;

  return (
    <div style={{ padding: "18px 16px 0" }}>
      <div style={{
        background: paper.paper, padding: "20px 18px 22px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
      }}>
        <div style={{
          fontFamily: fontMono, fontSize: 11, color: paper.ink,
          letterSpacing: 3, textTransform: "uppercase", textAlign: "center", fontWeight: 700,
        }}>— {t("dashboard.year_balance", { year })} —</div>
        <Perf margin="10px 0 12px" />

        <ReceiptRow label={t("dashboard.your_trips")}       value={`− ${fmtMoney(Math.abs(myRow.trip_amount))}`} />
        <ReceiptRow label={t("dashboard.your_fuel")}        value={fmtMoney(myRow.fuel_amount)} />
        <ReceiptRow label={t("dashboard.your_maintenance")} value={fmtMoney(myRow.expense_amount)} />

        <Perf margin="10px 0" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
          <div style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: paper.inkDim, whiteSpace: "nowrap", marginRight: 12 }}>
            {positive ? t("dashboard.credit_label") : t("dashboard.debit_label")}
          </div>
          <div style={{ fontFamily: fontSerif, fontSize: 34, fontWeight: 700, color: stampColor, letterSpacing: -1, lineHeight: 1, whiteSpace: "nowrap" }}>
            {positive ? "+ " : "− "}{fmtMoney(Math.abs(myRow.balance))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{
            display: "inline-block", padding: "6px 14px",
            border: `2.5px solid ${stampColor}`, borderRadius: 4, color: stampColor,
            fontFamily: fontMono, fontSize: 11, fontWeight: 700,
            letterSpacing: 2, textTransform: "uppercase",
            transform: "rotate(-5deg)", opacity: 0.9,
          }}>
            {positive ? t("dashboard.stamp_credit") : t("dashboard.stamp_debit")}
          </div>
        </div>

        <Perf margin="16px 0 12px" />
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { n: String(myRow.trip_count), l: t("dashboard.stat_trips") },
            { n: String(myRow.trip_km),    l: "km" },
            { n: String(myRow.fuel_count), l: t("dashboard.stat_fuel") },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: fontSerif, fontSize: 22, fontWeight: 700, color: paper.ink, lineHeight: 1 }}>{x.n}</div>
              <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{x.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ title, href }: { title: string; href: string }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "24px 20px 10px" }}>
      <div style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink, letterSpacing: -0.3 }}>{title}</div>
      <Link href={href} style={{
        fontFamily: fontMono, fontSize: 10, color: paper.inkDim,
        letterSpacing: 1.5, textTransform: "uppercase",
        borderBottom: `1px solid ${paper.inkDim}`, textDecoration: "none",
      }}>{t("action.see_all")}</Link>
    </div>
  );
}

// ── Activity strips ───────────────────────────────────────────
function TripStrip({ trip }: { trip: Trip }) {
  return (
    <div style={{
      background: paper.paper, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      borderLeft: `3px solid ${paper.ink}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <CarStamp code={trip.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, color: paper.ink, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {trip.location ?? "—"}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {trip.person_name} · {fmtDate(trip.date)} · {fmtKm(trip.km)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.ink, whiteSpace: "nowrap" }}>
          {fmtMoney(trip.amount)}
        </div>
      </div>
    </div>
  );
}

function FuelStrip({ fuel }: { fuel: FuelFillup }) {
  const t = useT();
  return (
    <div style={{
      background: paper.paper, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      borderLeft: `3px solid ${paper.accent}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <CarStamp code={fuel.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, color: paper.ink, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ⛽ {fuel.location ?? t("dashboard.fillup_label")}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {fuel.person_name} · {fmtDate(fuel.date)} · {fuel.liters.toFixed(1)}L
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.accent, whiteSpace: "nowrap" }}>
          {fmtMoney(fuel.amount)}
        </div>
      </div>
    </div>
  );
}

function ExpenseStrip({ expense }: { expense: Expense }) {
  const t = useT();
  return (
    <div style={{
      background: paper.paper, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      borderLeft: `3px solid ${paper.amber}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <CarStamp code={expense.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, color: paper.ink, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {expense.description ?? t("dashboard.maintenance_label")}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {expense.person_name} · {fmtDate(expense.date)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.amber, whiteSpace: "nowrap" }}>
          {fmtMoney(expense.amount)}
        </div>
      </div>
    </div>
  );
}

function ReservationStrip({ r }: { r: Reservation }) {
  const t = useT();
  const isPending = r.status === "pending";
  return (
    <div style={{
      background: isPending
        ? `repeating-linear-gradient(-45deg, ${paper.paperDeep}, ${paper.paperDeep} 4px, ${paper.paper} 4px, ${paper.paper} 10px)`
        : paper.paper,
      padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      borderLeft: `3px dashed ${paper.blue}`,
    }}>
      <CarStamp code={r.car_short ?? "?"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 15, color: paper.ink, fontWeight: 600, lineHeight: 1.2 }}>
          {r.note ?? r.person_name}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1, marginTop: 2 }}>
          {r.person_name} · {fmtDate(r.start_date)}
          {r.start_date !== r.end_date ? ` → ${fmtDate(r.end_date)}` : ""}
        </div>
      </div>
      {isPending && (
        <div style={{
          fontFamily: fontMono, fontSize: 8, fontWeight: 700,
          color: paper.amber, letterSpacing: 1, textTransform: "uppercase",
          border: `1px solid ${paper.amber}`, padding: "2px 6px",
        }}>
          {t("dashboard.pending_badge")}
        </div>
      )}
    </div>
  );
}

// ── Sheet dialogs ────────────────────────────────────────────
type SheetType = "trip" | "fuel" | "expense" | "reserve" | null;

function Sheets({ sheet, setSheet }: { sheet: SheetType; setSheet: (s: SheetType) => void }) {
  const t = useT();
  const createTrip = useCreateTrip();
  const createFuel = useCreateFuelFillup();
  const createExpense = useCreateExpense();
  const createReservation = useCreateReservation();

  const close = () => setSheet(null);

  const sheetStyle: React.CSSProperties = {
    position: "fixed", left: 0, right: 0, bottom: 0, background: paper.paper,
    borderRadius: "16px 16px 0 0", zIndex: 50, maxHeight: "95vh",
    overflowY: "auto", maxWidth: 480, margin: "0 auto",
  };

  return (
    <>
      <Dialog.Root open={sheet === "trip"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{t("page.trip_add")}</Dialog.Title>
            <TripForm onSubmit={(d) => createTrip.mutate(d as any, { onSuccess: () => { close(); toast.success(t("toast.trip_saved")); }, onError: (e) => toast.error(e.message) })} onCancel={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "fuel"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{t("page.fuel_add")}</Dialog.Title>
            <FuelForm onSubmit={(d) => createFuel.mutate(d as any, { onSuccess: () => { close(); toast.success(t("toast.fuel_saved")); }, onError: (e) => toast.error(e.message) })} onCancel={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "expense"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{t("page.expense_add")}</Dialog.Title>
            <ExpenseForm onSubmit={(d) => createExpense.mutate(d as any, { onSuccess: () => { close(); toast.success(t("toast.expense_saved")); }, onError: (e) => toast.error(e.message) })} onCancel={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "reserve"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title style={{ padding: "16px 20px 0", fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{t("page.reservation_request")}</Dialog.Title>
            <ReservationForm onSubmit={(d) => createReservation.mutate(d as any, { onSuccess: () => { close(); toast.success(t("toast.reservation_requested")); }, onError: (e) => toast.error(e.message) })} onCancel={close} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const t = useT();
  const year = new Date().getFullYear();
  const [sheet, setSheet] = useState<SheetType>(null);

  const { data: trips = [] }        = useTrips();
  const { data: fillups = [] }      = useFuelFillups();
  const { data: reservations = [] } = useReservations();
  const { data: expenses = [] }     = useExpenses();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations
    .filter((r) => r.end_date >= today && r.status !== "rejected")
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3);

  const recentTrips    = trips.slice(0, 4);
  const recentFuel     = fillups.slice(0, 3);
  const recentExpenses = expenses.slice(0, 3);

  const todayFmt = new Date().toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: paper.paper, padding: "22px 20px 20px", borderBottom: `1.5px dashed ${paper.ink}` }}>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          {t("brand.tagline")}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: paper.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>
          {t("dashboard.hello")}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
          {t("dashboard.today")} · {todayFmt}
        </div>
      </div>

      {/* Balance */}
      <BalanceReceipt year={year} personName="Roeland" />

      {/* Upcoming reservations */}
      {upcoming.length > 0 && (
        <>
          <SectionHeader title={t("dashboard.upcoming")} href="/calendar" />
          <div style={{ padding: "0 16px" }}>
            {upcoming.map((r) => <ReservationStrip key={r.id} r={r} />)}
          </div>
        </>
      )}

      {/* Recent trips */}
      <SectionHeader title={t("dashboard.recent_trips")} href="/trips" />
      <div style={{ padding: "0 16px" }}>
        {recentTrips.length === 0 ? (
          <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, padding: "8px 0", letterSpacing: 1 }}>
            {t("state.empty_trips")}
          </div>
        ) : (
          recentTrips.map((trip) => <TripStrip key={trip.id} trip={trip} />)
        )}
      </div>

      {/* Recent fuel */}
      <SectionHeader title={t("dashboard.recent_fuel")} href="/fuel" />
      <div style={{ padding: "0 16px" }}>
        {recentFuel.length === 0 ? (
          <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, padding: "8px 0", letterSpacing: 1 }}>
            {t("state.empty_fuel")}
          </div>
        ) : (
          recentFuel.map((f) => <FuelStrip key={f.id} fuel={f} />)
        )}
      </div>

      {/* Recent expenses */}
      <SectionHeader title={t("dashboard.recent_maintenance")} href="/expenses" />
      <div style={{ padding: "0 16px" }}>
        {recentExpenses.length === 0 ? (
          <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, padding: "8px 0", letterSpacing: 1 }}>
            {t("state.empty_expenses")}
          </div>
        ) : (
          recentExpenses.map((e) => <ExpenseStrip key={e.id} expense={e} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ fontFamily: fontSerif, fontSize: 12, fontStyle: "italic", color: paper.inkMute, textAlign: "center", padding: "32px 32px 20px", lineHeight: 1.5 }}>
        {t("dashboard.footer")}
      </div>

      <MultiFab onPick={(action) => setSheet(action as SheetType)} />
      <Sheets sheet={sheet} setSheet={setSheet} />
    </div>
  );
}
