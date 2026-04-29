"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useAdminSummary, Card, Row, Perf } from "../_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";

// ── Owner Payout Page ─────────────────────────────────────────
export default function AdminPayoutPage() {
  const t = useT();
  const { data: me } = useMe();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data } = useAdminSummary(year);

  useEffect(() => {
    if (me && !me.isAdmin) router.replace("/admin");
  }, [me, router]);

  if (!me?.isAdmin) return null;

  const cars = data?.carPnL ?? [];

  const byOwner: Record<string, typeof cars> = {};
  for (const car of cars) {
    const owner = car.owner_name ?? "—";
    (byOwner[owner] ??= []).push(car);
  }

  return (
    <div style={{ padding: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= earliestYear}
          style={{
            padding: "6px 14px",
            background: "transparent",
            border: `1.5px solid ${paper.ink}`,
            borderRight: "none",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            color: year <= earliestYear ? paper.inkMute : paper.ink,
            cursor: year <= earliestYear ? "default" : "pointer",
            letterSpacing: 1,
          }}
        >
          ← {year - 1}
        </button>
        <div
          style={{
            padding: "6px 18px",
            background: paper.ink,
            color: paper.paper,
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            border: `1.5px solid ${paper.ink}`,
          }}
        >
          {year}
        </div>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          style={{
            padding: "6px 14px",
            background: "transparent",
            border: `1.5px solid ${paper.ink}`,
            borderLeft: "none",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 700,
            color: year >= currentYear ? paper.inkMute : paper.ink,
            cursor: year >= currentYear ? "default" : "pointer",
            letterSpacing: 1,
          }}
        >
          {year + 1} →
        </button>
      </div>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {t("admin.payout_subtitle")}
      </div>

      {Object.entries(byOwner).map(([owner, ownerCars]) => {
        const totalNet = ownerCars.reduce((s, c) => s + c.net_to_owner, 0);
        const positive = totalNet >= 0;
        return (
          <Card key={owner}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{ fontFamily: fontSerif, fontSize: 20, fontWeight: 700, color: paper.ink }}
                >
                  {owner}
                </div>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkDim,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  {ownerCars.map((c) => c.car_short).join(" · ")}
                </div>
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "5px 12px",
                  border: `2.5px solid ${positive ? paper.green : paper.accent}`,
                  color: positive ? paper.green : paper.accent,
                  fontFamily: fontMono,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  transform: "rotate(-3deg)",
                  opacity: 0.9,
                }}
              >
                {positive ? t("admin.stamp_credit") : t("admin.stamp_loss")}
              </div>
            </div>

            {ownerCars.map((car) => {
              const fixedCovered = Math.max(0, car.trip_revenue - car.variable_total);
              const pctCovered = car.fixed_total > 0 ? fixedCovered / car.fixed_total : 0;
              const carried = Math.max(0, car.fixed_total - fixedCovered);

              return (
                <div key={car.car_id} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 10,
                      color: paper.ink,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {car.car_short} — {car.car_name}
                  </div>

                  {car.fixed_total > 0 && (
                    <div
                      style={{
                        padding: "10px 12px",
                        background: paper.paperDeep,
                        borderLeft: `3px solid ${paper.blue}`,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: fontSerif,
                          fontSize: 15,
                          fontWeight: 700,
                          color: paper.blue,
                          marginBottom: 2,
                        }}
                      >
                        {t("payout.covered_hero", {
                          covered: fmtMoney(fixedCovered).replace("€ ", ""),
                        })}
                      </div>
                      <div
                        style={{
                          fontFamily: fontMono,
                          fontSize: 9,
                          color: paper.inkDim,
                          letterSpacing: 0.8,
                        }}
                      >
                        {t("payout.carried", {
                          pct: Math.round(Math.max(0, 1 - pctCovered) * 100),
                          remaining: fmtMoney(carried),
                        })}
                      </div>
                    </div>
                  )}

                  <Row label={t("admin.trip_revenue")} value={fmtMoney(car.trip_revenue)} />
                  <Row label={t("admin.fuel_cost")} value={`− ${fmtMoney(car.fuel_amount)}`} />
                  <Row
                    label={t("admin.maintenance_costs")}
                    value={`− ${fmtMoney(car.expense_amount)}`}
                  />
                  <Row label={t("admin.fixed_cost")} value={`− ${fmtMoney(car.fixed_total)}`} />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: fontMono,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "4px 0",
                      color: car.net_to_owner >= 0 ? paper.green : paper.accent,
                    }}
                  >
                    <span
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        fontSize: 10,
                        color: paper.inkDim,
                      }}
                    >
                      {t("admin.net_owner")}
                    </span>
                    <span>
                      {car.net_to_owner >= 0 ? "+" : ""}
                      {fmtMoney(car.net_to_owner)}
                    </span>
                  </div>
                </div>
              );
            })}

            <Perf margin="10px 0" />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontFamily: fontMono,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: paper.inkDim,
                }}
              >
                {t("admin.total_year", { year })}
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: positive ? paper.green : paper.accent,
                  fontFamily: fontSerif,
                }}
              >
                {positive ? "+" : ""}
                {fmtMoney(totalNet)}
              </span>
            </div>
          </Card>
        );
      })}

      <Card style={{ background: paper.paperDeep }}>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            color: paper.inkDim,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {t("admin.fairness_title")}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: paper.ink, lineHeight: 1.6 }}>
          {t("admin.fairness_text_1")}
          <br />
          <br />
          {t("admin.fairness_text_2")}
        </div>
      </Card>
    </div>
  );
}
