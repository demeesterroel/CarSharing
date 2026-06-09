"use client";
import { fontMono, tokens } from "@/lib/theme-tokens";

// ── Primitives ────────────────────────────────────────────────
export function Perf({ margin = "12px 0" }: { margin?: string }) {
  return <div style={{ height: 0, borderTop: `1.5px dashed ${tokens.ink}`, margin }} />;
}

export function Row({
  label,
  value,
  big,
  color,
}: {
  label: string;
  value: string;
  big?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: fontMono,
        padding: "4px 0",
      }}
    >
      <span
        style={{
          fontSize: big ? 11 : 10,
          color: tokens.inkDim,
          textTransform: "uppercase",
          letterSpacing: 1,
          whiteSpace: "nowrap",
          marginRight: 12,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: big ? 16 : 13,
          fontWeight: big ? 700 : 600,
          color: color ?? tokens.ink,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function Card({
  children,
  style,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      style={{
        background: tokens.paper,
        padding: "18px 16px",
        marginBottom: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Data hooks ─────────────────────────────────────────────────
import { useMe } from "@/hooks/use-me";
import { useCars } from "@/hooks/use-vehicles";
import type {
  CarOwnerSplit,
  CarPnL,
  CarPriceHistory,
  CarRollingFuel,
  CarYearExpenses,
  CarYearKm,
  DuplicateTripPair,
  KmGap,
  MonthlyCarKm,
  PersonContribution,
  ZeroKmTrip,
} from "@/lib/queries/admin";
import type { DashboardRow, Person, Reservation } from "@/types";
import { useQuery } from "@tanstack/react-query";

export interface AdminSummary {
  carPnL: CarPnL[];
  settlement: DashboardRow[];
  kmGaps: KmGap[];
  zeroKmTrips: ZeroKmTrip[];
  duplicateTrips: DuplicateTripPair[];
  monthlyCarKm: MonthlyCarKm[];
  personContributions: PersonContribution[];
  historicalCarKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
  rollingFuelPerKm: CarRollingFuel[];
  historicalOwnerSplit: CarOwnerSplit[];
  historicalExpenses: CarYearExpenses[];
}

export function useAdminSummary(year: number) {
  return useQuery<AdminSummary>({
    queryKey: ["admin-summary", year],
    queryFn: async () => {
      const res = await fetch(`/api/admin/summary?year=${year}`);
      if (!res.ok) throw new Error("Failed to load admin summary");
      return res.json();
    },
  });
}

export function useReservations() {
  return useQuery<Reservation[]>({
    queryKey: ["reservations"],
    queryFn: async () => {
      const res = await fetch("/api/reservations");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    // Reservation status can change from outside the app (Google Calendar
    // accept/decline/cancel → webhook → DB) with no server→client push. Poll so
    // those changes surface in an open session (inbox, calendar). Background
    // polling stays off while the tab is hidden. (#350)
    refetchInterval: 30000,
  });
}

export function usePeople() {
  return useQuery<Person[]>({
    queryKey: ["people"],
    queryFn: async () => {
      const res = await fetch("/api/people");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

/**
 * Returns the set of car_short values owned by the current user,
 * or null if the user is an admin (meaning no filter should be applied).
 */
export function useOwnerCarShorts(): Set<string> | null {
  const { data: me } = useMe();
  const { data: cars = [] } = useCars();
  if (!me || me.isAdmin) return null;
  return new Set(cars.filter((c) => c.owner_person_id === me.personId).map((c) => c.short));
}

export function useInboxCount(): { count: number; isLoading: boolean } {
  const { data: reservations = [], isLoading: isResLoading } = useReservations();
  const ownerCarShorts = useOwnerCarShorts();
  const year = new Date().getFullYear();
  const { data: adminData, isLoading: isAdminLoading } = useAdminSummary(year);

  const pending = reservations.filter(
    (r) => r.status === "pending" && (!ownerCarShorts || ownerCarShorts.has(r.car_short ?? ""))
  ).length;
  const duplicates = (adminData?.duplicateTrips ?? []).filter(
    (p) => !ownerCarShorts || ownerCarShorts.has(p.car_short)
  ).length;
  const gaps = (adminData?.kmGaps ?? []).filter(
    (g) => !ownerCarShorts || ownerCarShorts.has(g.car_short)
  ).length;

  return { count: pending + duplicates + gaps, isLoading: isResLoading || isAdminLoading };
}

// ── Fleet economics helpers ───────────────────────────────────
export function beMetrics(car: CarPnL) {
  // Net = trip revenue minus actual expenses (fuel + maintenance)
  const net = car.net; // pre-computed in CarPnL
  const pctCovered = car.variable_total > 0 ? car.trip_revenue / car.variable_total : 1;

  const currentMonth = new Date().getMonth() + 1;
  const monthlyNet = net / Math.max(1, currentMonth);
  const projectedNet = monthlyNet * 12;

  const status: "ahead" | "on_pace" | "behind" =
    net >= 0 ? "ahead" : projectedNet >= 0 ? "on_pace" : "behind";

  return {
    net,
    pctCovered,
    projectedNet,
    status,
  };
}
