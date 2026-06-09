"use client";
import { ReservationForm } from "@/app/calendar/reservation-form";
import { ExpenseForm } from "@/app/expenses/expense-form";
import { FuelForm } from "@/app/fuel/fuel-form";
import { TripForm } from "@/app/trips/trip-form";
import { CarBadge } from "@/components/car-badge";
import { ErrorBoundary } from "@/components/error-boundary";
import { ExpenseCard } from "@/components/expense-card";
import { MultiFab } from "@/components/fab";
import { FuelCard } from "@/components/fuel-card";
import { useT } from "@/components/locale-provider";
import { PageHeader } from "@/components/page-header";
import { ReservationCard } from "@/components/reservation-card";
import { ShimmerBar, shimmerKeyframes } from "@/components/shimmer";
import { TripCard } from "@/components/trip-card";
import { useDashboard, useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useExpenses } from "@/hooks/use-expenses";
import { useFuelFillups } from "@/hooks/use-fuel-fillups";
import { useMe } from "@/hooks/use-me";
import { useQueryParam } from "@/hooks/use-query-param";
import { useReservations } from "@/hooks/use-reservations";
import { useSettlement } from "@/hooks/use-settlement";
import { useTrips } from "@/hooks/use-trips";
import { useCars } from "@/hooks/use-vehicles";
import { useTheme } from "@/lib/theme-context";
import {
  amtColor,
  fmtDate,
  fmtKm,
  fmtMoney,
  fontMono,
  fontSerif,
  signPrefix,
  tokens,
} from "@/lib/theme-tokens";
import type { CarDashboardBreakdown, Expense, FuelFillup, Reservation, Trip } from "@/types";
import * as Dialog from "@radix-ui/react-dialog";
import { Fuel as FuelIcon, Navigation, Receipt as ReceiptIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCreateExpense,
  useCreateFuelFillup,
  useCreateReservation,
  useCreateTrip,
  useDeleteExpense,
  useDeleteFuelFillup,
  useDeleteReservation,
  useDeleteTrip,
  useUpdateExpense,
  useUpdateFuelFillup,
  useUpdateReservation,
  useUpdateTrip,
} from "./dashboard-hooks";

// ── Primitives ────────────────────────────────────────────────────
function NameEditLink({ name, personId }: { name: string; personId: number }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/user/${personId}/edit`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        color: "inherit",
        textDecoration: hover ? "underline" : "none",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
      }}
    >
      {" "}
      {name}
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
  const { theme } = useTheme();
  return (
    <div
      style={{
        height: 0,
        borderTop:
          theme === "mono" ? `1px solid ${tokens.paperDark}` : `1.5px dashed ${tokens.ink}`,
        margin,
      }}
    />
  );
}

function ReceiptRow({
  label,
  value,
  big,
  color,
  href,
  icon,
}: {
  label: string;
  value?: string;
  big?: boolean;
  color?: string;
  href?: string;
  icon?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useTheme();
  const mono = theme === "mono";
  const c = color ?? tokens.ink;
  const inner = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: mono ? "center" : "baseline",
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
          display: "flex",
          alignItems: "center",
          gap: 5,
          textTransform: mono ? "none" : ("uppercase" as const),
          letterSpacing: mono ? 0 : 1,
          fontSize: big ? 11 : 10,
          color: mono ? tokens.ink : tokens.inkDim,
          whiteSpace: "nowrap",
          marginRight: 12,
          ...(href && hovered
            ? {
                textDecoration: "underline",
                textDecorationColor: mono ? tokens.ink : tokens.inkDim,
              }
            : {}),
        }}
      >
        {mono && icon && (
          <span style={{ display: "flex", alignItems: "center", opacity: 0.5, flexShrink: 0 }}>
            {icon}
          </span>
        )}
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

function DashboardSettledNote({
  fuelCount,
  fuelLiters,
  expCount,
  expAmt,
}: {
  fuelCount?: number;
  fuelLiters?: number;
  expCount?: number;
  expAmt?: number;
}) {
  const fuelHas = (fuelLiters ?? 0) > 0.05;
  const expHas = (expAmt ?? 0) > 0.005;
  if (!fuelHas && !expHas) return null;
  const expPrefix = fuelHas ? "(**)" : "(*)";
  const noteStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 8,
    color: tokens.inkDim,
    paddingLeft: 8,
    marginTop: 3,
    fontStyle: "italic",
  };
  return (
    <div style={{ marginTop: 4 }}>
      {fuelHas && (
        <div style={noteStyle}>
          {"(*) "}
          {fuelCount} tankbeurt{fuelCount !== 1 ? "en" : ""} ({(fuelLiters ?? 0).toFixed(1)} L){" "}
          buiten afrekening
        </div>
      )}
      {expHas && (
        <div style={noteStyle}>
          {expPrefix} {expCount} kost{expCount !== 1 ? "en" : ""} buiten afrekening
        </div>
      )}
    </div>
  );
}

// ── Car Breakdown Section ─────────────────────────────────────────
function CarBreakdownSection({ bd, year }: { bd: CarDashboardBreakdown; year: number }) {
  const { theme } = useTheme();
  const mono = theme === "mono";
  const fmtL = (l: number) => l.toFixed(0);
  const headerLabel = bd.is_own_car
    ? `${bd.car_short} — ${bd.car_name} (Eigen wagen)`
    : `${bd.car_short} — ${bd.car_name}`;
  const headerNet = bd.net_car;

  const subLabel = (label: string) => (
    <div
      style={{
        fontFamily: fontMono,
        fontSize: 9,
        letterSpacing: mono ? 0 : 1,
        color: tokens.inkDim,
        textTransform: mono ? "none" : ("uppercase" as const),
        marginBottom: 2,
      }}
    >
      {label}
    </div>
  );

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
            fontSize: mono ? 13 : 11,
            fontWeight: 700,
            color: tokens.ink,
            padding: "4px 0 2px",
          }}
        >
          <span>{headerLabel}</span>
          <span style={{ color: amtColor(headerNet), fontSize: mono ? 15 : 15 }}>
            {headerNet >= 0 ? `+ ${fmtMoney(headerNet)}` : `− ${fmtMoney(Math.abs(headerNet))}`}
          </span>
        </div>

        {othersHasData && (
          <div style={{ paddingLeft: 8, marginTop: 2 }}>
            {subLabel("Anderen")}
            {bd.trip_count > 0 && (
              <ReceiptRow
                href={`/trips?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.trip_count} ritten · ${bd.trip_km.toLocaleString("nl-BE")} km`}
                value={`+ ${fmtMoney(bd.trip_amount)}`}
                color={tokens.green}
                icon={<Navigation size={11} />}
              />
            )}
            {bd.fuel_count > 0 && (
              <ReceiptRow
                href={`/fuel?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.fuel_count} tankbeurten, ${fmtL(bd.fuel_liters)} L${(bd.fuel_settled_liters ?? 0) > 0.05 ? " (*)" : ""}`}
                value={`− ${fmtMoney(bd.fuel_amount)}`}
                color={tokens.accent}
                icon={<FuelIcon size={11} />}
              />
            )}
            {bd.expense_count > 0 && (
              <ReceiptRow
                href={`/expenses?mine=false&car=${bd.car_short}&year=${year}`}
                label={`${bd.expense_count} kosten${(bd.expense_settled_amount ?? 0) > 0.005 ? ((bd.fuel_settled_liters ?? 0) > 0.05 ? " (**)" : " (*)") : ""}`}
                value={`− ${fmtMoney(bd.expense_amount)}`}
                color={tokens.accent}
                icon={<ReceiptIcon size={11} />}
              />
            )}
            <DashboardSettledNote
              fuelCount={bd.fuel_settled_count}
              fuelLiters={bd.fuel_settled_liters}
              expCount={bd.expense_settled_count}
              expAmt={bd.expense_settled_amount}
            />
          </div>
        )}

        {ownHasData && (
          <div style={{ paddingLeft: 8, marginTop: 4 }}>
            {subLabel("Eigen")}
            {bd.own_trip_count > 0 && (
              <ReceiptRow
                href={`/trips?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_trip_count} ritten · ${bd.own_trip_km.toLocaleString("nl-BE")} km`}
                color={tokens.inkDim}
                icon={<Navigation size={11} />}
              />
            )}
            {bd.own_fuel_count > 0 && (
              <ReceiptRow
                href={`/fuel?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_fuel_count} tankbeurten, ${fmtL(bd.own_fuel_liters)} L`}
                color={tokens.inkDim}
                icon={<FuelIcon size={11} />}
              />
            )}
            {bd.own_expense_count > 0 && (
              <ReceiptRow
                href={`/expenses?mine=true&car=${bd.car_short}&year=${year}`}
                label={`${bd.own_expense_count} kosten`}
                color={tokens.inkDim}
                icon={<ReceiptIcon size={11} />}
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
          fontSize: mono ? 13 : 11,
          fontWeight: 700,
          color: tokens.ink,
          padding: "4px 0 2px",
        }}
      >
        <span>{headerLabel}</span>
        <span style={{ color: amtColor(headerNet), fontSize: 15 }}>
          {headerNet >= 0 ? `+ ${fmtMoney(headerNet)}` : `− ${fmtMoney(Math.abs(headerNet))}`}
        </span>
      </div>
      <div style={{ paddingLeft: 8 }}>
        {bd.trip_count > 0 && (
          <ReceiptRow
            href={`/trips?mine=true&year=${year}`}
            label={`${bd.trip_count} ritten · ${bd.trip_km.toLocaleString("nl-BE")} km`}
            value={`− ${fmtMoney(bd.trip_amount)}`}
            color={tokens.accent}
            icon={<Navigation size={11} />}
          />
        )}
        {bd.fuel_count > 0 && (
          <ReceiptRow
            href={`/fuel?mine=true&car=${bd.car_short}&year=${year}`}
            label={`${bd.fuel_count} tankbeurten, ${fmtL(bd.fuel_liters)} L${(bd.fuel_settled_liters ?? 0) > 0.05 ? " (*)" : ""}`}
            value={`+ ${fmtMoney(bd.fuel_amount)}`}
            color={tokens.green}
            icon={<FuelIcon size={11} />}
          />
        )}
        {bd.expense_count > 0 && (
          <ReceiptRow
            href={`/expenses?mine=true&car=${bd.car_short}&year=${year}`}
            label={`${bd.expense_count} kosten${(bd.expense_settled_amount ?? 0) > 0.005 ? ((bd.fuel_settled_liters ?? 0) > 0.05 ? " (**)" : " (*)") : ""}`}
            value={`+ ${fmtMoney(bd.expense_amount)}`}
            color={tokens.green}
            icon={<ReceiptIcon size={11} />}
          />
        )}
        <DashboardSettledNote
          fuelCount={bd.fuel_settled_count}
          fuelLiters={bd.fuel_settled_liters}
          expCount={bd.expense_settled_count}
          expAmt={bd.expense_settled_amount}
        />
      </div>
    </div>
  );
}

// ── Balance Card Skeleton ─────────────────────────────────────────
function SkeletonRow({
  leftWidth = "45%",
  rightWidth = "20%",
}: {
  leftWidth?: string;
  rightWidth?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <ShimmerBar width={leftWidth} height={10} />
      <ShimmerBar width={rightWidth} height={10} />
    </div>
  );
}

function Dashed() {
  return <div style={{ height: 0, borderTop: `1.5px dashed ${tokens.paperDark}` }} />;
}

function BalanceCardSkeleton() {
  const currentYear = new Date().getFullYear();
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={{ padding: "12px 16px 0" }}>
        <div
          style={{
            background: tokens.paper,
            padding: "16px 18px 24px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
          }}
        >
          {/* Year browser */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 14,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                border: `1.5px solid ${tokens.paperDark}`,
                borderRadius: "var(--radius-pill, 999px)",
                padding: 2,
                gap: 1,
              }}
            >
              <div
                style={{
                  padding: "4px 12px",
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: tokens.inkDim,
                  borderRadius: "var(--radius-pill, 999px)",
                }}
              >
                ← {currentYear - 1}
              </div>
              <div
                style={{
                  padding: "4px 16px",
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  background: tokens.paperDark,
                  color: tokens.inkDim,
                  borderRadius: "var(--radius-pill, 999px)",
                }}
              >
                {currentYear}
              </div>
              <div
                style={{
                  padding: "4px 12px",
                  fontFamily: fontMono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: tokens.inkDim,
                  borderRadius: "var(--radius-pill, 999px)",
                }}
              >
                {currentYear + 1} →
              </div>
            </div>
          </div>

          {/* Breakdown rows: trips, fuel, expenses */}
          <div style={{ display: "flex", flexDirection: "column", gap: 11, margin: "14px 0 14px" }}>
            <SkeletonRow leftWidth="48%" rightWidth="22%" />
            <SkeletonRow leftWidth="52%" rightWidth="20%" />
            <SkeletonRow leftWidth="38%" rightWidth="24%" />
          </div>

          <Dashed />

          {/* TOTAL row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              margin: "12px 0 12px",
            }}
          >
            <ShimmerBar width="20%" height={10} />
            <ShimmerBar width="28%" height={26} />
          </div>

          <Dashed />

          {/* NOT YET PAID row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <ShimmerBar width="30%" height={10} />
            <ShimmerBar width="6%" height={10} />
          </div>
        </div>
      </div>
    </>
  );
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: "0 16px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "12px 0",
            borderBottom: i < rows - 1 ? `1px dashed ${tokens.paperDark}` : "none",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <ShimmerBar width="55%" height={13} />
            <ShimmerBar width="18%" height={13} />
          </div>
          <ShimmerBar width="38%" height={9} />
        </div>
      ))}
    </div>
  );
}

// ── Balance Receipt ───────────────────────────────────────────────
function BalanceReceipt({ fullName, personId }: { fullName: string; personId: number | null }) {
  const t = useT();
  const { theme } = useTheme();
  const mono = theme === "mono";
  const currentYear = new Date().getFullYear();
  const [yearParam, setYearParam] = useQueryParam("year", "");
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;
  const setYear = (y: number) => setYearParam(y === currentYear ? "" : String(y));
  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data: rows = [], isLoading: isDashboardLoading } = useDashboard(year);
  const myRow = personId
    ? rows.find((r) => r.person_id === personId)
    : rows.find((r) => r.person_name === fullName);
  const { data: settlement } = useSettlement(year);
  const myStatement = personId
    ? settlement?.members.find((m) => m.person_id === personId)
    : settlement?.members.find((m) => m.person_name === fullName);
  const owner_net: number | null = myRow?.is_owner ? (myStatement?.net ?? null) : null;
  if (isDashboardLoading) return <BalanceCardSkeleton />;
  if (!myRow) return null;

  const pl = (n: number, s: string, p: string) => (n === 1 ? s : p);
  const yours = t("dashboard.your");

  const tripLabel = `${yours} ${myRow.trip_count} ${pl(myRow.trip_count, t("dashboard.noun_trip"), t("dashboard.noun_trips"))}, ${fmtKm(myRow.trip_km)} km`;
  const fuelLabel = `${yours} ${myRow.fuel_count} ${pl(myRow.fuel_count, t("dashboard.noun_fillup"), t("dashboard.noun_fillups"))}, ${myRow.fuel_liters.toFixed(0)} L`;
  const expenseLabel = `${yours} ${myRow.expense_count} ${pl(myRow.expense_count, t("dashboard.noun_expense"), t("dashboard.noun_expenses"))}`;

  const settled = Math.abs(myRow.balance) <= 0.05;
  const balanceColor = settled ? tokens.green : tokens.accent;

  return (
    <div style={{ padding: "12px 16px 0" }}>
      {/* Receipt card */}
      <div
        style={{
          background: tokens.paper,
          padding: "16px 18px 22px",
          borderRadius: mono ? "var(--radius-lg, 14px)" : 0,
          boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
          border: mono ? `1px solid ${tokens.paperDark}` : "none",
        }}
      >
        {/* Year navigation + owner badge */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              border: mono ? `1px solid ${tokens.paperDark}` : `1.5px solid ${tokens.ink}`,
              borderRadius: "var(--radius-pill, 999px)",
              padding: 2,
              gap: 1,
            }}
          >
            <button
              onClick={() => setYear(year - 1)}
              disabled={year <= earliestYear}
              style={{
                padding: "4px 12px",
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: mono ? 0 : 1,
                background: "transparent",
                color: year <= earliestYear ? tokens.inkDim : mono ? tokens.inkDim : tokens.ink,
                border: "none",
                borderRadius: "var(--radius-pill, 999px)",
                cursor: year <= earliestYear ? "default" : "pointer",
              }}
            >
              ← {year - 1}
            </button>
            <div
              style={{
                padding: "4px 16px",
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: mono ? 0 : 2,
                background: tokens.ink,
                color: tokens.paper,
                borderRadius: "var(--radius-pill, 999px)",
              }}
            >
              {year}
            </div>
            <button
              onClick={() => setYear(year + 1)}
              disabled={year >= currentYear}
              style={{
                padding: "4px 12px",
                fontFamily: fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: mono ? 0 : 1,
                background: "transparent",
                color: year >= currentYear ? tokens.inkDim : mono ? tokens.inkDim : tokens.ink,
                border: "none",
                borderRadius: "var(--radius-pill, 999px)",
                cursor: year >= currentYear ? "default" : "pointer",
              }}
            >
              {year + 1} →
            </button>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            {myRow.is_owner && (
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: mono ? 0.5 : 1.5,
                  textTransform: "uppercase",
                  color: mono ? tokens.green : tokens.paper,
                  background: mono ? "transparent" : tokens.green,
                  border: mono ? `1px solid ${tokens.green}` : "none",
                  borderRadius: mono ? 999 : 0,
                  padding: mono ? "2px 9px" : "2px 7px",
                }}
              >
                eigenaar
              </span>
            )}
          </div>
        </div>

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
              color={owner_net !== null ? amtColor(owner_net) : tokens.inkDim}
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
              <ReceiptRow label={t("dashboard.not_yet_paid")} value="—" color={tokens.inkDim} />
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
                          letterSpacing: mono ? 0 : 2,
                          textTransform: mono ? "none" : ("uppercase" as const),
                          color: tokens.inkDim,
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
                          color: isSettled ? tokens.green : tokens.accent,
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
              color={tokens.accent}
              icon={<Navigation size={11} />}
            />
            <ReceiptRow
              href={`/fuel?mine=true&year=${year}`}
              label={fuelLabel}
              value={`+ ${fmtMoney(myRow.fuel_amount)}`}
              color={tokens.green}
              icon={<FuelIcon size={11} />}
            />
            <ReceiptRow
              href={`/expenses?mine=true&year=${year}`}
              label={expenseLabel}
              value={`+ ${fmtMoney(myRow.expense_amount)}`}
              color={tokens.green}
              icon={<ReceiptIcon size={11} />}
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
              <ReceiptRow label={t("dashboard.not_yet_paid")} value="—" color={tokens.inkDim} />
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
                      color: tokens.inkDim,
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
  const { theme } = useTheme();
  const mono = theme === "mono";
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
          color: tokens.ink,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </div>
      <Link
        href={href}
        style={{
          fontFamily: fontMono,
          fontSize: mono ? 11 : 10,
          color: tokens.inkDim,
          letterSpacing: mono ? 0 : 1.5,
          textTransform: mono ? "none" : ("uppercase" as const),
          borderBottom: mono ? "none" : `1px solid ${tokens.inkDim}`,
          textDecoration: "none",
          opacity: 1,
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
  const { theme } = useTheme();
  const mono = theme === "mono";
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
          background: tokens.paper,
          padding: "16px 18px",
          borderRadius: mono ? "var(--radius-lg, 14px)" : 0,
          boxShadow: mono ? "none" : "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)",
          border: mono ? `1px solid ${tokens.paperDark}` : "none",
        }}
      >
        <div
          style={{
            fontFamily: mono ? fontSerif : fontMono,
            fontSize: mono ? 13 : 11,
            color: mono ? tokens.inkDim : tokens.ink,
            letterSpacing: mono ? 0 : 3,
            textTransform: mono ? "none" : ("uppercase" as const),
            textAlign: mono ? "left" : "center",
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          {mono ? t("dashboard.car_locations") : `— ${t("dashboard.car_locations")} —`}
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
                borderTop: mono
                  ? `1px solid ${tokens.paperDark}`
                  : `1px dashed ${tokens.paperDark}`,
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
                    color: isParkingOnly ? tokens.inkDim : tokens.ink,
                    fontStyle: isParkingOnly ? "italic" : "normal",
                  }}
                >
                  {loc ?? "—"}
                </div>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: tokens.inkDim,
                    letterSpacing: mono ? 0 : 1,
                    marginTop: 2,
                  }}
                >
                  {t("dashboard.last_seen")} · {fmtDate(trip.date)}
                </div>
              </div>
              <div
                style={{ fontFamily: fontMono, fontSize: 11, color: tokens.inkDim, flexShrink: 0 }}
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

const SHEET_STYLE: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  background: tokens.paper,
  borderRadius: "16px 16px 0 0",
  zIndex: 50,
  maxHeight: "95vh",
  overflowY: "auto",
  maxWidth: 480,
  margin: "0 auto",
};

function FormDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content style={SHEET_STYLE} aria-describedby={undefined}>
          <Dialog.Title className="sr-only" />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Sheets({ sheet, setSheet }: { sheet: SheetType; setSheet: (s: SheetType) => void }) {
  const t = useT();
  const createTrip = useCreateTrip();
  const createFuel = useCreateFuelFillup();
  const createExpense = useCreateExpense();
  const createReservation = useCreateReservation();

  const close = () => setSheet(null);

  return (
    <>
      <FormDialog open={sheet === "trip"} onClose={close}>
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
      </FormDialog>

      <FormDialog open={sheet === "fuel"} onClose={close}>
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
      </FormDialog>

      <FormDialog open={sheet === "expense"} onClose={close}>
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
      </FormDialog>

      <FormDialog open={sheet === "reserve"} onClose={close}>
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
      </FormDialog>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
function DashboardContent() {
  const t = useT();
  const { theme } = useTheme();
  const mono = theme === "mono";
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

  const { data: trips = [], isLoading: isTripsLoading } = useTrips();
  const { data: fillups = [], isLoading: isFuelLoading } = useFuelFillups();
  const { data: reservations = [], isLoading: isResLoading } = useReservations();
  const { data: expenses = [], isLoading: isExpensesLoading } = useExpenses();

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
    background: tokens.paperDeep,
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
    <div style={{ background: tokens.paperDeep, minHeight: "100dvh", paddingBottom: 80 }}>
      <PageHeader
        title={
          <>
            {t("dashboard.hello")}
            {me?.personId ? (
              <NameEditLink name={me.shortName ?? ""} personId={me.personId} />
            ) : null}
          </>
        }
        subtitle={mono ? undefined : `${t("dashboard.today")} · ${todayFmt}`}
        titleSize={32}
      />

      {/* Balance */}
      <Suspense>
        <BalanceReceipt fullName={me?.shortName ?? ""} personId={me?.personId ?? null} />
      </Suspense>

      {/* Car locations */}
      <CarLocations trips={trips} onTripClick={setEditTrip} />

      {/* Recent trips */}
      <SectionHeader title={t("dashboard.recent_trips")} href="/trips" />
      {isTripsLoading ? (
        <SectionSkeleton rows={3} />
      ) : (
        <div
          style={
            mono
              ? {
                  margin: "0 16px",
                  background: tokens.paper,
                  borderRadius: "var(--radius-lg, 14px)",
                  border: `1px solid ${tokens.paperDark}`,
                  overflow: "hidden",
                }
              : { padding: "0 16px" }
          }
        >
          {recentTrips.length === 0 ? (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 11,
                color: tokens.inkDim,
                padding: "12px 16px",
                letterSpacing: mono ? 0 : 1,
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
      )}

      {/* Recent fuel */}
      <SectionHeader title={t("dashboard.recent_fuel")} href="/fuel" />
      {isFuelLoading ? (
        <SectionSkeleton rows={2} />
      ) : (
        <div
          style={
            mono
              ? {
                  margin: "0 16px",
                  background: tokens.paper,
                  borderRadius: "var(--radius-lg, 14px)",
                  border: `1px solid ${tokens.paperDark}`,
                  overflow: "hidden",
                }
              : { padding: "0 16px" }
          }
        >
          {recentFuel.length === 0 ? (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 11,
                color: tokens.inkDim,
                padding: "12px 16px",
                letterSpacing: mono ? 0 : 1,
              }}
            >
              {t("state.empty_fuel")}
            </div>
          ) : (
            recentFuel.map((f) => <FuelCard key={f.id} fuel={f} onClick={() => setEditFuel(f)} />)
          )}
        </div>
      )}

      {/* Recent expenses */}
      <SectionHeader title={t("dashboard.recent_maintenance")} href="/expenses" />
      {isExpensesLoading ? (
        <SectionSkeleton rows={2} />
      ) : (
        <div
          style={
            mono
              ? {
                  margin: "0 16px",
                  background: tokens.paper,
                  borderRadius: "var(--radius-lg, 14px)",
                  border: `1px solid ${tokens.paperDark}`,
                  overflow: "hidden",
                }
              : { padding: "0 16px" }
          }
        >
          {recentExpenses.length === 0 ? (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 11,
                color: tokens.inkDim,
                padding: "12px 16px",
                letterSpacing: mono ? 0 : 1,
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
      )}

      {/* Upcoming reservations */}
      <SectionHeader title={t("dashboard.upcoming")} href="/calendar" />
      {isResLoading ? (
        <SectionSkeleton rows={2} />
      ) : upcoming.length > 0 ? (
        <div
          style={
            mono
              ? {
                  margin: "0 16px",
                  background: tokens.paper,
                  borderRadius: "var(--radius-lg, 14px)",
                  border: `1px solid ${tokens.paperDark}`,
                  overflow: "hidden",
                }
              : { padding: "0 16px" }
          }
        >
          {upcoming.map((r) => (
            <ReservationCard key={r.id} reservation={r} onClick={() => setEditReservation(r)} />
          ))}
        </div>
      ) : null}

      {/* Footer */}
      <div
        style={{
          fontFamily: mono ? fontMono : fontSerif,
          fontSize: 12,
          fontStyle: mono ? "normal" : "italic",
          color: tokens.inkDim,
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
