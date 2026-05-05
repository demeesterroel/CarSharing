"use client";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";

// ── Primitives ────────────────────────────────────────────────
export function Perf({ margin = "12px 0" }: { margin?: string }) {
  return <div style={{ height: 0, borderTop: `1.5px dashed ${paper.ink}`, margin }} />;
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
          color: paper.inkDim,
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
          color: color ?? paper.ink,
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
        background: paper.paper,
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
import { useQuery } from "@tanstack/react-query";
import type {
  CarPnL,
  KmGap,
  ZeroKmTrip,
  MonthlyCarKm,
  PersonContribution,
  CarYearKm,
  CarPriceHistory,
  CarRollingFuel,
  CarOwnerSplit,
  CarYearExpenses,
} from "@/lib/queries/admin";
import type { DashboardRow, Reservation, Person } from "@/types";
import { useMe } from "@/hooks/use-me";
import { useCars } from "@/hooks/use-cars";

export interface AdminSummary {
  carPnL: CarPnL[];
  settlement: DashboardRow[];
  kmGaps: KmGap[];
  zeroKmTrips: ZeroKmTrip[];
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
  return new Set(
    cars.filter((c) => c.owner_name === me.personName).map((c) => c.short)
  );
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
