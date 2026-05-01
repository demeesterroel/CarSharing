"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif, fmtMoney, fmtKm } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import {
  useAdminSummary,
  useOwnerCarShorts,
  beMetrics,
  Card,
  Row,
  Perf,
} from "@/app/admin/_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import type { CarPnL, MonthlyCarKm } from "@/lib/queries/admin";
import { useCars } from "@/hooks/use-cars";
import { CarBadge } from "@/components/car-badge";
import { BreakEvenCard } from "@/components/break-even-card";
import { RateAssistant } from "@/components/rate-assistant";

// ── Screen state ─────────────────────────────────────────────
type Screen =
  | { view: "fleet" }
  | { view: "detail"; carId: number }
  | { view: "rate"; carId: number };

// ── Fleet tile ────────────────────────────────────────────────
function FleetTile({
  car,
  onDetail,
  onRate,
}: {
  car: CarPnL;
  monthlyKm: MonthlyCarKm[];
  onDetail: () => void;
  onRate: () => void;
  year: number;
}) {
  const t = useT();
  const m = beMetrics(car);

  const statusColor =
    m.status === "ahead" ? paper.green : m.status === "on_pace" ? paper.amber : paper.accent;
  const statusLabel =
    m.status === "ahead"
      ? t("fleet.stamp_ahead")
      : m.status === "on_pace"
        ? t("fleet.stamp_on_pace")
        : t("fleet.stamp_behind");

  const meterPct = Math.min(1, m.pctCovered);
  const meterColor =
    m.status === "ahead" ? paper.green : m.status === "on_pace" ? paper.amber : paper.accent;

  return (
    <Card>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CarBadge short={car.car_short} />
          <div>
            <div style={{ fontFamily: fontSerif, fontSize: 18, fontWeight: 700, color: paper.ink, lineHeight: 1 }}>
              {car.car_name}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
              {car.car_short}
            </div>
          </div>
        </div>
        <div style={{
          padding: "4px 10px",
          border: `2px solid ${statusColor}`,
          color: statusColor,
          fontFamily: fontMono,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          transform: "rotate(-3deg)",
          opacity: 0.9,
          flexShrink: 0,
        }}>
          {statusLabel}
        </div>
      </div>

      {car.fixed_total > 0 ? (
        <>
          {/* Big number: remaining burden */}
          <div style={{ fontFamily: fontSerif, fontSize: 32, fontWeight: 700, color: statusColor, lineHeight: 1, margin: "8px 0 2px" }}>
            {fmtMoney(m.remainingBurden)}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 10 }}>
            {t("fleet.remaining_burden")} · {t("fleet.pct_covered", { pct: Math.round(m.pctCovered * 100) })}
          </div>

          {/* Burden meter */}
          <div style={{ height: 6, background: paper.paperDeep, position: "relative", marginBottom: 3 }}>
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: 0,
              width: `${meterPct * 100}%`,
              background: meterColor,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 0.5, marginBottom: 10 }}>
            <span>{fmtMoney(car.fixed_total)} last</span>
            <span>break-even</span>
          </div>

          {/* Stats */}
          <Row label={t("fleet.coop_km_ytd")} value={fmtKm(car.trip_km)} />
          <Row label={t("fleet.break_even_km")} value={isFinite(m.breakEvenKm) ? fmtKm(m.breakEvenKm) : "—"} />
          {m.kmGap > 0 && (
            <Row
              label={t("fleet.km_gap")}
              value={isFinite(m.kmGap) ? fmtKm(m.kmGap) : "—"}
              color={paper.accent}
            />
          )}
          {car.prev_year_trip_km > 0 && (
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, marginTop: 4 }}>
              {t("fleet.prev_year_km", { km: car.prev_year_trip_km.toLocaleString("nl-BE") })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, padding: "8px 0" }}>
          {t("fleet.no_fixed")}
        </div>
      )}

      <Perf margin="12px 0 10px" />

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onDetail}
          style={{
            flex: 1, padding: "10px", background: paper.ink, color: paper.paper,
            border: "none", cursor: "pointer", fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
          }}
        >
          {t("fleet.see_breakeven")}
        </button>
        <button
          onClick={onRate}
          style={{
            flex: 1, padding: "10px", background: "transparent", color: paper.ink,
            border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
          }}
        >
          {t("rate.open")}
        </button>
      </div>
    </Card>
  );
}

// ── Owner dashboard ───────────────────────────────────────────
function OwnerDashboard() {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [screen, setScreen] = useState<Screen>({ view: "fleet" });

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data } = useAdminSummary(year);
  const ownerCarShorts = useOwnerCarShorts();
  const { data: cars = [] } = useCars();

  const allPnL = data?.carPnL ?? [];
  const monthlyKm = data?.monthlyCarKm ?? [];
  const contributions = data?.personContributions ?? [];
  const historicalKm = data?.historicalCarKm ?? [];
  const priceHistory = data?.priceHistory ?? [];

  // Filter to owner's cars (null = admin, sees all cars with an owner)
  const pnl = ownerCarShorts
    ? allPnL.filter((c) => ownerCarShorts.has(c.car_short))
    : allPnL.filter((c) => c.owner_name !== null);

  const carMap = new Map(cars.map((c) => [c.id, c]));

  // Detail screen
  if (screen.view === "detail") {
    const car = pnl.find((c) => c.car_id === screen.carId);
    if (!car) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button
          onClick={() => setScreen({ view: "fleet" })}
          style={{
            marginBottom: 12, padding: "7px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
          }}
        >
          {t("owner.back_fleet")}
        </button>
        <BreakEvenCard
          car={car}
          fullCar={carMap.get(car.car_id)}
          monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
          contributions={contributions.filter((c) => c.car_id === car.car_id)}
          historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
          priceHistory={priceHistory.filter((h) => h.car_id === car.car_id)}
          year={year}
          onRateOpen={() => setScreen({ view: "rate", carId: car.car_id })}
        />
      </div>
    );
  }

  // Rate screen
  if (screen.view === "rate") {
    const car = pnl.find((c) => c.car_id === screen.carId);
    if (!car) return null;
    return (
      <div style={{ padding: "16px" }}>
        <button
          onClick={() => setScreen({ view: "detail", carId: screen.carId })}
          style={{
            marginBottom: 12, padding: "7px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, color: paper.ink, fontFamily: fontMono,
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
          }}
        >
          ← {t("fleet.see_breakeven")}
        </button>
        <RateAssistant
          car={car}
          fullCar={carMap.get(car.car_id)}
          historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
          year={year}
          onCommit={() => setScreen({ view: "fleet" })}
        />
      </div>
    );
  }

  // Fleet view
  return (
    <div style={{ padding: "16px" }}>
      {/* Year selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 16 }}>
        <button
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= earliestYear}
          style={{
            padding: "6px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, borderRight: "none",
            fontFamily: fontMono, fontSize: 10, fontWeight: 700,
            color: year <= earliestYear ? paper.inkMute : paper.ink,
            cursor: year <= earliestYear ? "default" : "pointer", letterSpacing: 1,
          }}
        >
          ← {year - 1}
        </button>
        <div style={{
          padding: "6px 18px", background: paper.ink, color: paper.paper,
          fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2,
          border: `1.5px solid ${paper.ink}`,
        }}>
          {year}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          style={{
            padding: "6px 14px", background: "transparent",
            border: `1.5px solid ${paper.ink}`, borderLeft: "none",
            fontFamily: fontMono, fontSize: 10, fontWeight: 700,
            color: year >= currentYear ? paper.inkMute : paper.ink,
            cursor: year >= currentYear ? "default" : "pointer", letterSpacing: 1,
          }}
        >
          {year + 1} →
        </button>
      </div>

      {pnl.length === 0 ? (
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, textAlign: "center", padding: "32px 0" }}>
          {t("owner.no_cars")}
        </div>
      ) : (
        pnl.map((car) => (
          <FleetTile
            key={car.car_id}
            car={car}
            monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
            onDetail={() => setScreen({ view: "detail", carId: car.car_id })}
            onRate={() => setScreen({ view: "rate", carId: car.car_id })}
            year={year}
          />
        ))
      )}
    </div>
  );
}

// ── Access guard ──────────────────────────────────────────────
export default function OwnerPage() {
  const { data: me, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && me && !me.isOwner && !me.isAdmin) {
      router.replace("/");
    }
  }, [me, isLoading, router]);

  if (isLoading || !me) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.inkMute, letterSpacing: 1 }}>…</div>
      </div>
    );
  }

  if (!me.isOwner && !me.isAdmin) return null;
  return <OwnerDashboard />;
}
