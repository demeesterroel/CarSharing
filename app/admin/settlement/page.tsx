"use client";
import { useState } from "react";
import { paper, fontMono } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { fmtMoney } from "@/lib/paper-theme";
import { useAdminSummary, Card, Row, Perf } from "../_shared";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";

// ── Settlement Page ───────────────────────────────────────────
export default function AdminAfrekPage() {
  const t = useT();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: earliestYear = currentYear } = useEarliestDashboardYear();
  const { data } = useAdminSummary(year);
  const allRows = data?.settlement ?? [];
  const rows = allRows.filter(
    (r) => r.trip_count > 0 || r.fuel_count > 0 || r.expense_amount !== 0
  );
  const totalCredits = rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0);
  const totalDebits = rows.filter((r) => r.balance < 0).reduce((s, r) => s + r.balance, 0);

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
      <Card>
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: paper.ink,
            letterSpacing: 3,
            textTransform: "uppercase",
            textAlign: "center",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          — {t("admin.settlement_title", { year })} —
        </div>

        {rows
          .sort((a, b) => b.balance - a.balance)
          .map((row) => {
            const positive = row.balance > 0.01;
            const negative = row.balance < -0.01;
            return (
              <div
                key={row.person_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontFamily: fontMono,
                  padding: "6px 0",
                  borderBottom: `1px dotted ${paper.paperDark}`,
                }}
              >
                <span style={{ fontSize: 12, color: paper.ink }}>{row.person_name}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: positive ? paper.green : negative ? paper.accent : paper.inkMute,
                  }}
                >
                  {positive ? "+" : ""}
                  {fmtMoney(row.balance)}
                </span>
              </div>
            );
          })}

        <Perf margin="12px 0 8px" />
        <Row
          label={t("admin.total_credit")}
          value={`+${fmtMoney(totalCredits)}`}
          color={paper.green}
        />
        <Row label={t("admin.total_debit")} value={fmtMoney(totalDebits)} color={paper.accent} />
        <Perf margin="8px 0" />
        <Row
          label={t("admin.balance_check")}
          value={fmtMoney(totalCredits + totalDebits)}
          big
          color={Math.abs(totalCredits + totalDebits) < 1 ? paper.green : paper.accent}
        />
      </Card>

      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkMute,
          textAlign: "center",
          marginTop: 8,
          letterSpacing: 1,
        }}
      >
        {t("admin.settlement_formula")}
      </div>
    </div>
  );
}
