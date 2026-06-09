"use client";
import { Card, Row } from "@/app/admin/_shared";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-vehicles";
import { fmtMoney, fmtMoneyOut, fontMono, fontSerif, tokens } from "@/lib/theme-tokens";
import type {
  CarOwnerSplit,
  CarPnL,
  CarPriceHistory,
  CarYearExpenses,
  CarYearKm,
} from "@/lib/queries/admin";
import type { Car } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export interface CostCoverageScreenProps {
  car: CarPnL;
  fullCar: Car | undefined;
  historicalKm: CarYearKm[];
  ownerSplit: CarOwnerSplit[];
  historicalExpenses: CarYearExpenses[];
  priceHistory: CarPriceHistory[];
  rollingFuelPerKm: number; // 0 = no data
  year: number;
  /** Controlled collapse state. When omitted, the card manages it internally. */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

// ── Zone bar ──────────────────────────────────────────────────

function ZoneBar({
  fuelThreshold,
  expenseThreshold,
  fuelCoverThreshold,
  currentPrice,
}: {
  fuelThreshold: number;
  expenseThreshold: number;
  fuelCoverThreshold: number;
  currentPrice: number;
}) {
  const maxPrice = Math.max(fuelCoverThreshold * 1.4, currentPrice * 1.2, 0.01);

  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maxPrice) * 100)).toFixed(1)}%`;
  const markerLeft = pct(currentPrice);

  const zone1W = pct(fuelThreshold);
  const zone2W = pct(Math.max(0, expenseThreshold - fuelThreshold));
  const zone3W = pct(Math.max(0, fuelCoverThreshold - expenseThreshold));
  const zone4W = pct(Math.max(0, maxPrice - fuelCoverThreshold));

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          position: "relative",
          height: 14,
          display: "flex",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div style={{ width: zone1W, background: tokens.accent }} />
        <div style={{ width: zone2W, background: tokens.amber }} />
        <div style={{ width: zone3W, background: tokens.green, opacity: 0.55 }} />
        <div style={{ width: zone4W, background: tokens.green }} />
        <div
          style={{
            position: "absolute",
            top: -3,
            left: markerLeft,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ width: 2, height: 20, background: tokens.ink }} />
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 7,
              fontWeight: 700,
              color: tokens.ink,
              whiteSpace: "nowrap",
              marginTop: 2,
            }}
          >
            € {currentPrice.toFixed(2)}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 7,
          color: tokens.inkMute,
          letterSpacing: 0.5,
        }}
      >
        <span>0</span>
        <span>€{fuelThreshold.toFixed(2)} brandstof</span>
        <span>€{expenseThreshold.toFixed(2)} kosten</span>
        <span>€{fuelCoverThreshold.toFixed(2)} brandstof+</span>
      </div>
    </div>
  );
}

// ── Slider row ────────────────────────────────────────────────

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
  readOnly = false,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 8,
          color: tokens.inkMute,
          letterSpacing: 0.8,
          marginBottom: 3,
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        <span style={{ color: tokens.inkDim }}>{hint}</span>
      </div>
      {readOnly ? (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
            color: tokens.ink,
            padding: "6px 0",
          }}
        >
          {format(value)}
        </div>
      ) : (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: tokens.ink, marginBottom: 2 }}
          />
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              fontWeight: 700,
              textAlign: "center",
              color: tokens.ink,
            }}
          >
            {format(value)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Zone helpers ──────────────────────────────────────────────

type Zone = "red" | "orange" | "light_green" | "dark_green";

function zoneColor(zone: Zone): string {
  if (zone === "red") return tokens.accent;
  if (zone === "orange") return tokens.amber;
  return tokens.green;
}

type ZoneKey =
  | "coverage.zone.red"
  | "coverage.zone.orange"
  | "coverage.zone.light_green"
  | "coverage.zone.dark_green";

function zoneKey(zone: Zone): ZoneKey {
  return `coverage.zone.${zone}` as ZoneKey;
}

// Finds the price in effect for a given year from price history entries (already filtered to this car).
// Returns the price_per_km of the most recent entry with effective_from ≤ YYYY-12-31, or the fallback.
function priceForYear(history: CarPriceHistory[], year: number, fallback: number): number {
  const endOfYear = `${year}-12-31`;
  const candidates = history
    .filter((h) => h.effective_from <= endOfYear)
    .sort((a, b) => (b.effective_from > a.effective_from ? 1 : -1));
  return candidates[0]?.price_per_km ?? fallback;
}

// ── Main component ────────────────────────────────────────────

export function CostCoverageScreen({
  car,
  fullCar,
  historicalKm,
  ownerSplit,
  historicalExpenses: _historicalExpenses,
  priceHistory,
  rollingFuelPerKm,
  year,
  expanded: expandedProp,
  onToggleExpanded,
}: CostCoverageScreenProps) {
  const t = useT();
  const qc = useQueryClient();
  const updateCar = useUpdateCar();

  const currentYear = new Date().getFullYear();
  const isHistoric = year < currentYear;

  // ── Exact values for historic years (computed from actuals) ───

  const yearSplit = ownerSplit.find((s) => s.year === year);
  const exactPctOthers =
    yearSplit && yearSplit.owner_km + yearSplit.non_owner_km > 0
      ? yearSplit.non_owner_km / (yearSplit.owner_km + yearSplit.non_owner_km)
      : 0;
  const exactFuelPerKm = car.trip_km > 0 ? car.fuel_amount / car.trip_km : 0;
  const exactExpenses = car.expense_amount ?? 0;
  const exactPrice = priceForYear(priceHistory, year, car.car_price_per_km);

  // ── Defaults for current-year forecast sliders ────────────────

  const avgHistKm =
    historicalKm.length > 0
      ? Math.round(historicalKm.reduce((s, h) => s + h.km, 0) / historicalKm.length)
      : 0;

  const historicSplit = ownerSplit.filter((s) => s.year < currentYear);
  const avgOthersPct =
    historicSplit.length > 0
      ? historicSplit.reduce((s, h) => {
          const total = h.owner_km + h.non_owner_km;
          return s + (total > 0 ? h.non_owner_km / total : 0.65);
        }, 0) / historicSplit.length
      : 0.65;

  const avgExpenses =
    _historicalExpenses.length > 0
      ? Math.round(
          _historicalExpenses.reduce((s, e) => s + e.amount, 0) / _historicalExpenses.length
        )
      : 0;

  const kmDataYears = historicalKm.length;
  const othersDataYears = historicSplit.length;
  const expensesDataYears = _historicalExpenses.length;

  const ytdFuelPerKm = car.trip_km > 0 ? car.fuel_amount / car.trip_km : 0;
  const defaultFuelPerKm = rollingFuelPerKm > 0 ? rollingFuelPerKm : ytdFuelPerKm;

  // ── Slider state ──────────────────────────────────────────────
  // For historic years, initialize from exact actuals.
  // For current year, initialize from rolling/historical averages.

  const [fuelPerKm, setFuelPerKm] = useState(
    isHistoric ? exactFuelPerKm : defaultFuelPerKm || 0.12
  );
  const [totalKm, setTotalKm] = useState(
    isHistoric ? car.trip_km : (car.expected_km ?? (avgHistKm || car.prev_year_trip_km || 14000))
  );
  const [pctOthers, setPctOthers] = useState(
    isHistoric ? Math.round(exactPctOthers * 100) / 100 : Math.round(avgOthersPct * 100) / 100
  );
  const [expectedExpenses, setExpectedExpenses] = useState(
    isHistoric ? exactExpenses : avgExpenses || car.expense_amount || 0
  );
  const [pricePerKm, setPricePerKm] = useState(isHistoric ? exactPrice : car.car_price_per_km);

  // ── Derived projections ───────────────────────────────────────

  const nonOwnerKm = totalKm * pctOthers;
  const ownerKm = totalKm * (1 - pctOthers);
  const markupPerKm = pricePerKm - fuelPerKm;
  const nonOwnerMarkup = markupPerKm * nonOwnerKm;
  const ownerFuelCost = fuelPerKm * ownerKm;

  const fuelThreshold = fuelPerKm;
  const safeNonOwnerKm = Math.max(1, nonOwnerKm);
  const expenseThreshold = fuelPerKm + expectedExpenses / safeNonOwnerKm;
  const fuelCoverThreshold = fuelPerKm + (expectedExpenses + ownerFuelCost) / safeNonOwnerKm;

  const zone: Zone =
    markupPerKm < 0
      ? "red"
      : nonOwnerMarkup < expectedExpenses
        ? "orange"
        : nonOwnerMarkup < expectedExpenses + ownerFuelCost
          ? "light_green"
          : "dark_green";

  const ownerNet = nonOwnerMarkup - expectedExpenses - ownerFuelCost;
  const color = zoneColor(zone);

  // ── YTD snapshot ──────────────────────────────────────────────

  const currentMonth = new Date().getMonth() + 1;
  const othersRevenue = car.trip_revenue - car.owner_trip_amount;
  const ytdNet = othersRevenue - car.variable_total;

  // ── Card collapse ─────────────────────────────────────────────
  // Controlled by the parent when props are supplied (so the choice survives
  // year switches that remount this component); otherwise managed locally.

  const [expandedInternal, setExpandedInternal] = useState(true);
  const expanded = expandedProp ?? expandedInternal;
  const toggleExpanded = onToggleExpanded ?? (() => setExpandedInternal((v) => !v));

  // ── Save ──────────────────────────────────────────────────────

  function handleSave() {
    if (!fullCar) return;
    updateCar.mutate(
      { ...fullCar, price_per_km: pricePerKm, expected_km: Math.round(totalKm) } as Car & {
        id: number;
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["admin-summary"] });
          qc.invalidateQueries({ queryKey: ["cars"] });
          toast.success(t("toast.saved"));
        },
      }
    );
  }

  // ── Hint labels ───────────────────────────────────────────────

  const exactHint = t("coverage.exact");
  const nYrHint = (n: number) => (n > 0 ? t("coverage.default_avg_n", { n }) : "—");
  const fuelHint = isHistoric ? exactHint : rollingFuelPerKm > 0 ? t("coverage.default_12m") : "—";
  const kmHint = isHistoric ? exactHint : nYrHint(kmDataYears);
  const othersHint = isHistoric ? exactHint : nYrHint(othersDataYears);
  const expensesHint = isHistoric ? exactHint : nYrHint(expensesDataYears);
  const priceHint = isHistoric ? exactHint : t("coverage.default_current");

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700 }}>{car.car_name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1.5,
                color,
                border: `2px solid ${color}`,
                padding: "3px 8px",
                textTransform: "uppercase",
                transform: "rotate(-2deg)",
              }}
            >
              {t(zoneKey(zone))}
            </div>
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-label={expanded ? t("action.collapse") : t("action.expand")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: tokens.inkDim,
                fontFamily: fontMono,
                fontSize: 13,
                lineHeight: 1,
                padding: "2px 4px",
                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s",
              }}
            >
              ▾
            </button>
          </div>
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: tokens.inkDim,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {isHistoric ? String(year) : t("coverage.ytd", { months: currentMonth })}
        </div>

        {/* General stats */}
        {expanded &&
          (() => {
            const othersTrips = car.trip_count - car.owner_trip_count;
            const othersKm = car.trip_km - car.owner_trip_km;
            const othersFuelCnt = car.fuel_count - car.owner_fuel_count;
            const othersFuelL = car.fuel_liters - car.owner_fuel_liters;
            const othersFuelAmt = car.fuel_amount - car.owner_fuel_amount;
            const sub: React.CSSProperties = {
              paddingLeft: 12,
              display: "flex",
              justifyContent: "space-between",
              fontFamily: fontMono,
              fontSize: 9,
              color: tokens.inkDim,
              marginBottom: 1,
            };
            const head: React.CSSProperties = {
              display: "flex",
              justifyContent: "space-between",
              fontFamily: fontMono,
              fontSize: 11,
              fontWeight: 700,
              color: tokens.ink,
              marginBottom: 2,
            };
            return (
              <div
                style={{
                  marginTop: 10,
                  borderTop: `1px dashed ${tokens.paperDark}`,
                  paddingTop: 10,
                }}
              >
                <div style={head}>
                  <span>
                    {car.trip_count} {t("stats.trips")} · {car.trip_km.toLocaleString("nl-BE")} km
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.others")}</span>
                  <span>
                    {othersTrips} {t("stats.trips_short")} · {othersKm.toLocaleString("nl-BE")} km ·{" "}
                    {fmtMoney(othersRevenue)}
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.own")}</span>
                  <span>
                    {car.owner_trip_count} {t("stats.trips_short")} ·{" "}
                    {car.owner_trip_km.toLocaleString("nl-BE")} km ·{" "}
                    {fmtMoney(car.owner_trip_amount)}
                  </span>
                </div>

                <div style={{ ...head, marginTop: 8 }}>
                  <span>
                    {car.fuel_count} {t("stats.fillups")} · {car.fuel_liters.toFixed(0)} L ·{" "}
                    {fmtMoney(car.fuel_amount)}
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.others")}</span>
                  <span>
                    {othersFuelCnt} {t("stats.fillups_short")} · {othersFuelL.toFixed(0)} L ·{" "}
                    {fmtMoney(othersFuelAmt)}
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.own")}</span>
                  <span>
                    {car.owner_fuel_count} {t("stats.fillups_short")} ·{" "}
                    {car.owner_fuel_liters.toFixed(0)} L · {fmtMoney(car.owner_fuel_amount)}
                  </span>
                </div>

                <div style={{ ...head, marginTop: 8 }}>
                  <span>
                    {car.expense_count} {t("stats.expenses")} · {fmtMoney(car.expense_amount)}
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.others")}</span>
                  <span>
                    {car.expense_count - car.owner_expense_count} {t("stats.expenses_short")} ·{" "}
                    {fmtMoney(car.expense_amount - car.owner_expense_amount)}
                  </span>
                </div>
                <div style={sub}>
                  <span>{t("stats.own")}</span>
                  <span>
                    {car.owner_expense_count} {t("stats.expenses_short")} ·{" "}
                    {fmtMoney(car.owner_expense_amount)}
                  </span>
                </div>
              </div>
            );
          })()}

        {/* YTD / year actuals — NET always visible; revenue & costs only when expanded */}
        <div style={{ marginTop: 10, borderTop: `1px dashed ${tokens.paperDark}`, paddingTop: 10 }}>
          {expanded && (
            <>
              <Row
                label={t("breakeven.revenue")}
                value={fmtMoney(othersRevenue)}
                color={tokens.green}
              />
              <Row
                label={t("breakeven.expenses")}
                value={fmtMoneyOut(car.variable_total)}
                color={tokens.accent}
              />
            </>
          )}
          <Row
            label={t("breakeven.net")}
            value={fmtMoney(Math.abs(ytdNet))}
            color={ytdNet >= 0 ? tokens.green : tokens.accent}
            big
          />
        </div>
      </Card>

      {/* Zone bar + sliders */}
      <Card>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: tokens.inkDim,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {t("coverage.title")}
        </div>
        <ZoneBar
          fuelThreshold={fuelThreshold}
          expenseThreshold={expenseThreshold}
          fuelCoverThreshold={fuelCoverThreshold}
          currentPrice={pricePerKm}
        />

        {/* 5 rows (sliders for current year, read-only for historic) */}
        <SliderRow
          label={t("coverage.slider.fuel_per_km")}
          hint={fuelHint}
          value={fuelPerKm}
          min={0.01}
          max={0.5}
          step={0.005}
          format={(v) => `€ ${v.toFixed(3)}/km`}
          onChange={setFuelPerKm}
          readOnly={isHistoric}
        />
        <SliderRow
          label={t("coverage.slider.total_km")}
          hint={kmHint}
          value={totalKm}
          min={500}
          max={Math.max(50000, totalKm * 1.5)}
          step={100}
          format={(v) => v.toLocaleString("nl-BE") + " km"}
          onChange={setTotalKm}
          readOnly={isHistoric}
        />
        <SliderRow
          label={t("coverage.slider.pct_others")}
          hint={othersHint}
          value={pctOthers}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={setPctOthers}
          readOnly={isHistoric}
        />
        <SliderRow
          label={t("coverage.slider.expenses")}
          hint={expensesHint}
          value={expectedExpenses}
          min={0}
          max={Math.max(5000, expectedExpenses * 2)}
          step={50}
          format={(v) => fmtMoney(v)}
          onChange={setExpectedExpenses}
          readOnly={isHistoric}
        />
        <SliderRow
          label={t("coverage.slider.price")}
          hint={priceHint}
          value={pricePerKm}
          min={0.01}
          max={Math.max(1.0, pricePerKm * 2)}
          step={0.005}
          format={(v) => `€ ${v.toFixed(3)}/km`}
          onChange={setPricePerKm}
          readOnly={isHistoric}
        />

        {/* Projection / actuals summary */}
        <div
          style={{ background: tokens.paperDeep, padding: "12px", marginTop: 8, marginBottom: 12 }}
        >
          <div
            style={{
              fontFamily: fontMono,
              fontSize: 8,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: tokens.inkDim,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {t("coverage.projection.title")}
          </div>
          <Row
            label={t("coverage.projection.others_contribution")}
            value={fmtMoney(nonOwnerMarkup)}
            color={nonOwnerMarkup >= 0 ? tokens.green : tokens.accent}
          />
          <Row
            label={t("coverage.projection.expenses")}
            value={fmtMoneyOut(expectedExpenses)}
            color={tokens.accent}
          />
          <Row
            label={t("coverage.projection.owner_fuel")}
            value={fmtMoneyOut(ownerFuelCost)}
            color={tokens.accent}
          />
          <div style={{ height: 0, borderTop: `1px dashed ${tokens.inkMute}`, margin: "6px 0" }} />
          <Row
            label={t("coverage.projection.net")}
            value={fmtMoney(Math.abs(ownerNet))}
            color={ownerNet >= 0 ? tokens.green : tokens.accent}
            big
          />
        </div>

        {/* Save button — only for current year */}
        {!isHistoric && (
          <button
            onClick={handleSave}
            disabled={!fullCar || updateCar.isPending}
            style={{
              width: "100%",
              padding: "11px",
              background: tokens.ink,
              color: tokens.paper,
              border: "none",
              cursor: !fullCar || updateCar.isPending ? "default" : "pointer",
              opacity: !fullCar || updateCar.isPending ? 0.6 : 1,
              fontFamily: fontMono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {updateCar.isPending ? "…" : t("coverage.save", { year })}
          </button>
        )}
      </Card>
    </div>
  );
}
