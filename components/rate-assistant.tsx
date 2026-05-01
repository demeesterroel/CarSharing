"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useUpdateCar } from "@/hooks/use-cars";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { beMetrics, Card, Row } from "@/app/admin/_shared";
import type { CarPnL, CarYearKm } from "@/lib/queries/admin";
import type { Car } from "@/types";

export interface RateAssistantProps {
  car: CarPnL;
  fullCar: Car | undefined;
  historicalKm: CarYearKm[];
  year: number;
  /** Called after a successful rate save */
  onCommit?: () => void;
}

export function RateAssistant({ car, fullCar, historicalKm, year, onCommit }: RateAssistantProps) {
  const t = useT();
  const qc = useQueryClient();
  const updateCar = useUpdateCar();

  const m = beMetrics(car);
  const variablePerKm = m.variablePerKm;

  const avgKm =
    historicalKm.length > 0
      ? Math.round(historicalKm.reduce((s, h) => s + h.km, 0) / historicalKm.length)
      : 0;
  const [expectedKm, setExpectedKm] = useState(
    car.expected_km ?? (car.prev_year_trip_km || avgKm || 5000)
  );
  const [coverage, setCoverage] = useState(0.7);

  const suggestedRate =
    expectedKm > 0 ? variablePerKm + (car.fixed_total * coverage) / expectedKm : variablePerKm;
  const newContrib = suggestedRate - variablePerKm;
  const breakEvenAtRate = newContrib > 0 ? Math.round(car.fixed_total / newContrib) : Infinity;
  const projBurden = car.fixed_total - newContrib * expectedKm;
  const maxHistKm = Math.max(1, ...historicalKm.map((h) => h.km), expectedKm);

  function handleCommitRate() {
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
    <Card>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: paper.inkDim,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {t("rate.title")}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, marginBottom: 6 }}>{t("rate.q1")}</div>
        {historicalKm.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: fontMono,
                fontSize: 8,
                color: paper.inkMute,
                letterSpacing: 0.8,
                marginBottom: 4,
              }}
            >
              <span>{t("rate.history", { n: historicalKm.length })}</span>
              <span>{t("rate.avg", { km: Math.round(avgKm / 100) / 10 + "k" })}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
              {historicalKm.map((h) => {
                const isLast = h.year === Math.max(...historicalKm.map((x) => x.year));
                const barH = Math.max(4, (h.km / maxHistKm) * 36);
                return (
                  <div
                    key={h.year}
                    onClick={() => setExpectedKm(h.km)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fontMono,
                        fontSize: 7,
                        fontWeight: 700,
                        color: isLast ? paper.ink : paper.inkMute,
                      }}
                    >
                      {Math.round(h.km / 100) / 10}k
                    </span>
                    <div
                      style={{
                        width: "100%",
                        height: barH,
                        background: isLast ? paper.ink : paper.paperDark,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: fontMono,
                        fontSize: 7,
                        color: isLast ? paper.ink : paper.inkMute,
                        fontWeight: isLast ? 700 : 400,
                      }}
                    >
                      &apos;{String(h.year).slice(2)}
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  cursor: "pointer",
                }}
                onClick={() => setExpectedKm(car.trip_km || avgKm)}
              >
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 7,
                    fontWeight: 700,
                    color: paper.accent,
                  }}
                >
                  {Math.round(expectedKm / 100) / 10}k
                </span>
                <div
                  style={{
                    width: "100%",
                    height: Math.max(4, (expectedKm / maxHistKm) * 36),
                    background: paper.accent,
                    opacity: 0.85,
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent 0 2px, rgba(244,239,228,0.3) 2px 3px)",
                  }}
                />
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 7,
                    color: paper.accent,
                    fontWeight: 700,
                  }}
                >
                  &apos;{String(year).slice(2)}
                </span>
              </div>
            </div>
          </div>
        )}
        <input
          type="range"
          min={500}
          max={Math.round(maxHistKm * 1.5)}
          step={100}
          value={expectedKm}
          onChange={(e) => setExpectedKm(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: paper.accent }}
        />
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            fontWeight: 700,
            textAlign: "center",
            color: paper.accent,
            marginTop: 2,
          }}
        >
          {expectedKm.toLocaleString("nl-BE")} km
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, marginBottom: 6 }}>{t("rate.q2")}</div>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={coverage}
          onChange={(e) => setCoverage(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: paper.green }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: fontMono,
            fontSize: 8,
            color: paper.inkMute,
          }}
        >
          <span>{t("rate.members_friendly")}</span>
          <span style={{ fontWeight: 700, color: paper.green }}>{Math.round(coverage * 100)}%</span>
          <span>{t("rate.full_recovery")}</span>
        </div>
      </div>

      <div style={{ background: paper.paperDeep, padding: "12px", marginBottom: 10 }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 8,
            color: paper.green,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {t("rate.suggested")}
        </div>
        <div
          style={{
            fontFamily: fontSerif,
            fontSize: 38,
            fontWeight: 700,
            color: paper.green,
            lineHeight: 1,
            marginBottom: 2,
          }}
        >
          € {suggestedRate.toFixed(2)}
        </div>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: paper.inkDim,
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          {t("rate.per_km_others")}
        </div>
        <Row
          label={t("fleet.break_even_km")}
          value={isFinite(breakEvenAtRate) ? breakEvenAtRate.toLocaleString("nl-BE") + " km" : "∞"}
        />
        <Row label={t("rate.expected_km")} value={expectedKm.toLocaleString("nl-BE") + " km"} />
        <Row
          label={t("breakeven.projected_burden")}
          value={fmtMoney(Math.max(0, projBurden))}
          color={
            projBurden <= 0
              ? paper.green
              : projBurden < car.fixed_total * 0.5
                ? paper.amber
                : paper.accent
          }
        />
      </div>

      <button
        onClick={handleCommitRate}
        disabled={!fullCar || updateCar.isPending}
        style={{
          width: "100%",
          padding: "11px",
          background: paper.ink,
          color: paper.paper,
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
        {updateCar.isPending ? "…" : t("rate.commit", { year })}
      </button>
    </Card>
  );
}
