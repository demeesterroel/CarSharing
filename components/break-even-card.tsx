"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney, amtColor, signPrefix } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-cars";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beMetrics, Card, Row } from "@/app/admin/_shared";
import type { CarPnL, PersonContribution, CarYearKm, CarPriceHistory } from "@/lib/queries/admin";
import type { Car } from "@/types";

// ── Contribution Ledger ───────────────────────────────────────
function ContributionLedger({ contributions }: { contributions: PersonContribution[] }) {
  const t = useT();
  if (contributions.length === 0) return null;

  const topped = contributions.slice(0, 5);
  const maxAmount = topped[0].amount;
  const totalAmount = contributions.reduce((s, c) => s + c.amount, 0);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        — {t("breakeven.helpers")} —
      </div>
      <Card style={{ padding: "10px 12px", borderLeft: `3px solid ${paper.green}`, marginBottom: 0 }}>
        {topped.map((c) => {
          const pct = maxAmount > 0 ? c.amount / maxAmount : 0;
          return (
            <div key={c.person_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontFamily: fontMono, fontSize: 9 }}>
              <span style={{ minWidth: 60, color: paper.inkDim, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
                {c.person_name.split(" ")[0]}
              </span>
              <div style={{ flex: 1, height: 7, background: paper.paperDeep, position: "relative" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(pct * 100).toFixed(0)}%`, background: paper.green }} />
              </div>
              <span style={{ minWidth: 46, textAlign: "right", fontWeight: 700 }}>
                {fmtMoney(c.amount)}
              </span>
            </div>
          );
        })}
        <div style={{ height: 0, borderTop: `1px dashed ${paper.ink}`, margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 10, padding: "2px 0" }}>
          <span style={{ color: paper.inkDim, textTransform: "uppercase", letterSpacing: 1 }}>
            {t("breakeven.total")}
          </span>
          <span style={{ fontWeight: 700, color: paper.green }}>{fmtMoney(totalAmount)}</span>
        </div>
      </Card>
    </div>
  );
}

// ── Price History Strip ───────────────────────────────────────
function PriceHistoryStrip({ history }: { history: CarPriceHistory[] }) {
  const t = useT();
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        — {t("history.price_title")} —
      </div>
      {history.length === 0 ? (
        <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute, padding: "4px 0" }}>
          {t("history.no_history")}
        </div>
      ) : (
        <div>
          {history.map((h, i) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: fontMono, fontSize: 10, padding: "4px 0", borderBottom: `1px dotted ${paper.paperDark}` }}>
              <span style={{ color: paper.inkDim }}>{h.effective_from}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>€ {h.price_per_km.toFixed(2)} / km</span>
                {i === 0 && (
                  <span style={{ fontFamily: fontMono, fontSize: 7, fontWeight: 700, letterSpacing: 1, color: paper.green, border: `1px solid ${paper.green}`, padding: "1px 5px", textTransform: "uppercase" }}>
                    {t("history.current")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Break-Even Card ───────────────────────────────────────────
export interface BreakEvenCardProps {
  car: CarPnL;
  fullCar: Car | undefined;
  contributions: PersonContribution[];
  historicalKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
  year: number;
  onRateOpen?: () => void;
}

export function BreakEvenCard({
  car,
  fullCar,
  contributions,
  historicalKm,
  priceHistory,
  year,
  onRateOpen,
}: BreakEvenCardProps) {
  const t = useT();
  const m = beMetrics(car);
  const qc = useQueryClient();
  const updateCar = useUpdateCar();
  const [showRate, setShowRate] = useState(false);

  const statusColor = m.status === "ahead" ? paper.green : m.status === "on_pace" ? paper.amber : paper.accent;

  function handleCommitRate(price: number, expectedKm: number) {
    if (!fullCar) return;
    updateCar.mutate(
      { ...fullCar, price_per_km: price, expected_km: expectedKm } as Car & { id: number },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          qc.invalidateQueries({ queryKey: ["cars"] });
          setShowRate(false);
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  function handleRateOpen() {
    if (onRateOpen) {
      onRateOpen();
    } else {
      setShowRate((s) => !s);
    }
  }

  return (
    <Card>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink }}>
            {car.car_name}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
            {t("admin.owner_info", { short: car.car_short, owner: car.owner_name ?? "—", km: car.trip_km.toLocaleString("nl-BE") })}
          </div>
        </div>
        <div style={{ display: "inline-block", padding: "5px 12px", border: `2.5px solid ${statusColor}`, color: statusColor, fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", transform: "rotate(-3deg)", opacity: 0.9 }}>
          {m.status === "ahead" ? t("admin.stamp_ok") : t("admin.stamp_warn")}
        </div>
      </div>

      {/* Net summary */}
      <div style={{ marginBottom: 12 }}>
        <Row label={t("breakeven.revenue")} value={fmtMoney(car.trip_revenue)} color={paper.green} />
        <Row label={t("breakeven.expenses")} value={fmtMoney(car.variable_total)} />
        <Row
          label={t("breakeven.net")}
          value={`${signPrefix(m.net)}${fmtMoney(m.net)}`}
          color={amtColor(m.net)}
          big
        />
      </div>

      <PriceHistoryStrip history={priceHistory} />
      <ContributionLedger contributions={contributions} />

      <div style={{ marginTop: 12 }}>
        <button
          onClick={handleRateOpen}
          style={{ width: "100%", padding: "9px", background: showRate && !onRateOpen ? paper.ink : "transparent", color: showRate && !onRateOpen ? paper.paper : paper.ink, border: `1.5px solid ${paper.ink}`, cursor: "pointer", fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}
        >
          {showRate && !onRateOpen ? "▲" : "▼"} {t("rate.open")}
        </button>
        {showRate && !onRateOpen && fullCar && (
          <RateAssistant
            car={car}
            fullCar={fullCar}
            historicalKm={historicalKm}
            year={year}
            onSave={handleCommitRate}
          />
        )}
      </div>
    </Card>
  );
}

// ── Rate Assistant ────────────────────────────────────────────
export function RateAssistant({
  car,
  fullCar,
  historicalKm,
  year,
  onCommit,
  onSave,
}: {
  car: CarPnL;
  fullCar: Car | undefined;
  historicalKm: CarYearKm[];
  year: number;
  onCommit?: () => void;
  onSave?: (price: number, expectedKm: number) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const updateCar = useUpdateCar();

  const avgKm = historicalKm.length > 0
    ? Math.round(historicalKm.reduce((s, h) => s + h.km, 0) / historicalKm.length)
    : 0;

  const [expectedKm, setExpectedKm] = useState(
    car.expected_km ?? (car.prev_year_trip_km || avgKm || 5000)
  );

  const variablePerKm = car.trip_km > 0 ? car.variable_total / car.trip_km : 0;
  const suggestedRate = expectedKm > 0
    ? Math.max(car.car_price_per_km, variablePerKm * 1.1)
    : car.car_price_per_km;
  const projectedRevenue = suggestedRate * expectedKm;
  const projectedExpenses = variablePerKm * expectedKm;
  const projectedNet = projectedRevenue - projectedExpenses;

  const maxHistKm = Math.max(1, ...historicalKm.map((h) => h.km), expectedKm);

  function handleSave() {
    if (onSave) {
      onSave(suggestedRate, expectedKm);
      return;
    }
    if (!fullCar) return;
    updateCar.mutate(
      { ...fullCar, price_per_km: suggestedRate, expected_km: expectedKm } as Car & { id: number },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          qc.invalidateQueries({ queryKey: ["cars"] });
          toast.success(t("toast.saved"));
          onCommit?.();
        },
      }
    );
  }

  return (
    <div style={{ background: paper.paperDeep, padding: "14px", marginTop: 10 }}>
      <div style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: paper.inkDim, fontWeight: 700, marginBottom: 12 }}>
        {t("rate.title")}
      </div>

      {/* Expected km */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, marginBottom: 6 }}>{t("rate.q1")}</div>
        {historicalKm.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, color: paper.inkMute, letterSpacing: 0.8, marginBottom: 4 }}>
              <span>{t("rate.history", { n: historicalKm.length })}</span>
              <span>{t("rate.avg", { km: Math.round(avgKm / 100) / 10 + "k" })}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
              {historicalKm.map((h) => {
                const isLast = h.year === Math.max(...historicalKm.map((x) => x.year));
                const barH = Math.max(4, (h.km / maxHistKm) * 36);
                return (
                  <div key={h.year} onClick={() => setExpectedKm(h.km)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                    <span style={{ fontFamily: fontMono, fontSize: 7, fontWeight: 700, color: isLast ? paper.ink : paper.inkMute }}>
                      {Math.round(h.km / 100) / 10}k
                    </span>
                    <div style={{ width: "100%", height: barH, background: isLast ? paper.ink : paper.paperDark }} />
                    <span style={{ fontFamily: fontMono, fontSize: 7, color: isLast ? paper.ink : paper.inkMute, fontWeight: isLast ? 700 : 400 }}>
                      &apos;{String(h.year).slice(2)}
                    </span>
                  </div>
                );
              })}
              <div onClick={() => setExpectedKm(car.trip_km || avgKm)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                <span style={{ fontFamily: fontMono, fontSize: 7, fontWeight: 700, color: paper.accent }}>
                  {Math.round(expectedKm / 100) / 10}k
                </span>
                <div style={{ width: "100%", height: Math.max(4, (expectedKm / maxHistKm) * 36), background: paper.accent, opacity: 0.85, backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 2px, rgba(244,239,228,0.3) 2px 3px)" }} />
                <span style={{ fontFamily: fontMono, fontSize: 7, color: paper.accent, fontWeight: 700 }}>
                  &apos;{String(year).slice(2)}
                </span>
              </div>
            </div>
          </div>
        )}
        <input type="range" min={500} max={Math.round(maxHistKm * 1.5)} step={100} value={expectedKm} onChange={(e) => setExpectedKm(parseInt(e.target.value))} style={{ width: "100%", accentColor: paper.accent }} />
        <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, textAlign: "center", color: paper.accent, marginTop: 2 }}>
          {expectedKm.toLocaleString("nl-BE")} km
        </div>
      </div>

      {/* Result */}
      <div style={{ background: paper.paper, padding: "12px", marginBottom: 10 }}>
        <div style={{ fontFamily: fontMono, fontSize: 8, color: paper.green, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          {t("rate.suggested")}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 38, fontWeight: 700, color: paper.green, lineHeight: 1, marginBottom: 2 }}>
          € {car.car_price_per_km.toFixed(2)}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 8 }}>
          {t("rate.per_km_others")}
        </div>
        <Row label={t("breakeven.variable_km")} value={`€ ${variablePerKm.toFixed(4)}/km`} />
        <Row label={t("rate.expected_km")} value={expectedKm.toLocaleString("nl-BE") + " km"} />
        <Row
          label={t("breakeven.projected_net")}
          value={`${signPrefix(projectedNet)}${fmtMoney(projectedNet)}`}
          color={amtColor(projectedNet)}
          big
        />
      </div>

      <button
        onClick={handleSave}
        style={{ width: "100%", padding: "11px", background: paper.ink, color: paper.paper, border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}
      >
        {t("rate.commit", { year })}
      </button>
    </div>
  );
}
