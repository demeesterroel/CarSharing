"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LangSwitcher } from "@/components/lang-switcher";
import { useMe } from "@/hooks/use-me";
import {
  useCreateTrip, useUpdateTrip, useDeleteTrip,
  useCreateFuelFillup, useUpdateFuelFillup, useDeleteFuelFillup,
  useCreateExpense, useUpdateExpense, useDeleteExpense,
  useCreateReservation, useUpdateReservation, useDeleteReservation,
} from "./dashboard-hooks";
import { useCars } from "@/hooks/use-cars";

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

        <ReceiptRow label={t("dashboard.your_trips")}       value={`− ${fmtMoney(Math.abs(myRow.trip_amount))}`} color={paper.accent} />
        <ReceiptRow label={t("dashboard.your_fuel")}        value={fmtMoney(myRow.fuel_amount)}                  color={paper.green} />
        <ReceiptRow label={t("dashboard.your_maintenance")} value={fmtMoney(myRow.expense_amount)}              color={paper.green} />

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

// ── Car Locations ─────────────────────────────────────────────
function CarLocations({ trips, onTripClick }: { trips: Trip[]; onTripClick: (trip: Trip) => void }) {
  const t = useT();
  const { data: cars = [] } = useCars();
  const activeShortsSet = new Set(cars.filter((c) => c.active === 1).map((c) => c.short));

  const carMap = new Map<string, Trip>();
  for (const trip of trips) {
    if (trip.car_short && activeShortsSet.has(trip.car_short) && !carMap.has(trip.car_short)) {
      carMap.set(trip.car_short, trip);
    }
  }
  const entries = Array.from(carMap.entries());
  if (entries.length === 0) return null;

  return (
    <div style={{ padding: "18px 16px 0" }}>
      <div style={{
        background: paper.paper, padding: "16px 18px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
      }}>
        <div style={{
          fontFamily: fontMono, fontSize: 11, color: paper.ink,
          letterSpacing: 3, textTransform: "uppercase", textAlign: "center", fontWeight: 700,
          marginBottom: 14,
        }}>— {t("dashboard.car_locations")} —</div>
        {entries.map(([short, trip]) => {
          const isParkingOnly = !trip.location && !trip.gps_coords && trip.parking;
          const loc = trip.location ?? trip.gps_coords ?? trip.parking;
          return (
            <button
              key={short}
              onClick={() => onTripClick(trip)}
              style={{
                width: "100%", textAlign: "left", appearance: "none",
                background: "transparent", border: "none", padding: 0,
                display: "flex", alignItems: "center", gap: 12,
                paddingTop: 10, paddingBottom: 10,
                borderTop: `1px dashed ${paper.paperDark}`,
                cursor: "pointer",
              }}
            >
              <CarStamp code={short} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: fontSerif, fontSize: 14, fontWeight: 600, lineHeight: 1.2,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  color: isParkingOnly ? paper.inkDim : paper.ink,
                  fontStyle: isParkingOnly ? "italic" : "normal",
                }}>
                  {loc ?? "—"}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, marginTop: 2 }}>
                  {t("dashboard.last_seen")} · {fmtDate(trip.date)}
                </div>
              </div>
              <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, flexShrink: 0 }}>›</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity strips ───────────────────────────────────────────
function TripStrip({ trip, onClick }: { trip: Trip; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", appearance: "none",
      background: paper.paper, padding: "12px 14px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 12,
      borderTop: "none", borderRight: "none", borderBottom: "none",
      borderLeft: `3px solid ${paper.accent}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      cursor: onClick ? "pointer" : "default",
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
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.accent, whiteSpace: "nowrap" }}>
          {fmtMoney(trip.amount)}
        </div>
      </div>
    </button>
  );
}

const stripButton: React.CSSProperties = {
  width: "100%", textAlign: "left", appearance: "none",
  background: paper.paper, padding: "12px 14px", marginBottom: 8,
  display: "flex", alignItems: "center", gap: 12,
  borderTop: "none", borderRight: "none", borderBottom: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)", cursor: "pointer",
};

function FuelStrip({ fuel, onClick }: { fuel: FuelFillup; onClick?: () => void }) {
  const t = useT();
  return (
    <button onClick={onClick} style={{ ...stripButton, borderLeft: `3px solid ${paper.green}` }}>
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
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.green, whiteSpace: "nowrap" }}>
          {fmtMoney(fuel.amount)}
        </div>
      </div>
    </button>
  );
}

function ExpenseStrip({ expense, onClick }: { expense: Expense; onClick?: () => void }) {
  const t = useT();
  return (
    <button onClick={onClick} style={{ ...stripButton, borderLeft: `3px solid ${paper.green}` }}>
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
        <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: paper.green, whiteSpace: "nowrap" }}>
          {fmtMoney(expense.amount)}
        </div>
      </div>
    </button>
  );
}

function ReservationStrip({ r, onClick }: { r: Reservation; onClick?: () => void }) {
  const t = useT();
  const isPending = r.status === "pending";
  return (
    <button onClick={onClick} style={{
      ...stripButton,
      background: isPending
        ? `repeating-linear-gradient(-45deg, ${paper.paperDeep}, ${paper.paperDeep} 4px, ${paper.paper} 4px, ${paper.paper} 10px)`
        : paper.paper,
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
    </button>
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
  const { data: me } = useMe();
  const router = useRouter();
  const year = new Date().getFullYear();
  const [sheet, setSheet] = useState<SheetType>(null);

  // Edit state
  const [editTrip, setEditTrip]               = useState<Trip | null>(null);
  const [editFuel, setEditFuel]               = useState<FuelFillup | null>(null);
  const [editExpense, setEditExpense]         = useState<Expense | null>(null);
  const [editReservation, setEditReservation] = useState<Reservation | null>(null);

  // Mutation hooks
  const updateTrip    = useUpdateTrip();
  const deleteTrip    = useDeleteTrip();
  const updateFuel    = useUpdateFuelFillup();
  const deleteFuel    = useDeleteFuelFillup();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const updateRes     = useUpdateReservation();
  const deleteRes     = useDeleteReservation();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

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

  const sheetStyle: React.CSSProperties = {
    position: "fixed", bottom: 0,
    left: "50%", transform: "translateX(-50%)",
    width: "min(100%, 480px)",
    maxHeight: "92dvh", borderRadius: "14px 14px 0 0",
    background: paper.paperDeep, zIndex: 50, overflowY: "auto",
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 49,
  };

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: paper.paper, padding: "22px 20px 20px", borderBottom: `1.5px dashed ${paper.ink}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase" }}>
            {t("brand.tagline")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LangSwitcher />
            <button
              onClick={handleLogout}
              title={t("nav.logout")}
              style={{
                padding: "3px 8px",
                fontFamily: fontMono, fontSize: 9, fontWeight: 700,
                letterSpacing: 1.5, textTransform: "uppercase",
                background: "transparent", color: paper.inkDim,
                border: `1.5px solid ${paper.paperDark}`,
                cursor: "pointer", lineHeight: 1.6,
              }}
            >
              ⏻
            </button>
          </div>
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: paper.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>
          {t("dashboard.hello")}{me?.personName ? ` ${me.personName.split(" ")[0]}` : ""}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>
          {t("dashboard.today")} · {todayFmt}
        </div>
      </div>

      {/* Balance */}
      <BalanceReceipt year={year} personName={me?.personName ?? ""} />

      {/* Car locations */}
      <CarLocations trips={trips} onTripClick={setEditTrip} />

      {/* Recent trips */}
      <SectionHeader title={t("dashboard.recent_trips")} href="/trips" />
      <div style={{ padding: "0 16px" }}>
        {recentTrips.length === 0 ? (
          <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, padding: "8px 0", letterSpacing: 1 }}>
            {t("state.empty_trips")}
          </div>
        ) : (
          recentTrips.map((trip) => <TripStrip key={trip.id} trip={trip} onClick={() => setEditTrip(trip)} />)
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
          recentFuel.map((f) => <FuelStrip key={f.id} fuel={f} onClick={() => setEditFuel(f)} />)
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
          recentExpenses.map((e) => <ExpenseStrip key={e.id} expense={e} onClick={() => setEditExpense(e)} />)
        )}
      </div>

      {/* Upcoming reservations */}
      {upcoming.length > 0 && (
        <>
          <SectionHeader title={t("dashboard.upcoming")} href="/calendar" />
          <div style={{ padding: "0 16px" }}>
            {upcoming.map((r) => <ReservationStrip key={r.id} r={r} onClick={() => setEditReservation(r)} />)}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ fontFamily: fontSerif, fontSize: 12, fontStyle: "italic", color: paper.inkMute, textAlign: "center", padding: "32px 32px 20px", lineHeight: 1.5 }}>
        {t("dashboard.footer")}
      </div>

      <MultiFab onPick={(action) => setSheet(action as SheetType)} />
      <Sheets sheet={sheet} setSheet={setSheet} />

      {/* Edit: Trip */}
      <Dialog.Root open={!!editTrip} onOpenChange={(o) => !o && setEditTrip(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{t("page.trip_edit")}</Dialog.Title>
            {editTrip && (
              <TripForm
                defaultValues={editTrip}
                onSubmit={(d) => updateTrip.mutate({ id: editTrip.id, ...d } as any, {
                  onSuccess: () => { setEditTrip(null); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={() => setEditTrip(null)}
                onDelete={() => deleteTrip.mutate(editTrip.id, {
                  onSuccess: () => { setEditTrip(null); toast.success(t("toast.trip_deleted")); },
                  onError: (e) => toast.error(e.message),
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit: Fuel */}
      <Dialog.Root open={!!editFuel} onOpenChange={(o) => !o && setEditFuel(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{t("page.fuel_edit")}</Dialog.Title>
            {editFuel && (
              <FuelForm
                defaultValues={editFuel}
                onSubmit={(d) => updateFuel.mutate({ id: editFuel.id, ...d }, {
                  onSuccess: () => { setEditFuel(null); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={() => setEditFuel(null)}
                onDelete={() => deleteFuel.mutate(editFuel.id, {
                  onSuccess: () => { setEditFuel(null); toast.success(t("toast.deleted")); },
                  onError: (e) => toast.error(e.message),
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit: Expense */}
      <Dialog.Root open={!!editExpense} onOpenChange={(o) => !o && setEditExpense(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{t("page.expense_edit")}</Dialog.Title>
            {editExpense && (
              <ExpenseForm
                defaultValues={editExpense}
                onSubmit={(d) => updateExpense.mutate({ id: editExpense.id, ...d } as any, {
                  onSuccess: () => { setEditExpense(null); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={() => setEditExpense(null)}
                onDelete={() => deleteExpense.mutate(editExpense.id, {
                  onSuccess: () => { setEditExpense(null); toast.success(t("toast.deleted")); },
                  onError: (e) => toast.error(e.message),
                })}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit: Reservation */}
      <Dialog.Root open={!!editReservation} onOpenChange={(o) => !o && setEditReservation(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{t("page.reservation_edit")}</Dialog.Title>
            {editReservation && (
              <ReservationForm
                defaultValues={editReservation}
                onSubmit={(d) => updateRes.mutate({ id: editReservation.id, ...d } as any, {
                  onSuccess: () => { setEditReservation(null); toast.success(t("toast.saved")); },
                  onError: (e) => toast.error(e.message),
                })}
                onCancel={() => setEditReservation(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
