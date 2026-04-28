"use client";
import { useState } from "react";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import type { CarPnL, MonthlyCarKm, PersonContribution, CarYearKm, CarPriceHistory } from "@/lib/queries/admin";
import type { Car } from "@/types";
import { useCars, useUpdateCar } from "@/hooks/use-cars";
import { usePeople } from "@/hooks/use-people";
import { useAdminSummary, beMetrics, Card, Row, Perf } from "../_shared";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Car Row (accordion) ───────────────────────────────────────
function CarRow({ car, expanded, onToggle, onSave, people }: {
  car: Car;
  expanded: boolean;
  onToggle: () => void;
  onSave: (data: Partial<Car>) => void;
  people: { id: number; name: string }[];
}) {
  const t = useT();
  const [name, setName] = useState(car.name);
  const [price, setPrice] = useState(car.price_per_km);
  const [owner, setOwner] = useState(car.owner_name ?? "");
  const isActive = car.active !== 0;

  const [prevId, setPrevId] = useState(car.id);
  if (car.id !== prevId) {
    setPrevId(car.id);
    setName(car.name);
    setPrice(car.price_per_km);
    setOwner(car.owner_name ?? "");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 8px", fontFamily: fontMono, fontSize: 11,
    border: `1px solid ${paper.paperDark}`, background: paper.paperDeep,
    color: paper.ink, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5,
    textTransform: "uppercase", display: "block", marginBottom: 3,
  };

  return (
    <div style={{
      background: paper.paper, marginBottom: 6,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
      borderLeft: expanded ? `3px solid ${paper.blue}` : `3px solid transparent`,
      opacity: isActive ? 1 : 0.55,
    }}>
      {/* Collapsed header — click to toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{
          padding: "4px 8px", background: isActive ? paper.ink : paper.inkMute, color: paper.paper,
          fontFamily: fontMono, fontSize: 11, fontWeight: 700,
          letterSpacing: 2, flexShrink: 0, minWidth: 40, textAlign: "center",
        }}>
          {car.short}
        </div>
        <div style={{
          flex: 1, fontFamily: fontSerif, fontSize: 14, fontWeight: 600, color: paper.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {car.owner_name ?? <span style={{ color: paper.inkMute, fontStyle: "italic" }}>—</span>}
        </div>
        <div style={{
          fontFamily: fontMono, fontSize: 11, fontWeight: 700,
          color: paper.ink, flexShrink: 0,
        }}>
          €{car.price_per_km.toFixed(3)}/km
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px dashed ${paper.paperDark}` }}>
          <div style={{ paddingTop: 12, marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>{t("form.price_per_km")}</label>
            <input type="number" step="0.005" value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t("form.owner")}</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => onSave({ name, price_per_km: price, owner_name: owner || null, active: isActive ? 0 : 1 })}
              style={{
                width: "100%", padding: "8px", background: "transparent",
                color: isActive ? paper.accent : paper.green,
                border: `1.5px solid ${isActive ? paper.accent : paper.green}`,
                cursor: "pointer", fontFamily: fontMono, fontSize: 9,
                fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
              }}>
              {isActive ? t("admin.deactivate") : t("admin.activate")}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onToggle} style={{
              flex: 1, padding: "9px", background: "transparent", color: paper.inkDim,
              border: `1px solid ${paper.paperDark}`, cursor: "pointer",
              fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
            }}>
              {t("action.cancel")}
            </button>
            <button
              onClick={() => onSave({ name, price_per_km: price, owner_name: owner || null, active: car.active })}
              style={{
                flex: 2, padding: "9px", background: paper.ink, color: paper.paper,
                border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 9,
                fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
              }}>
              {t("action.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Burden Curve ──────────────────────────────────────────────
function BurdenCurve({ car, monthlyKm, contribPerKm }: {
  car: CarPnL;
  monthlyKm: MonthlyCarKm[];
  contribPerKm: number;
}) {
  const fixed = car.fixed_total;
  if (fixed <= 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const mKm: number[] = Array(12).fill(0);
  for (const m of monthlyKm) {
    const idx = parseInt(m.year_month.slice(5, 7)) - 1;
    if (idx >= 0 && idx < 12) mKm[idx] = m.km;
  }

  let cumKm = 0;
  const actualPts: { x: number; y: number }[] = [];
  for (let i = 0; i < currentMonth; i++) {
    cumKm += mKm[i];
    const burden = fixed - contribPerKm * cumKm;
    const pct = Math.max(-0.15, Math.min(1, burden / fixed));
    actualPts.push({ x: 34 + (i / 11) * 236, y: 12 + (1 - pct) * 76 });
  }

  const monthlyRate = currentMonth > 0 ? cumKm / currentMonth : 0;
  let projCumKm = cumKm;
  const projPts: { x: number; y: number }[] = [];
  if (currentMonth < 12 && actualPts.length > 0) {
    projPts.push(actualPts[actualPts.length - 1]);
    for (let i = currentMonth; i < 12; i++) {
      projCumKm += monthlyRate;
      const burden = fixed - contribPerKm * projCumKm;
      const pct = Math.max(-0.15, Math.min(1, burden / fixed));
      projPts.push({ x: 34 + (i / 11) * 236, y: 12 + (1 - pct) * 76 });
    }
  }

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const dot = actualPts[actualPts.length - 1];
  const currentBurden = fixed - contribPerKm * cumKm;

  return (
    <div style={{ background: paper.paperDeep, padding: "10px 10px 6px", marginBottom: 10 }}>
      <svg viewBox="0 0 280 108" style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={34} y1={12} x2={270} y2={12} stroke={paper.blue} strokeWidth={0.8} strokeDasharray="3 3" />
        <line x1={34} y1={88} x2={270} y2={88} stroke={paper.green} strokeWidth={0.8} strokeDasharray="2 3" />
        <text x={36} y={10} fontFamily="'JetBrains Mono'" fontSize={7.5} fill={paper.blue} fontWeight="700">
          {fmtMoney(fixed)}
        </text>
        <text x={36} y={87} fontFamily="'JetBrains Mono'" fontSize={7} fill={paper.green}>
          break-even
        </text>
        {actualPts.length > 1 && (
          <path d={path(actualPts)} stroke={paper.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        )}
        {projPts.length > 1 && (
          <path d={path(projPts)} stroke={paper.accent} strokeWidth={1.5} fill="none" strokeDasharray="3 3" />
        )}
        {dot && (
          <>
            <circle cx={dot.x} cy={dot.y} r={4} fill={paper.accent} stroke={paper.paperDeep} strokeWidth={1.5} />
            <text x={Math.min(dot.x + 6, 220)} y={dot.y - 4} fontFamily="'JetBrains Mono'" fontSize={7.5} fill={paper.accent} fontWeight="700">
              {fmtMoney(Math.max(0, currentBurden))}
            </text>
          </>
        )}
        {projPts.length > 1 && (
          <text x={268} y={projPts[projPts.length - 1].y - 3} fontFamily="'JetBrains Mono'" fontSize={7} fill={paper.inkDim} textAnchor="end">
            {fmtMoney(Math.max(0, fixed - contribPerKm * projCumKm))}
          </text>
        )}
        <text x={34} y={104} fontFamily="'JetBrains Mono'" fontSize={7.5} fill={paper.inkMute} textAnchor="middle">jan</text>
        <text x={152} y={104} fontFamily="'JetBrains Mono'" fontSize={7.5} fill={paper.inkMute} textAnchor="middle">jul</text>
        <text x={270} y={104} fontFamily="'JetBrains Mono'" fontSize={7.5} fill={paper.inkMute} textAnchor="end">dec</text>
      </svg>
    </div>
  );
}

// ── Contribution Ledger ───────────────────────────────────────
function ContributionLedger({ car, contributions, contribPerKm }: {
  car: CarPnL;
  contributions: PersonContribution[];
  contribPerKm: number;
}) {
  const t = useT();
  if (contributions.length === 0) return null;

  const topped = contributions.slice(0, 5);
  const maxContrib = topped[0].km * contribPerKm;
  const totalContrib = contributions.reduce((s, c) => s + c.km * contribPerKm, 0);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        — {t("breakeven.helpers")} —
      </div>
      <Card style={{ padding: "10px 12px", borderLeft: `3px solid ${paper.green}`, marginBottom: 0 }}>
        {topped.map((c) => {
          const contrib = c.km * contribPerKm;
          const pct = maxContrib > 0 ? contrib / maxContrib : 0;
          return (
            <div key={c.person_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontFamily: fontMono, fontSize: 9 }}>
              <span style={{ minWidth: 60, color: paper.inkDim, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
                {c.person_name.split(" ")[0]}
              </span>
              <div style={{ flex: 1, height: 7, background: paper.paperDeep, position: "relative" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(pct * 100).toFixed(0)}%`, background: paper.green }} />
              </div>
              <span style={{ minWidth: 46, textAlign: "right", fontWeight: 700 }}>{fmtMoney(contrib)}</span>
            </div>
          );
        })}
        <div style={{ height: 0, borderTop: `1px dashed ${paper.ink}`, margin: "6px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 10, padding: "2px 0" }}>
          <span style={{ color: paper.inkDim, textTransform: "uppercase", letterSpacing: 1 }}>{t("breakeven.total")}</span>
          <span style={{ fontWeight: 700, color: paper.green }}>{fmtMoney(totalContrib)}</span>
        </div>
      </Card>
    </div>
  );
}

// ── Rate Assistant ────────────────────────────────────────────
function RateAssistant({ car, fullCar, historicalKm, variablePerKm, year, onSave }: {
  car: CarPnL;
  fullCar: Car;
  historicalKm: CarYearKm[];
  variablePerKm: number;
  year: number;
  onSave: (price: number, expectedKm: number) => void;
}) {
  const t = useT();
  const avgKm = historicalKm.length > 0
    ? Math.round(historicalKm.reduce((s, h) => s + h.km, 0) / historicalKm.length)
    : 0;
  const [expectedKm, setExpectedKm] = useState(car.expected_km ?? (car.prev_year_trip_km || avgKm || 5000));
  const [coverage, setCoverage] = useState(0.7);

  const suggestedRate = expectedKm > 0
    ? variablePerKm + (car.fixed_total * coverage) / expectedKm
    : variablePerKm;
  const newContrib = suggestedRate - variablePerKm;
  const breakEvenAtRate = newContrib > 0 ? Math.round(car.fixed_total / newContrib) : Infinity;
  const projBurden = car.fixed_total - newContrib * expectedKm;
  const maxHistKm = Math.max(1, ...historicalKm.map((h) => h.km), expectedKm);

  return (
    <div style={{ background: paper.paperDeep, padding: "14px", marginTop: 10 }}>
      <div style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: paper.inkDim, fontWeight: 700, marginBottom: 12 }}>
        {t("rate.title")}
      </div>

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
                  <div key={h.year} onClick={() => setExpectedKm(h.km)}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}
                onClick={() => setExpectedKm(car.trip_km || avgKm)}>
                <span style={{ fontFamily: fontMono, fontSize: 7, fontWeight: 700, color: paper.accent }}>
                  {Math.round(expectedKm / 100) / 10}k
                </span>
                <div style={{
                  width: "100%", height: Math.max(4, (expectedKm / maxHistKm) * 36),
                  background: paper.accent, opacity: 0.85,
                  backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 2px, rgba(244,239,228,0.3) 2px 3px)",
                }} />
                <span style={{ fontFamily: fontMono, fontSize: 7, color: paper.accent, fontWeight: 700 }}>
                  &apos;{String(year).slice(2)}
                </span>
              </div>
            </div>
          </div>
        )}
        <input type="range" min={500} max={Math.round(maxHistKm * 1.5)} step={100}
          value={expectedKm} onChange={(e) => setExpectedKm(parseInt(e.target.value))}
          style={{ width: "100%", accentColor: paper.accent }} />
        <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, textAlign: "center", color: paper.accent, marginTop: 2 }}>
          {expectedKm.toLocaleString("nl-BE")} km
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, marginBottom: 6 }}>{t("rate.q2")}</div>
        <input type="range" min={0.2} max={1} step={0.05} value={coverage}
          onChange={(e) => setCoverage(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: paper.green }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, color: paper.inkMute }}>
          <span>{t("rate.members_friendly")}</span>
          <span style={{ fontWeight: 700, color: paper.green }}>{Math.round(coverage * 100)}%</span>
          <span>{t("rate.full_recovery")}</span>
        </div>
      </div>

      <div style={{ background: paper.paper, padding: "12px", marginBottom: 10 }}>
        <div style={{ fontFamily: fontMono, fontSize: 8, color: paper.green, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
          {t("rate.suggested")}
        </div>
        <div style={{ fontFamily: fontSerif, fontSize: 38, fontWeight: 700, color: paper.green, lineHeight: 1, marginBottom: 2 }}>
          € {suggestedRate.toFixed(3)}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1, marginBottom: 8 }}>
          {t("rate.per_km_others")}
        </div>
        <Row
          label={t("fleet.break_even_km")}
          value={isFinite(breakEvenAtRate) ? breakEvenAtRate.toLocaleString("nl-BE") + " km" : "∞"}
        />
        <Row
          label={t("rate.expected_km")}
          value={expectedKm.toLocaleString("nl-BE") + " km"}
        />
        <Row
          label={t("breakeven.projected_burden")}
          value={fmtMoney(Math.max(0, projBurden))}
          color={projBurden <= 0 ? paper.green : projBurden < car.fixed_total * 0.5 ? paper.amber : paper.accent}
        />
      </div>

      <button
        onClick={() => onSave(suggestedRate, expectedKm)}
        style={{
          width: "100%", padding: "11px", background: paper.ink, color: paper.paper,
          border: "none", cursor: "pointer", fontFamily: fontMono, fontSize: 10,
          fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
        }}>
        {t("rate.commit", { year })}
      </button>
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
            <div key={h.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: fontMono, fontSize: 10, padding: "4px 0",
              borderBottom: `1px dotted ${paper.paperDark}`,
            }}>
              <span style={{ color: paper.inkDim }}>{h.effective_from}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>€ {h.price_per_km.toFixed(3)} / km</span>
                {i === 0 && (
                  <span style={{
                    fontFamily: fontMono, fontSize: 7, fontWeight: 700, letterSpacing: 1,
                    color: paper.green, border: `1px solid ${paper.green}`, padding: "1px 5px",
                    textTransform: "uppercase",
                  }}>
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
function BreakEvenCard({ car, fullCar, monthlyKm, contributions, historicalKm, priceHistory, year }: {
  car: CarPnL;
  fullCar: Car | undefined;
  monthlyKm: MonthlyCarKm[];
  contributions: PersonContribution[];
  historicalKm: CarYearKm[];
  priceHistory: CarPriceHistory[];
  year: number;
}) {
  const t = useT();
  const m = beMetrics(car);
  const qc = useQueryClient();
  const updateCar = useUpdateCar();
  const [showRate, setShowRate] = useState(false);
  const [whatIfRate, setWhatIfRate] = useState(car.car_price_per_km);

  const whatIfContrib = whatIfRate - m.variablePerKm;
  const whatIfCovered = Math.max(0, whatIfContrib * car.trip_km);
  const whatIfBurden = Math.max(0, car.fixed_total - whatIfCovered);

  const minRate = Math.max(0.05, m.variablePerKm + 0.01);
  const maxRate = m.variablePerKm + (car.fixed_total > 0 ? (car.fixed_total / Math.max(car.trip_km, 1000)) * 2 : 0.30);

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

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink }}>{car.car_name}</div>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>
            {t("admin.owner_info", { short: car.car_short, owner: car.owner_name ?? "—", km: car.trip_km.toLocaleString("nl-BE") })}
          </div>
        </div>
        <div style={{
          display: "inline-block", padding: "5px 12px",
          border: `2.5px solid ${m.status === "ahead" ? paper.green : paper.accent}`,
          color: m.status === "ahead" ? paper.green : paper.accent,
          fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase", transform: "rotate(-3deg)", opacity: 0.9,
        }}>
          {m.status === "ahead" ? t("admin.stamp_ok") : t("admin.stamp_warn")}
        </div>
      </div>

      {car.fixed_total > 0 && (
        <BurdenCurve car={car} monthlyKm={monthlyKm} contribPerKm={m.contribPerKm} />
      )}

      {car.fixed_total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Row label={t("breakeven.variable_km")} value={`€ ${m.variablePerKm.toFixed(4)}`} />
          <Row label={t("breakeven.contrib_km")} value={`€ ${m.contribPerKm.toFixed(4)}`} color={m.contribPerKm > 0 ? paper.green : paper.accent} />
          <Row label={t("admin.fixed_per_km")} value={`€ ${(car.fixed_total / Math.max(car.trip_km, 1)).toFixed(4)}`} />
          <Row label={t("admin.cost_price_km")} value={`€ ${car.cost_per_km.toFixed(4)}`} big />
          <Row label={t("admin.current_price_km")} value={`€ ${car.car_price_per_km.toFixed(4)}`} big />
        </div>
      )}

      <PriceHistoryStrip history={priceHistory} />

      <ContributionLedger car={car} contributions={contributions} contribPerKm={m.contribPerKm} />

      {car.fixed_total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            {t("breakeven.what_if")}
          </div>
          <input
            type="range"
            min={minRate.toFixed(3)}
            max={maxRate.toFixed(3)}
            step="0.005"
            value={whatIfRate}
            onChange={(e) => setWhatIfRate(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: whatIfBurden === 0 ? paper.green : paper.accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 11, marginTop: 4 }}>
            <span style={{ color: paper.inkDim }}>€ {whatIfRate.toFixed(3)} / km</span>
            <span style={{ color: whatIfBurden === 0 ? paper.green : paper.accent, fontWeight: 700 }}>
              {t("breakeven.projected_burden")}: {fmtMoney(whatIfBurden)}
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setShowRate((s) => !s)}
          style={{
            width: "100%", padding: "9px", background: showRate ? paper.ink : "transparent",
            color: showRate ? paper.paper : paper.ink,
            border: `1.5px solid ${paper.ink}`, cursor: "pointer",
            fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
          }}>
          {showRate ? "▲" : "▼"} {t("rate.open")}
        </button>
        {showRate && fullCar && (
          <RateAssistant
            car={car}
            fullCar={fullCar}
            historicalKm={historicalKm}
            variablePerKm={m.variablePerKm}
            year={year}
            onSave={handleCommitRate}
          />
        )}
      </div>
    </Card>
  );
}

// ── Fleet Tiles (main view) ───────────────────────────────────
function FleetTiles() {
  const t = useT();
  const year = new Date().getFullYear();
  const { data } = useAdminSummary(year);
  const { data: cars = [] } = useCars();
  const { data: people = [] } = usePeople();
  const updateCar = useUpdateCar();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [breakEvenCar, setBreakEvenCar] = useState<number | null>(null);

  const pnl = data?.carPnL ?? [];
  const monthlyKm = data?.monthlyCarKm ?? [];
  const contributions = data?.personContributions ?? [];
  const historicalKm = data?.historicalCarKm ?? [];
  const priceHistory = data?.priceHistory ?? [];
  const carMap = new Map(cars.map((c) => [c.id, c]));

  const toggle = (id: number) => setExpanded((prev) => (prev === id ? null : id));

  const handleSave = (car: Car, patch: Partial<Car>) => {
    updateCar.mutate(
      { ...car, ...patch } as Car & { id: number },
      { onSuccess: () => { setExpanded(null); toast.success(t("toast.saved")); } }
    );
  };

  if (breakEvenCar !== null) {
    const car = pnl.find((c) => c.car_id === breakEvenCar);
    if (car) {
      return (
        <div style={{ padding: "16px" }}>
          <button
            onClick={() => setBreakEvenCar(null)}
            style={{
              marginBottom: 12, padding: "7px 14px", background: "transparent",
              border: `1.5px solid ${paper.ink}`, color: paper.ink,
              fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              textTransform: "uppercase", cursor: "pointer",
            }}>
            ← {t("admin.sub_cars")}
          </button>
          <BreakEvenCard
            car={car}
            fullCar={carMap.get(car.car_id)}
            monthlyKm={monthlyKm.filter((m) => m.car_id === car.car_id)}
            contributions={contributions.filter((c) => c.car_id === car.car_id)}
            historicalKm={historicalKm.filter((h) => h.car_id === car.car_id)}
            priceHistory={priceHistory.filter((h) => h.car_id === car.car_id)}
            year={year}
          />
        </div>
      );
    }
  }

  const activeCars = cars.filter((c) => c.active !== 0);
  const inactiveCars = cars.filter((c) => c.active === 0);

  const renderCar = (car: Car) => (
    <CarRow
      key={car.id}
      car={car}
      expanded={expanded === car.id}
      onToggle={() => toggle(car.id)}
      onSave={(patch) => handleSave(car, patch)}
      people={people}
    />
  );

  return (
    <div style={{ padding: "16px" }}>
      {activeCars.map(renderCar)}
      {/* Break-even links for cars that have PnL data */}
      {pnl.filter((c) => {
        const full = carMap.get(c.car_id);
        return (!full || full.active !== 0) && c.fixed_total > 0;
      }).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {pnl.filter((c) => {
            const full = carMap.get(c.car_id);
            return (!full || full.active !== 0) && c.fixed_total > 0;
          }).map((car) => (
            <button
              key={car.car_id}
              onClick={() => setBreakEvenCar(car.car_id)}
              style={{
                display: "block", width: "100%", marginBottom: 6,
                padding: "9px 14px", background: "transparent",
                border: `1px dashed ${paper.inkDim}`, cursor: "pointer",
                fontFamily: fontMono, fontSize: 9, color: paper.inkDim,
                letterSpacing: 1.5, textTransform: "uppercase", textAlign: "left",
              }}>
              {car.car_short} — {t("fleet.see_breakeven")} →
            </button>
          ))}
        </div>
      )}
      {inactiveCars.length > 0 && (
        <>
          <div style={{
            fontFamily: fontMono, fontSize: 9, color: paper.inkDim, letterSpacing: 2,
            textTransform: "uppercase", padding: "14px 0 8px",
            borderTop: `1.5px dashed ${paper.inkMute}`, marginTop: 4,
          }}>
            {t("admin.car_deactivated_section")}
          </div>
          {inactiveCars.map(renderCar)}
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminWagensPage() {
  return <FleetTiles />;
}
