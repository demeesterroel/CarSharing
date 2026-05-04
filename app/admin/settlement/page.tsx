"use client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useSettlement } from "@/hooks/use-settlement";
import { useMe } from "@/hooks/use-me";
import { apiFetch } from "@/lib/api/client";

function fmtL(liters: number): string {
  return liters.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function SettledNote({
  fuelCount,
  fuelLiters,
  expCount,
  expAmt,
}: {
  fuelCount: number;
  fuelLiters: number;
  expCount: number;
  expAmt: number;
}) {
  const t = useT();
  const fuelHas = fuelLiters > 0.05;
  const expHas = expAmt > 0.005;
  if (!fuelHas && !expHas) return null;
  const parts: string[] = [];
  if (fuelHas)
    parts.push(`${fuelCount} tankbeurt${fuelCount !== 1 ? "en" : ""} (${fmtL(fuelLiters)} L)`);
  if (expHas) parts.push(`${expCount} kost${expCount !== 1 ? "en" : ""} (${fmtMoney(expAmt)})`);
  return (
    <div
      style={{
        fontFamily: fontMono,
        fontSize: 8,
        color: paper.inkMute,
        paddingLeft: 16,
        marginTop: 6,
        fontStyle: "italic",
      }}
    >
      {"(*) "}
      {parts.join(" en ")}
      {" "}{t("settlement.settled_outside_note")}
    </div>
  );
}

function CarSettlementCard({ cs }: { cs: import("@/types").CarSettlement }) {
  const t = useT();

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Car header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 13, fontWeight: 700, color: paper.ink }}>
          {cs.car_short} — {cs.car_name}
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, alignSelf: "center" }}>
          {cs.owner_name}
        </div>
      </div>

      {/* Participant rows */}
      {cs.rows.map((row, i) => {
        const detail: string[] = [];
        if (row.trip_km > 0) detail.push(`+${row.trip_km} km`);
        if (row.fuel_liters > 0.05) {
          const star = row.fuel_settled_liters > 0.05 ? "(*)" : "";
          detail.push(`−${row.fuel_liters.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L${star}`);
        }
        if (row.expense_amount > 0.005) {
          const star = row.expense_settled_amount > 0.005 ? "(*)" : "";
          detail.push(`− ${fmtMoney(row.expense_amount)}${star}`);
        }
        const detailStr = detail.length > 0 ? ` (${detail.join(", ")})` : "";
        const label =
          row.row_type === "own"
            ? `${row.person_name} — ${t("settlement.row_own")}`
            : row.row_type === "cross_owner"
            ? `${row.person_name} — ${t("settlement.row_cross_owner")}`
            : row.person_name;

        return (
          <div key={i}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontFamily: fontMono,
              fontSize: row.row_type === "own" ? 9 : 11,
              color: row.row_type === "own" ? paper.inkDim : row.row_type === "cross_owner" ? paper.blue : paper.ink,
              marginBottom: 4,
              paddingLeft: row.row_type === "own" ? 8 : 0,
              fontStyle: row.row_type === "own" ? "italic" : "normal",
            }}>
              <span>
                {label}
                <span style={{ color: paper.inkDim, fontSize: 9 }}>{detailStr}</span>
              </span>
              {row.row_type !== "own" && (
                <span style={{ color: row.balance >= 0 ? paper.green : paper.accent }}>
                  {row.balance >= 0 ? "+" : "−"}{fmtMoney(Math.abs(row.balance))}
                </span>
              )}
            </div>
            <SettledNote
              fuelCount={row.fuel_settled_count}
              fuelLiters={row.fuel_settled_liters}
              expCount={row.expense_settled_count}
              expAmt={row.expense_settled_amount}
            />
          </div>
        );
      })}

      {/* Total row */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: fontMono, fontSize: 11, fontWeight: 700,
        borderTop: `1px solid ${paper.paperDark}`, paddingTop: 6, marginTop: 4,
        color: paper.ink,
      }}>
        <span>Totaal</span>
        <span style={{ color: cs.total_balance >= 0 ? paper.green : paper.accent }}>
          {cs.total_balance >= 0 ? "+" : "−"}{fmtMoney(Math.abs(cs.total_balance))}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: fontMono,
        fontSize: 9,
        color: paper.inkDim,
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function YearPicker({
  year,
  earliest,
  current,
  onChange,
}: {
  year: number;
  earliest: number;
  current: number;
  onChange: (y: number) => void;
}) {
  const btnBase: React.CSSProperties = {
    padding: "6px 14px",
    background: "transparent",
    fontFamily: fontMono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    border: `1.5px solid ${paper.ink}`,
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <button
        onClick={() => onChange(year - 1)}
        disabled={year <= earliest}
        style={{
          ...btnBase,
          borderRight: "none",
          color: year <= earliest ? paper.inkMute : paper.ink,
          cursor: year <= earliest ? "default" : "pointer",
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
        onClick={() => onChange(year + 1)}
        disabled={year >= current}
        style={{
          ...btnBase,
          borderLeft: "none",
          color: year >= current ? paper.inkMute : paper.ink,
          cursor: year >= current ? "default" : "pointer",
        }}
      >
        {year + 1} →
      </button>
    </div>
  );
}

function generateSettlementMd(data: import("@/types").SettlementResult, year: number): string {
  const lines: string[] = [`# Afrekening ${year}\n`];
  const fmt = (n: number) => n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n: number) => (n >= 0 ? `+€ ${fmt(n)}` : `−€ ${fmt(-n)}`);
  const fmtLoc = (l: number) => l.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Step 1 — per car
  const step1Total = data.car_settlements.reduce((s, c) => s + c.total_balance, 0);
  lines.push(`## Stap 1 — Leden → Coöp  (${sign(step1Total)})\n`);
  for (const cs of data.car_settlements) {
    lines.push(`### ${cs.car_name} (${cs.owner_name})  ${sign(cs.total_balance)}\n`);
    for (const row of cs.rows) {
      if (row.row_type === "own") {
        lines.push(`- **${row.person_name}** _(eigen ritten — €0)_`);
        lines.push(`  - Ritten: ${row.trip_km} km · €0,00`);
        continue;
      }
      const label = row.row_type === "cross_owner" ? `${row.person_name} _(mede-eigenaar)_` : `**${row.person_name}**`;
      lines.push(`- ${label}`);
      if (row.trip_km > 0)        lines.push(`  - Ritten: ${row.trip_km} km · € ${fmt(row.trip_amount)}`);
      if (row.fuel_liters > 0.05) lines.push(`  - Brandstof: ${fmtLoc(row.fuel_liters)} L · € ${fmt(row.fuel_amount)}`);
      if (row.expense_amount > 0.005) lines.push(`  - Kosten: € ${fmt(row.expense_amount)}`);
      lines.push(`  - Saldo: ${sign(row.balance)}`);
      if ((row.fuel_settled_liters ?? 0) > 0.05) {
        lines.push(`  - _(*)_ ${row.fuel_settled_count} tankbeurt(en) (${fmtLoc(row.fuel_settled_liters)}) L buiten de app verrekend`);
      }
      if ((row.expense_settled_amount ?? 0) > 0.005) {
        lines.push(`  - _(*)_ ${row.expense_settled_count} kost(en) (€ ${fmt(row.expense_settled_amount)}) buiten de app verrekend`);
      }
    }
    lines.push("");
  }

  // Step 2 — co-op → owners
  const owners = data.members.filter((m) => m.is_owner).sort((a, b) => a.person_name.localeCompare(b.person_name));
  const step2Total = owners.reduce((s, m) => s + (m.s2 ?? 0), 0);
  lines.push(`## Stap 2 — Coöp → Eigenaars  (${sign(step2Total)})\n`);
  for (const m of owners) {
    lines.push(`### ${m.person_name}  ${sign(m.s2 ?? 0)}\n`);
    const cs = data.car_settlements.filter((c) => c.owner_name === m.person_name);
    for (const c of cs) {
      lines.push(`- **${c.car_short} — ${c.car_name}**  ${sign(c.total_balance)}`);
      for (const row of c.rows.filter((r) => r.row_type !== "own")) {
        const contrib = row.balance;
        const detail: string[] = [`+${row.trip_km} km`];
        if (row.fuel_liters > 0.05) detail.push(`-${fmtLoc(row.fuel_liters)} L`);
        if (row.expense_amount > 0.005) detail.push(`-€ ${fmt(row.expense_amount)}`);
        lines.push(`  - ${row.person_name} (${detail.join(", ")}): ${sign(contrib)}`);
      }
    }
    lines.push(`- **Saldo via coöp: ${sign(m.s2 ?? 0)}**\n`);
  }

  // Payment summary
  lines.push(`## Betalingsoverzicht\n`);
  for (const tr of data.transfers) {
    lines.push(`- **Stap ${tr.step}** ${tr.from} → ${tr.to}: € ${fmt(tr.amount)}`);
  }

  return lines.join("\n");
}

export default function AdminSettlementPage() {
  const t = useT();
  const { data: me } = useMe();
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;
  const setYear = (newYear: number) => {
    const p = new URLSearchParams(searchParams.toString());
    if (newYear === currentYear) p.delete("year"); else p.set("year", String(newYear));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const { data: earliest = currentYear } = useEarliestDashboardYear();
  const { data, isLoading } = useSettlement(year);
  const qc = useQueryClient();

  const lock = useMutation({
    mutationFn: () => apiFetch(`/api/settlement/${year}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settlement", year] }),
  });

  function handleDownload() {
    if (!data) return;
    const md = generateSettlementMd(data, year);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afrekening-${year}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <YearPicker year={year} earliest={earliest} current={currentYear} onChange={(y) => setYear(y)} />
        {data && data.members.length > 0 && (
          <button
            onClick={handleDownload}
            title="Download als .md"
            style={{ position: "absolute", right: 0, padding: "6px 10px", background: "transparent", border: `1.5px solid ${paper.ink}`, color: paper.ink, cursor: "pointer", fontFamily: fontMono, fontSize: 12, lineHeight: 1 }}
          >
            ↓
          </button>
        )}
      </div>

      {data?.frozen && (
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              background: paper.green,
              color: paper.paper,
              fontFamily: fontMono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {t("settlement.frozen_badge")}
          </span>
          {data.settled_by && (
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, marginTop: 4 }}>
              {t("settlement.frozen_by", {
                date: data.settled_at?.slice(0, 10) ?? "",
                name: data.settled_by,
              })}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkMute,
            textAlign: "center",
            padding: 32,
          }}
        >
          …
        </div>
      )}

      {!isLoading && (!data || data.members.length === 0) && (
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 10,
            color: paper.inkMute,
            textAlign: "center",
            padding: 32,
          }}
        >
          {t("settlement.no_data", { year })}
        </div>
      )}

      {data && data.members.length > 0 && (
        <>
          {/* Step 1 — Members → Co-op, grouped by car */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>{t("settlement.step1_label")}</SectionLabel>
            {data.car_settlements.map((cs, i) => (
              <CarSettlementCard key={i} cs={cs} />
            ))}
          </div>

          {/* Step 2 — Co-op → Owners */}
          <div style={{ marginBottom: 24 }}>
            <SectionLabel>{t("settlement.step2_label")}</SectionLabel>
            {data.members
              .filter((m) => m.is_owner)
              .map((m, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  fontFamily: fontMono, fontSize: 11, marginBottom: 6, color: paper.ink,
                }}>
                  <span>{m.person_name}</span>
                  <span style={{ color: (m.s2 ?? 0) >= 0 ? paper.green : paper.accent }}>
                    {(m.s2 ?? 0) >= 0 ? "+" : "−"}{fmtMoney(Math.abs(m.s2 ?? 0))}
                  </span>
                </div>
              ))}
          </div>

          {me?.isAdmin && (
            <button
              onClick={() => lock.mutate()}
              disabled={lock.isPending}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "10px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background: data.frozen ? paper.paperDark : paper.ink,
                color: data.frozen ? paper.inkMute : paper.paper,
                border: "none",
                cursor: lock.isPending ? "default" : "pointer",
              }}
            >
              {lock.isPending
                ? "…"
                : data.frozen
                  ? t("settlement.unfinalize")
                  : t("settlement.finalize")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
