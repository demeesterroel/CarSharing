"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useDashboard, useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useTrips } from "@/hooks/use-trips";
import { useFuelFillups } from "@/hooks/use-fuel-fillups";
import { useReservations } from "@/hooks/use-reservations";
import { useExpenses } from "@/hooks/use-expenses";
import { MultiFab } from "@/components/fab";
import {
  paper,
  fontMono,
  fontSerif,
  fmtMoney,
  fmtDate,
  fmtKm,
  amtColor,
  signPrefix,
} from "@/lib/paper-theme";
import type { Trip, FuelFillup, Reservation, Expense } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { TripForm } from "@/app/trips/trip-form";
import { FuelForm } from "@/app/fuel/fuel-form";
import { ExpenseForm } from "@/app/expenses/expense-form";
import { ReservationForm } from "@/app/calendar/reservation-form";
import { toast } from "sonner";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { TripCard } from "@/components/trip-card";
import { FuelCard } from "@/components/fuel-card";
import { ExpenseCard } from "@/components/expense-card";
import { ReservationCard } from "@/components/reservation-card";
import { useMe } from "@/hooks/use-me";
import { useSettlement } from "@/hooks/use-settlement";
import type { CarDashboardBreakdown } from "@/types";
import {
  useCreateTrip,
  useUpdateTrip,
  useDeleteTrip,
  useCreateFuelFillup,
  useUpdateFuelFillup,
  useDeleteFuelFillup,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "./dashboard-hooks";
import { useCars } from "@/hooks/use-cars";
import { CarBadge } from "@/components/car-badge";
import { ErrorBoundary } from "@/components/error-boundary";

// ── Primitives ────────────────────────────────────────────────────
function NameEditLink({ name, personId }: { name: string; personId: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/user/${personId}/edit`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: 6 }}
    >
      {" "}{name}
      <span
        style={{
          fontSize: 16,
          opacity: hover ? 0.6 : 0,
          transition: "opacity 0.15s",
          lineHeight: 1,
          alignSelf: "center",
        }}
      >
        ✏️
      </span>
    </Link>
  );
}

function Perf({ margin = "12px 0" }: { margin?: string }) {
  return <div style={{ height: 0, borderTop: `1.5px dashed ${paper.ink}`, margin }} />;
}

function ReceiptRow({
  label,
  value,
  big,
  color,
  href,
}: {
  label: string;
  value?: string;
  big?: boolean;
  color?: string;
  href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const c = color ?? paper.ink;
  const inner = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: fontMono,
        padding: "4px 0",
        ...(href
          ? {
              margin: "0 -8px",
              padding: "4px 8px",
              background: hovered ? "rgba(0,0,0,0.05)" : "transparent",
              borderRadius: 2,
              transition: "background 0.1s",
            }
          : {}),
      }}
    >
      <span
        style={{
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: big ? 11 : 10,
          color: paper.inkDim,
          whiteSpace: "nowrap",
          marginRight: 12,
          ...(href && hovered
            ? { textDecoration: "underline", textDecorationColor: paper.inkDim }
            : {}),
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: big ? 700 : 600,
          fontSize: big ? 17 : 13,
          whiteSpace: "nowrap",
          color: c,
        }}
      >
        {value ?? ""}
      </span>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        style={{ textDecoration: "none", display: "block" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

// ── Car Breakdown Section ─────────────────────────────────────────
function CarBreakdownSection({ bd, year }: { bd: CarDashboardBreakdown; year: number }) {
  const fmtL = (l: number) => l.toFixed(0);
  const headerLabel = `${bd.car_short} — ${bd.car_name}`;
  const headerNet = bd.net_car;

  if (bd.is_own_car) {
    const othersHasData = bd.trip_count > 0 || bd.fuel_count > 0 || bd.expense_count > 0;
    const ownHasData = bd.own_trip_count > 0 || bd.own_fuel_count > 0 || bd.own_expense_count > 0;

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: fontMono,
            fontSize: 11,
            fontWeight: 700,
            color: paper.ink,
            padding: "4px 0 2px",
          }}
        >
          <span>{headerLabel}</span>
          <span style={{ color: amtColor(headerNet) }}>
            {headerNet >= 0 ? `+ ${fmtMoney(headerNet)}` : `− ${fmtMoney(Math.abs(headerNet))}`}
          </span>
        </div>

        {othersHasData && (
          <div style={{ paddingLeft: 8, marginTop: 2 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1,
                color: paper.inkMute,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Anderen
            </div>
            {bd.trip_count > 0 && (
              <ReceiptRow
                href={`/trips?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.trip_count} ritten · ${bd.trip_km.toLocaleString("nl-BE")} km`}
                value={`+ ${fmtMoney(bd.trip_amount)}`}
                color={paper.green}
              />
            )}
            {bd.fuel_count > 0 && (
              <ReceiptRow
                href={`/fuel?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.fuel_count} tankbeurten, ${fmtL(bd.fuel_liters)} L`}
                value={`− ${fmtMoney(bd.fuel_amount)}`}
                color={paper.accent}
              />
            )}
            {bd.expense_count > 0 && (
              <ReceiptRow
                href={`/expenses?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.expense_count} kosten`}
                value={`− ${fmtMoney(bd.expense_amount)}`}
                color={paper.accent}
              />
            )}
          </div>
        )}

        {ownHasData && (
          <div style={{ paddingLeft: 8, marginTop: 4 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1,
                color: paper.inkMute,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Eigen
            </div>
            {bd.own_trip_count > 0 && (
              <ReceiptRow
                href={`/trips?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_trip_count} ritten · ${bd.own_trip_km.toLocaleString("nl-BE")} km`}
                color={paper.inkMute}
              />
            )}
            {bd.own_fuel_count > 0 && (
              <ReceiptRow
                href={`/fuel?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_fuel_count} tankbeurten, ${fmtL(bd.own_fuel_liters)} L`}
                color={paper.inkMute}
              />
            )}
            {bd.own_expense_count > 0 && (
              <ReceiptRow
                href={`/expenses?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_expense_count} kosten`}
                color={paper.inkMute}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Cross-car section
  const hasData = bd.trip_count > 0 || bd.fuel_count > 0 || bd.expense_count > 0;
  if (!hasData) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 11,
          fontWeight: 700,
          color: paper.ink,
          padding: "4px 0 2px",
        }}
      >
        <span>{headerLabel}</span>
        <span style={{ color: amtColor(headerNet) }}>
          {headerNet >= 0 ? `+ ${fmtMoney(headerNet)}` : `− ${fmtMoney(Math.abs(headerNet))}`}
        </span>
      </div>
      <div style={{ paddingLeft: 8 }}>
        {bd.trip_count > 0 && (
          <ReceiptRow
            href={`/trips?mine=true&year=${year}`}
            label={`${bd.trip_count} ritten · ${bd.trip_km.toLocaleString("nl-BE")} km`}
            value={`− ${fmtMoney(bd.trip_amount)}`}
            color={paper.accent}
          />
        )}
        {bd.fuel_count > 0 && (
          <ReceiptRow
            href={`/fuel?mine=true&car=${bd.car_short}&year=${year}`}
            label={`${bd.fuel_count} tankbeurten, ${fmtL(bd.fuel_liters)} L`}
            value={`+ ${fmtMoney(bd.fuel_amount)}`}
            color={paper.green}
          />
        )}
        {bd.expense_count > 0 && (
          <ReceiptRow
            href={`/expenses?mine=true&car=${bd.car_short}&year=${year}`}
            label={`${bd.expense_count} kosten`}
            value={`+ ${fmtMoney(bd.expense_amount)}`}
            color={paper.green}
          />
        )}
      </div>
    </div>
  );
}

// ── Balance Receipt ───────────────────────────────────────────────
function BalanceReceipt({ personName }: { personName: string }) {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data: rows = [] } = useDashboard(year);
  const myRow = rows.find((r) => r.person_name === personName);
  const { data: settlement } = useSettlement(year);
  const myStatement = settlement?.members.find((m) => m.person_name === personName);
  const owner_net: number | null = myRow?.is_owner ? (myStatement?.net ?? null) : null;
  if (!myRow) return null;

  const pl = (n: number, s: string, p: string) => (n === 1 ? s : p);
  const yours = t("dashboard.your");

  const tripLabel = `${yours} ${myRow.trip_count} ${pl(myRow.trip_count, t("dashboard.noun_trip"), t("dashboard.noun_trips"))}, ${fmtKm(myRow.trip_km)} km`;
  const fuelLabel = `${yours} ${myRow.fuel_count} ${pl(myRow.fuel_count, t("dashboard.noun_fillup"), t("dashboard.noun_fillups"))}, ${myRow.fuel_liters.toFixed(0)} L`;
  const expenseLabel = `${yours} ${myRow.expense_count} ${pl(myRow.expense_count, t("dashboard.noun_expense"), t("dashboard.noun_expenses"))}`;

  const settled = Math.abs(myRow.balance) <= 0.05;
  const balanceColor = settled ? paper.green : paper.accent;

  return (
    <div style={{ padding: "18px 16px 0" }}>
      {/* Year navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginBottom: 8,
        }}
      >
        <button
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= earliestYear}
          style={{
            padding: "6px 14px",
            background: "transparent",
            border: `1.5px solid ${paper.ink}`,
            borderRight: "none",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            color: year <= earliestYear ? paper.inkMute : paper.ink,
            cursor: year <= earliestYear ? "default" : "pointer",
            letterSpacing: 1,
          }}
        >
          ← {year - 1}
        </button>
        <div
          style={{
            padding: "6px 18px",
            background: paper.ink,
            color: paper.paper,
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            border: `1.5px solid ${paper.ink}`,
          }}
        >
          {year}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          style={{
            padding: "6px 14px",
            background: "transparent",
            border: `1.5px solid ${paper.ink}`,
            borderLeft: "none",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            color: year >= currentYear ? paper.inkMute : paper.ink,
            cursor: year >= currentYear ? "default" : "pointer",
            letterSpacing: 1,
          }}
        >
          {year + 1} →
        </button>
      </div>

      {/* Receipt card */}
      <div
        style={{
          position: "relative",
          background: paper.paper,
          padding: "20px 18px 22px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
        }}
      >
        {/* Owner badge */}
        {myRow.is_owner && (
          <span
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              fontFamily: fontMono,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: paper.paper,
              background: paper.green,
              padding: "2px 7px",
            }}
          >
            eigenaar
          </span>
        )}

        {/* Title */}
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.ink,
            letterSpacing: 3,
            textTransform: "uppercase",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          — {t("dashboard.receipt_title", { year })} —
        </div>
        <Perf margin="10px 0 12px" />

        {myRow.is_owner ? (
          <>
            {/* Per-car breakdowns */}
            {myRow.car_breakdowns.map((bd, i) => (
              <div key={bd.car_short}>
                {i > 0 && <Perf margin="10px 0" />}
                <CarBreakdownSection bd={bd} year={year} />
              </div>
            ))}

            {/* Total */}
            <Perf margin="10px 0" />
            <ReceiptRow
              label={t("dashboard.total_label")}
              value={
                owner_net !== null
                  ? owner_net >= 0
                    ? `+ ${fmtMoney(owner_net)}`
                    : `− ${fmtMoney(Math.abs(owner_net))}`
                  : "—"
              }
              color={owner_net !== null ? amtColor(owner_net) : paper.inkMute}
              big
            />

            {/* Payment */}
            <Perf margin="10px 0" />
            {myRow.paid_amount !== 0 ? (
              <ReceiptRow
                label={t("dashboard.paid_label")}
                value={`${signPrefix(-myRow.paid_amount)}${fmtMoney(myRow.paid_amount)}`}
              />
            ) : (
              <ReceiptRow label={t("dashboard.not_yet_paid")} value="—" color={paper.inkMute} />
            )}

            {/* Balance = owner_net + paid_amount */}
            {myRow.paid_amount !== 0 &&
              owner_net !== null &&
              (() => {
                const saldo = Math.round((owner_net + myRow.paid_amount) * 100) / 100;
                const isSettled = Math.abs(saldo) <= 0.05;
                return (
                  <>
                    <Perf margin="10px 0" />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        padding: "4px 0",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: fontMono,
                          fontSize: 10,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: paper.inkDim,
                          whiteSpace: "nowrap",
                          marginRight: 12,
                        }}
                      >
                        {t("dashboard.balance_label")}
                      </span>
                      <span
                        style={{
                          fontFamily: fontSerif,
                          fontSize: 28,
                          fontWeight: 700,
                          color: isSettled ? paper.green : paper.accent,
                          letterSpacing: -1,
                          lineHeight: 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSettled
                          ? `${fmtMoney(0)} ✓`
                          : saldo >= 0
                            ? `+ ${fmtMoney(saldo)}`
                            : `− ${fmtMoney(Math.abs(saldo))}`}
                      </span>
                    </div>
                  </>
                );
              })()}
          </>
        ) : (
          <>
            {/* ── NON-OWNER: existing code ── */}
            {/* Activity lines */}
            <ReceiptRow
              href={`/trips?mine=true&year=${year}`}
              label={tripLabel}
              value={`− ${fmtMoney(Math.abs(myRow.trip_amount))}`}
              color={paper.accent}
            />
            <ReceiptRow
              href={`/fuel?mine=true&year=${year}`}
              label={fuelLabel}
              value={`+ ${fmtMoney(myRow.fuel_amount)}`}
              color={paper.green}
            />
            <ReceiptRow
              href={`/expenses?mine=true&year=${year}`}
              label={expenseLabel}
              value={`+ ${fmtMoney(myRow.expense_amount)}`}
              color={paper.green}
            />

            {/* Total */}
            <Perf margin="10px 0" />
            <ReceiptRow
              label={t("dashboard.total_label")}
              value={`${signPrefix(myRow.total_amount)}${fmtMoney(myRow.total_amount)}`}
              color={amtColor(myRow.total_amount)}
              big
            />

            {/* Payment row — always shown */}
            <Perf margin="10px 0" />
            {myRow.paid_amount !== 0 ? (
              <ReceiptRow
                label={t("dashboard.paid_label")}
                value={`${signPrefix(-myRow.paid_amount)}${fmtMoney(myRow.paid_amount)}`}
              />
            ) : (
              <ReceiptRow label={t("dashboard.not_yet_paid")} value="—" color={paper.inkMute} />
            )}

            {/* Balance row — only when a payment has been recorded */}
            {myRow.paid_amount !== 0 && (
              <>
                <Perf margin="10px 0" />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "4px 0",
                  }}
                >
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 10,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: paper.inkDim,
                      whiteSpace: "nowrap",
                      marginRight: 12,
                    }}
                  >
                    {t("dashboard.balance_label")}
                  </span>
                  <span
                    style={{
                      fontFamily: fontSerif,
                      fontSize: 28,
                      fontWeight: 700,
                      color: balanceColor,
                      letterSpacing: -1,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {settled
                      ? `${fmtMoney(0)} ✓`
                      : `${signPrefix(myRow.balance)}${fmtMoney(myRow.balance)}`}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ title, href }: { title: string; href: string }) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "24px 20px 10px",
      }}
    >
      <div
        style={{
          fontFamily: fontSerif,
          fontSize: 20,
          fontWeight: 700,
          color: paper.ink,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </div>
      <Link
        href={href}
        style={{
          fontFamily: fontMono,
          fontSize: 10,
          color: paper.inkDim,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          borderBottom: `1px solid ${paper.inkDim}`,
          textDecoration: "none",
        }}
      >
        {t("action.see_all")}
      </Link>
    </div>
  );
}

// ── Car Locations ─────────────────────────────────────────────
function CarLocations({
  trips,
  onTripClick,
}: {
  trips: Trip[];
  onTripClick: (trip: Trip) => void;
}) {
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
      <div
        style={{
          background: paper.paper,
          padding: "16px 18px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
        }}
      >
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.ink,
            letterSpacing: 3,
            textTransform: "uppercase",
            textAlign: "center",
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          — {t("dashboard.car_locations")} —
        </div>
        {entries.map(([short, trip]) => {
          const isParkingOnly = !trip.location && !trip.gps_coords && trip.parking;
          const loc = trip.location ?? trip.gps_coords ?? trip.parking;
          return (
            <button
              key={short}
              onClick={() => onTripClick(trip)}
              style={{
                width: "100%",
                textAlign: "left",
                appearance: "none",
                background: "transparent",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 12,
                paddingTop: 10,
                paddingBottom: 10,
                borderTop: `1px dashed ${paper.paperDark}`,
                cursor: "pointer",
              }}
            >
              <CarBadge short={short} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: fontSerif,
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: isParkingOnly ? paper.inkDim : paper.ink,
                    fontStyle: isParkingOnly ? "italic" : "normal",
                  }}
                >
                  {loc ?? "—"}
                </div>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkMute,
                    letterSpacing: 1,
                    marginTop: 2,
                  }}
                >
                  {t("dashboard.last_seen")} · {fmtDate(trip.date)}
                </div>
              </div>
              <div
                style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, flexShrink: 0 }}
              >
                ›
              </div>
            </button>
          );
        })}
      </div>
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
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    background: paper.paper,
    borderRadius: "16px 16px 0 0",
    zIndex: 50,
    maxHeight: "95vh",
    overflowY: "auto",
    maxWidth: 480,
    margin: "0 auto",
  };

  return (
    <>
      <Dialog.Root open={sheet === "trip"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.trip_add")}
            </Dialog.Title>
            <TripForm
              onSubmit={(d) =>
                createTrip.mutate(d as any, {
                  onSuccess: () => {
                    close();
                    toast.success(t("toast.trip_saved"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={close}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "fuel"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.fuel_add")}
            </Dialog.Title>
            <FuelForm
              onSubmit={(d) =>
                createFuel.mutate(d as any, {
                  onSuccess: () => {
                    close();
                    toast.success(t("toast.fuel_saved"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={close}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "expense"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.expense_add")}
            </Dialog.Title>
            <ExpenseForm
              onSubmit={(d) =>
                createExpense.mutate(d as any, {
                  onSuccess: () => {
                    close();
                    toast.success(t("toast.expense_saved"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={close}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={sheet === "reserve"} onOpenChange={(o) => !o && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content style={sheetStyle}>
            <Dialog.Title
              style={{
                padding: "16px 20px 0",
                fontFamily: fontSerif,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {t("page.reservation_request")}
            </Dialog.Title>
            <ReservationForm
              onSubmit={(d) =>
                createReservation.mutate(d as any, {
                  onSuccess: () => {
                    close();
                    toast.success(t("toast.reservation_requested"));
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
              onCancel={close}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
function DashboardContent() {
  const t = useT();
  const { data: me } = useMe();
  const [sheet, setSheet] = useState<SheetType>(null);

  // Edit state
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [editFuel, setEditFuel] = useState<FuelFillup | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editReservation, setEditReservation] = useState<Reservation | null>(null);

  // Mutation hooks
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const updateFuel = useUpdateFuelFillup();
  const deleteFuel = useDeleteFuelFillup();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const updateRes = useUpdateReservation();
  const deleteRes = useDeleteReservation();

  const { data: trips = [] } = useTrips();
  const { data: fillups = [] } = useFuelFillups();
  const { data: reservations = [] } = useReservations();
  const { data: expenses = [] } = useExpenses();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations
    .filter((r) => r.end_date >= today && r.status !== "rejected")
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3);

  const recentTrips = trips.slice(0, 4);
  const recentFuel = fillups.slice(0, 3);
  const recentExpenses = expenses.slice(0, 3);

  const todayFmt = useMemo(
    () =>
      new Date().toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" }),
    []
  );

  const sheetStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(100%, 480px)",
    maxHeight: "92dvh",
    borderRadius: "14px 14px 0 0",
    background: paper.paperDeep,
    zIndex: 50,
    overflowY: "auto",
  };
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 49,
  };

  return (
    <div style={{ background: paper.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader
        title={
          <>
            {t("dashboard.hello")}
            {me?.personName && me?.personId ? (
              <NameEditLink name={me.personName.split(" ")[0]} personId={me.personId} />
            ) : null}
          </>
        }
        subtitle={`${t("dashboard.today")} · ${todayFmt}`}
        titleSize={32}
      />

      {/* Balance */}
      <BalanceReceipt personName={me?.personName ?? ""} />

      {/* Car locations */}
      <CarLocations trips={trips} onTripClick={setEditTrip} />

      {/* Recent trips */}
      <SectionHeader title={t("dashboard.recent_trips")} href="/trips" />
      <div style={{ padding: "0 16px" }}>
        {recentTrips.length === 0 ? (
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkMute,
              padding: "8px 0",
              letterSpacing: 1,
            }}
          >
            {t("state.empty_trips")}
          </div>
        ) : (
          recentTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onClick={() => setEditTrip(trip)} />
          ))
        )}
      </div>

      {/* Recent fuel */}
      <SectionHeader title={t("dashboard.recent_fuel")} href="/fuel" />
      <div style={{ padding: "0 16px" }}>
        {recentFuel.length === 0 ? (
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkMute,
              padding: "8px 0",
              letterSpacing: 1,
            }}
          >
            {t("state.empty_fuel")}
          </div>
        ) : (
          recentFuel.map((f) => <FuelCard key={f.id} fuel={f} onClick={() => setEditFuel(f)} />)
        )}
      </div>

      {/* Recent expenses */}
      <SectionHeader title={t("dashboard.recent_maintenance")} href="/expenses" />
      <div style={{ padding: "0 16px" }}>
        {recentExpenses.length === 0 ? (
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkMute,
              padding: "8px 0",
              letterSpacing: 1,
            }}
          >
            {t("state.empty_expenses")}
          </div>
        ) : (
          recentExpenses.map((e) => (
            <ExpenseCard key={e.id} expense={e} onClick={() => setEditExpense(e)} />
          ))
        )}
      </div>

      {/* Upcoming reservations */}
      {upcoming.length > 0 && (
        <>
          <SectionHeader title={t("dashboard.upcoming")} href="/calendar" />
          <div style={{ padding: "0 16px" }}>
            {upcoming.map((r) => (
              <ReservationCard key={r.id} reservation={r} onClick={() => setEditReservation(r)} />
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div
        style={{
          fontFamily: fontSerif,
          fontSize: 12,
          fontStyle: "italic",
          color: paper.inkMute,
          textAlign: "center",
          padding: "32px 32px 20px",
          lineHeight: 1.5,
        }}
      >
        {t("dashboard.footer")}
      </div>

      <MultiFab onPick={(action) => setSheet(action as SheetType)} />
      <Sheets sheet={sheet} setSheet={setSheet} />

      {/* Edit: Trip */}
      <Dialog.Root open={!!editTrip} onOpenChange={(o) => !o && setEditTrip(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={overlayStyle} />
          <Dialog.Content style={sheetStyle} aria-describedby={undefined}>
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("page.trip_edit")}
            </Dialog.Title>
            {editTrip && (
              <TripForm
                defaultValues={editTrip}
                onSubmit={(d) =>
                  updateTrip.mutate({ id: editTrip.id, ...d } as any, {
                    onSuccess: () => {
                      setEditTrip(null);
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
                onCancel={() => setEditTrip(null)}
                onDelete={() =>
                  deleteTrip.mutate(editTrip.id, {
                    onSuccess: () => {
                      setEditTrip(null);
                      toast.success(t("toast.trip_deleted"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
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
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("page.fuel_edit")}
            </Dialog.Title>
            {editFuel && (
              <FuelForm
                defaultValues={editFuel}
                onSubmit={(d) =>
                  updateFuel.mutate(
                    { id: editFuel.id, ...d },
                    {
                      onSuccess: () => {
                        setEditFuel(null);
                        toast.success(t("toast.saved"));
                      },
                      onError: (e) => toast.error(e.message),
                    }
                  )
                }
                onCancel={() => setEditFuel(null)}
                onDelete={() =>
                  deleteFuel.mutate(editFuel.id, {
                    onSuccess: () => {
                      setEditFuel(null);
                      toast.success(t("toast.deleted"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
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
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("page.expense_edit")}
            </Dialog.Title>
            {editExpense && (
              <ExpenseForm
                defaultValues={editExpense}
                onSubmit={(d) =>
                  updateExpense.mutate({ id: editExpense.id, ...d } as any, {
                    onSuccess: () => {
                      setEditExpense(null);
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
                onCancel={() => setEditExpense(null)}
                onDelete={() =>
                  deleteExpense.mutate(editExpense.id, {
                    onSuccess: () => {
                      setEditExpense(null);
                      toast.success(t("toast.deleted"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
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
            <Dialog.Title
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
              }}
            >
              {t("page.reservation_edit")}
            </Dialog.Title>
            {editReservation && (
              <ReservationForm
                defaultValues={editReservation}
                onSubmit={(d) =>
                  updateRes.mutate({ id: editReservation.id, ...d } as any, {
                    onSuccess: () => {
                      setEditReservation(null);
                      toast.success(t("toast.saved"));
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
                onCancel={() => setEditReservation(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
