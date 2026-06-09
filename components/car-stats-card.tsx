"use client";

import { useCarStats } from "@/hooks/use-vehicles";
import { fontMono, paper } from "@/lib/paper-theme";

const nf = (n: number, d = 0) =>
  n.toLocaleString("nl-BE", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Read-only efficiency & usage stats for one car in a given year (#374). */
export function CarStatsCard({ carId, year }: { carId: number; year: number }) {
  const { data, isLoading } = useCarStats(carId, year);
  if (isLoading || !data) return null;

  const DASH = "–";
  const rows: [string, string][] = [
    ["Trips", String(data.tripCount)],
    ["Distance", `${nf(data.totalKm)} km`],
    ["Fuel", `${nf(data.totalFuelLiters, 1)} L`],
    ["Fuel cost", `€ ${nf(data.totalFuelCost, 2)}`],
    [
      "Consumption",
      data.avgConsumptionLper100km == null ? DASH : `${nf(data.avgConsumptionLper100km, 1)} L/100km`,
    ],
    ["Cost / km", data.avgFuelCostPerKm == null ? DASH : `€ ${nf(data.avgFuelCostPerKm, 3)}/km`],
  ];

  return (
    <div
      style={{
        fontFamily: fontMono,
        fontSize: 11,
        border: `1px solid ${paper.paperDark}`,
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        background: paper.paper,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontSize: 9,
          color: paper.inkDim,
          marginBottom: 6,
        }}
      >
        Stats {data.year}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
          <span style={{ color: paper.inkDim }}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
