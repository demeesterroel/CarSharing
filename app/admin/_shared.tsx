"use client";
import { paper, fontMono } from "@/lib/paper-theme";

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
} from "@/lib/queries/admin";
import type { DashboardRow, Reservation, Person } from "@/types";

export interface AdminSummary {
  carPnL: CarPnL[];
  settlement: DashboardRow[];
  kmGaps: KmGap[];
  zeroKmTrips: ZeroKmTrip[];
  monthlyCarKm: MonthlyCarKm[];
  personContributions: PersonContribution[];
  historicalCarKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
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

// ── Fleet economics helpers ───────────────────────────────────
export function beMetrics(car: CarPnL) {
  const variablePerKm = car.trip_km > 0 ? car.variable_total / car.trip_km : 0;
  const contribPerKm = car.car_price_per_km - variablePerKm;
  const fixedCovered = Math.max(0, car.trip_revenue - car.variable_total);
  const remainingBurden = Math.max(0, car.fixed_total - fixedCovered);
  const pctCovered = car.fixed_total > 0 ? fixedCovered / car.fixed_total : 1;

  const currentMonth = new Date().getMonth() + 1;
  const monthlyRate = car.trip_km / Math.max(1, currentMonth);
  const projectedYearKm = monthlyRate * 12;
  const projectedCovered = contribPerKm > 0 ? contribPerKm * projectedYearKm : 0;
  const projectedBurden = car.fixed_total - projectedCovered;
  const pctProjected = car.fixed_total > 0 ? projectedCovered / car.fixed_total : 1;

  const breakEvenKm = contribPerKm > 0 ? Math.round(car.fixed_total / contribPerKm) : Infinity;
  const kmGap = isFinite(breakEvenKm) ? Math.max(0, breakEvenKm - car.trip_km) : Infinity;

  const status: "ahead" | "on_pace" | "behind" =
    pctCovered >= 1 ? "ahead" : pctProjected >= 0.85 ? "on_pace" : "behind";

  return {
    variablePerKm,
    contribPerKm,
    fixedCovered,
    remainingBurden,
    pctCovered,
    projectedBurden,
    pctProjected,
    breakEvenKm,
    kmGap,
    status,
  };
}

// ── Fixed cost helpers ────────────────────────────────────────
import type { FixedCostItem, FixedCostCategory } from "@/types";

export const FIXED_COST_CATEGORIES: FixedCostCategory[] = [
  "belastingen",
  "verzekeringen",
  "onderhoud",
  "keuring",
  "diversen",
];
export const FIXED_COST_LABELS: Record<FixedCostCategory, { nl: string; en: string }> = {
  belastingen: { nl: "Belastingen", en: "Road tax" },
  verzekeringen: { nl: "Verzekeringen", en: "Insurance" },
  onderhoud: { nl: "Onderhoud", en: "Maintenance" },
  keuring: { nl: "Keuring", en: "Inspection" },
  diversen: { nl: "Diversen", en: "Miscellaneous" },
};

export function FixedCostEditor({
  items,
  onChange,
  lang = "nl",
}: {
  items: FixedCostItem[];
  onChange: (items: FixedCostItem[]) => void;
  lang?: string;
}) {
  const inputStyle: React.CSSProperties = {
    padding: "5px 6px",
    border: `1px solid ${paper.paperDark}`,
    background: paper.paperDeep,
    fontFamily: fontMono,
    fontSize: 11,
    color: paper.ink,
    outline: "none",
  };

  const add = () =>
    onChange([
      ...items,
      { id: String(Date.now()), category: "diversen", description: "", amount: 0 },
    ]);

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const update = (id: string, patch: Partial<FixedCostItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {lang === "nl" ? "Vaste kosten" : "Fixed costs"}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}
        >
          <select
            value={item.category}
            onChange={(e) => update(item.id, { category: e.target.value as FixedCostCategory })}
            style={{ ...inputStyle, flex: "0 0 auto", minWidth: 0 }}
          >
            {FIXED_COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {FIXED_COST_LABELS[c][lang === "nl" ? "nl" : "en"]}
              </option>
            ))}
          </select>
          <input
            value={item.description}
            onChange={(e) => update(item.id, { description: e.target.value })}
            placeholder={lang === "nl" ? "omschrijving" : "description"}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <input
            type="number"
            value={item.amount || ""}
            onChange={(e) => update(item.id, { amount: parseFloat(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 72, flexShrink: 0 }}
          />
          <button
            onClick={() => remove(item.id)}
            style={{
              padding: "4px 7px",
              background: "transparent",
              border: `1px solid ${paper.paperDark}`,
              cursor: "pointer",
              fontFamily: fontMono,
              fontSize: 11,
              color: paper.inkDim,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <button
          onClick={add}
          style={{
            padding: "4px 10px",
            background: "transparent",
            border: `1px dashed ${paper.inkDim}`,
            cursor: "pointer",
            fontFamily: fontMono,
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: paper.inkDim,
          }}
        >
          + {lang === "nl" ? "toevoegen" : "add"}
        </button>
        {items.length > 0 && (
          <span style={{ fontFamily: fontMono, fontSize: 11, color: paper.ink, fontWeight: 700 }}>
            {lang === "nl" ? "Totaal" : "Total"}: €{" "}
            {total.toLocaleString("nl-BE", { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
