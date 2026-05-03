"use client";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { paper, fontMono, fontSerif, fmtMoney } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useSettlement } from "@/hooks/use-settlement";
import { useMe } from "@/hooks/use-me";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { apiFetch } from "@/lib/api/client";
import { Card, Row, Perf } from "../_shared";
import type { MemberStatement, Transfer } from "@/types";

function fmtL(liters: number): string {
  return liters.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtDetail(
  km: number,
  liters: number,
  expAmt: number,
  settledFuelLiters?: number,
  settledExpAmt?: number
): string {
  const parts: string[] = [];
  if (km > 0) parts.push(`+${km} km`);
  if (liters > 0.05) {
    const star = (settledFuelLiters ?? 0) > 0.05 ? "(*)" : "";
    parts.push(`−${fmtL(liters)} L${star}`);
  }
  if (expAmt > 0.005) {
    const star = (settledExpAmt ?? 0) > 0.005 ? "(*)" : "";
    parts.push(`− € ${expAmt.toFixed(2).replace(".", ",")}${star}`);
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
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

function BreakdownSection({
  label,
  totalRight,
  amount,
  amountColor,
  children,
}: {
  label: string;
  totalRight: string | null;
  amount: string;
  amountColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase" as const,
            fontWeight: 700,
            color: paper.inkMute,
          }}
        >
          {label}
          {totalRight ? ` (${totalRight})` : ""}
        </span>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            fontWeight: 600,
            color: amountColor,
            paddingLeft: 12,
          }}
        >
          {amount}
        </span>
      </div>
      {children}
    </div>
  );
}

function BreakdownCarRow({
  car,
  detail,
  amount,
  amountColor,
}: {
  car: string;
  detail: string | null;
  amount: string;
  amountColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginTop: 3,
        paddingLeft: 16,
      }}
    >
      <span style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim, letterSpacing: 1 }}>
        {car}
        {detail ? ` (${detail})` : ""}
      </span>
      <span style={{ fontFamily: fontMono, fontSize: 10, color: amountColor, paddingLeft: 12 }}>
        {amount}
      </span>
    </div>
  );
}

function NonOwnerMemberCard({
  m,
  year,
  bankAccount,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  const s1 = m.s1 ?? 0;
  const isPositive = s1 > 0;
  const netColor = isPositive ? paper.green : s1 < 0 ? paper.accent : paper.inkMute;

  const totalKm = m.car_eras.reduce((s, e) => s + e.trip_km, 0);
  const totalTripAmt = m.car_eras.reduce((s, e) => s + e.trip_amount, 0);
  const totalFuelL = m.car_eras.reduce((s, e) => s + e.fuel_liters, 0);
  const totalFuelAmt = m.car_eras.reduce((s, e) => s + e.fuel_amount, 0);
  const totalExpAmt = m.car_eras.reduce((s, e) => s + e.expense_amount, 0);

  const copyMsg = () => {
    const iban =
      bankAccount || "(rekeningnummer niet ingesteld — stel in via Admin → Instellingen)";

    // Fixed-width formatting helpers
    const W = 40; // section-total lines
    const WC = 32; // per-car lines (visually indented)

    // Simple euro formatter with padded number for monospace alignment
    const e = (n: number) => `€ ${n.toFixed(2).replace(".", ",").padStart(6)}`;

    // Right-align the amount column at position `w`
    const row = (left: string, sign: "+" | "−", n: number, w: number) => {
      const right = `${sign} ${e(n)}`;
      return left + " ".repeat(Math.max(1, w - left.length - right.length)) + right;
    };

    const sections: string[] = [];

    if (totalTripAmt > 0) {
      const sec = [row(`${t("page.trips")} (${totalKm} km)`, "−", totalTripAmt, W)];
      for (const era of m.car_eras.filter((ev) => ev.trip_km > 0)) {
        sec.push(row(`  ${era.car_short.padEnd(5)} (${era.trip_km} km)`, "−", era.trip_amount, WC));
      }
      sections.push(sec.join("\n"));
    }

    if (totalFuelAmt > 0) {
      const sec = [row(`${t("settlement.breakdown_fuel")} (${fmtL(totalFuelL)} L)`, "+", totalFuelAmt, W)];
      for (const era of m.car_eras.filter((ev) => ev.fuel_liters > 0)) {
        sec.push(
          row(`  ${era.car_short.padEnd(5)} (${fmtL(era.fuel_liters)} L)`, "+", era.fuel_amount, WC)
        );
      }
      sections.push(sec.join("\n"));
    }

    if (totalExpAmt > 0) {
      const sec = [row(t("settlement.breakdown_costs"), "+", totalExpAmt, W)];
      for (const era of m.car_eras.filter((ev) => ev.expense_amount > 0)) {
        sec.push(row(`  ${era.car_short.padEnd(5)}`, "+", era.expense_amount, WC));
      }
      sections.push(sec.join("\n"));
    }

    const separator = "─".repeat(W);
    const lines = [
      `Beste ${m.person_name},`,
      ``,
      `Jouw aandeel in de jaarafrekening ${year}:`,
      ...(sections.length > 0 ? [``, sections.join("\n\n")] : []),
      separator,
      row(`Saldo`, s1 >= 0 ? "+" : "−", Math.abs(s1), W),
      ``,
      ...(s1 < 0
        ? [`Gelieve dit bedrag over te schrijven naar ${iban}.`]
        : s1 > 0
          ? [`Dit bedrag wordt aan jou teruggestort.`]
          : []),
      ``,
      `Je overzicht: ${typeof window !== "undefined" ? window.location.origin : ""}`,
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const toggle = () => setOpen((v) => !v);

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${paper.ink}`,
      }}
    >
      {/* Header row: name | flex spacer | amount | [stuur bericht] */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 14px",
          gap: 10,
        }}
      >
        <button
          onClick={toggle}
          style={{
            fontFamily: fontSerif,
            fontSize: 16,
            fontWeight: 700,
            color: paper.ink,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            flex: "1 1 auto",
          }}
        >
          {m.person_name}
        </button>

        <span
          style={{
            fontFamily: fontMono,
            fontSize: 15,
            fontWeight: 700,
            color: netColor,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            cursor: "pointer",
          }}
          onClick={toggle}
        >
          {s1 > 0 ? "+" : ""}
          {fmtMoney(s1)}
        </span>

        <button
          onClick={copyMsg}
          style={{
            padding: "2px 10px",
            fontFamily: fontMono,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: msgCopied ? paper.green : "transparent",
            color: msgCopied ? paper.paper : paper.inkMute,
            border: `1px solid ${msgCopied ? paper.green : paper.paperDark}`,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          {msgCopied ? t("settlement.copied") : t("settlement.send_transfer")}
        </button>
      </div>

      {/* Expanded breakdown */}
      {open && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, padding: "10px 14px 14px" }}>
          {/* Ritten */}
          <BreakdownSection
            label={t("page.trips")}
            totalRight={`${totalKm} km`}
            amount={totalTripAmt > 0 ? `− ${fmtMoney(totalTripAmt)}` : fmtMoney(0)}
            amountColor={totalTripAmt > 0 ? paper.accent : paper.inkMute}
          >
            {m.car_eras
              .filter((e) => e.trip_km > 0)
              .map((era, i) => (
                <BreakdownCarRow
                  key={i}
                  car={era.car_short}
                  detail={`${era.trip_km} km`}
                  amount={`− ${fmtMoney(era.trip_amount)}`}
                  amountColor={paper.accent}
                />
              ))}
          </BreakdownSection>

          {/* Brandstof */}
          <BreakdownSection
            label={t("settlement.breakdown_fuel")}
            totalRight={`${fmtL(totalFuelL)} L`}
            amount={totalFuelAmt > 0 ? `+ ${fmtMoney(totalFuelAmt)}` : fmtMoney(0)}
            amountColor={totalFuelAmt > 0 ? paper.green : paper.inkMute}
          >
            {m.car_eras
              .filter((e) => e.fuel_liters > 0)
              .map((era, i) => {
                const star = (era.fuel_settled_liters ?? 0) > 0.05 ? "(*)" : "";
                return (
                  <BreakdownCarRow
                    key={i}
                    car={era.car_short}
                    detail={`${fmtL(era.fuel_liters)} L${star}`}
                    amount={`+ ${fmtMoney(era.fuel_amount)}`}
                    amountColor={paper.green}
                  />
                );
              })}
            <SettledNote
              fuelCount={m.car_eras.reduce((s, e) => s + (e.fuel_settled_count ?? 0), 0)}
              fuelLiters={m.car_eras.reduce((s, e) => s + (e.fuel_settled_liters ?? 0), 0)}
              expCount={0}
              expAmt={0}
            />
          </BreakdownSection>

          {/* Kosten */}
          <BreakdownSection
            label={t("settlement.breakdown_costs")}
            totalRight={null}
            amount={totalExpAmt > 0 ? `+ ${fmtMoney(totalExpAmt)}` : fmtMoney(0)}
            amountColor={totalExpAmt > 0 ? paper.green : paper.inkMute}
          >
            {m.car_eras
              .filter((e) => e.expense_amount > 0)
              .map((era, i) => {
                const star = (era.expense_settled_amount ?? 0) > 0.005 ? "(*)" : "";
                return (
                  <BreakdownCarRow
                    key={i}
                    car={`${era.car_short}${star}`}
                    detail={null}
                    amount={`+ ${fmtMoney(era.expense_amount)}`}
                    amountColor={paper.green}
                  />
                );
              })}
            <SettledNote
              fuelCount={0}
              fuelLiters={0}
              expCount={m.car_eras.reduce((s, e) => s + (e.expense_settled_count ?? 0), 0)}
              expAmt={m.car_eras.reduce((s, e) => s + (e.expense_settled_amount ?? 0), 0)}
            />
          </BreakdownSection>

          {/* Saldo */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 10,
              paddingTop: 8,
              borderTop: `1px dashed ${paper.paperDark}`,
            }}
          >
            <span
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: paper.inkDim,
                fontWeight: 700,
              }}
            >
              Saldo
            </span>
            <span style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: netColor }}>
              {s1 > 0 ? "+" : ""}
              {fmtMoney(s1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerMemberCard({
  m,
  year,
  bankAccount,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const s2 = m.s2 ?? 0;
  const s2Color = s2 > 0 ? paper.green : s2 < 0 ? paper.accent : paper.inkMute;

  const copyMsg = () => {
    const iban =
      bankAccount || "(rekeningnummer niet ingesteld — stel in via Admin → Instellingen)";
    const W = 40;
    const e = (n: number) => `€ ${n.toFixed(2).replace(".", ",").padStart(6)}`;
    const row = (left: string, sign: "+" | "−", n: number) => {
      const right = `${sign} ${e(n)}`;
      return left + " ".repeat(Math.max(1, W - left.length - right.length)) + right;
    };

    const carSections: string[] = [];
    for (const era of m.car_eras) {
      const nStar = era.n_c_star ?? 0;
      const contribs = era.member_contributions ?? [];
      if (Math.abs(nStar) < 0.005 && contribs.length === 0) continue;
      const lines: string[] = [
        row(`${era.car_short} — ${era.car_name}`, nStar >= 0 ? "+" : "−", Math.abs(nStar)),
      ];
      for (const c of contribs) {
        const km = c.trip_km > 0 ? ` (${c.trip_km} km)` : "";
        lines.push(
          row(`  ${c.person_name}${km}`, c.contribution >= 0 ? "+" : "−", Math.abs(c.contribution))
        );
      }
      carSections.push(lines.join("\n"));
    }

    const separator = "─".repeat(W);
    const lines = [
      `Beste ${m.person_name},`,
      ``,
      `Jouw eigenaarspayout voor ${year}:`,
      ...(carSections.length > 0 ? [``, carSections.join("\n\n")] : []),
      separator,
      row(`Saldo via coöp`, s2 >= 0 ? "+" : "−", Math.abs(s2)),
      ``,
      ...(s2 > 0
        ? [`Coöp (${iban}) schrijft dit bedrag over naar jou.`]
        : s2 < 0
          ? [`Gelieve dit bedrag over te schrijven naar ${iban}.`]
          : []),
      ``,
      `Je overzicht: ${typeof window !== "undefined" ? window.location.origin : ""}`,
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const toggle = () => setOpen((v) => !v);

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${paper.blue}`,
      }}
    >
      {/* Header: same layout as NonOwnerMemberCard */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10 }}>
        <button
          onClick={toggle}
          style={{
            fontFamily: fontSerif,
            fontSize: 16,
            fontWeight: 700,
            color: paper.ink,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            flex: "1 1 auto",
          }}
        >
          {m.person_name}
        </button>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 15,
            fontWeight: 700,
            color: s2Color,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            cursor: "pointer",
          }}
          onClick={toggle}
        >
          {s2 > 0 ? "+" : ""}
          {fmtMoney(s2)}
        </span>
        <button
          onClick={copyMsg}
          style={{
            padding: "2px 10px",
            fontFamily: fontMono,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            background: msgCopied ? paper.green : "transparent",
            color: msgCopied ? paper.paper : paper.inkMute,
            border: `1px solid ${msgCopied ? paper.green : paper.paperDark}`,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          }}
        >
          {msgCopied ? t("settlement.copied") : t("settlement.send_transfer")}
        </button>
      </div>

      {open && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, padding: "10px 14px 14px" }}>
          {/* ── Bijdrage van Leden ── */}
          <SectionLabel>{t("settlement.section_member_contributions")}</SectionLabel>

          {m.car_eras.map((era, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    color: paper.inkDim,
                    letterSpacing: 1,
                  }}
                >
                  {era.car_short} — {era.car_name}
                </span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 11,
                    fontWeight: 600,
                    color: (era.n_c_star ?? 0) >= 0 ? paper.green : paper.accent,
                    paddingLeft: 12,
                  }}
                >
                  {fmtMoney(era.n_c_star ?? 0)}
                </span>
              </div>
              {era.member_contributions?.map((contrib, j) => {
                const detail = fmtDetail(
                  contrib.trip_km,
                  contrib.fuel_liters,
                  contrib.expense_amount,
                  contrib.fuel_settled_liters,
                  contrib.expense_settled_amount
                );
                return (
                  <div
                    key={j}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      paddingLeft: 16,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>
                      {contrib.person_name}
                      {detail ? ` ${detail}` : ""}
                    </span>
                    <span
                      style={{
                        fontFamily: fontMono,
                        fontSize: 10,
                        color: contrib.contribution > 0 ? paper.green : paper.accent,
                        paddingLeft: 12,
                      }}
                    >
                      {contrib.contribution > 0 ? "+" : "−"}{" "}
                      {fmtMoney(Math.abs(contrib.contribution))}
                    </span>
                  </div>
                );
              })}
              <SettledNote
                fuelCount={
                  era.member_contributions?.reduce((s, c) => s + (c.fuel_settled_count ?? 0), 0) ??
                  0
                }
                fuelLiters={
                  era.member_contributions?.reduce((s, c) => s + (c.fuel_settled_liters ?? 0), 0) ??
                  0
                }
                expCount={
                  era.member_contributions?.reduce(
                    (s, c) => s + (c.expense_settled_count ?? 0),
                    0
                  ) ?? 0
                }
                expAmt={
                  era.member_contributions?.reduce(
                    (s, c) => s + (c.expense_settled_amount ?? 0),
                    0
                  ) ?? 0
                }
              />
            </div>
          ))}

          {/* ── Via coöp + Saldo ── */}
          <div style={{ borderTop: `1px dashed ${paper.paperDark}`, paddingTop: 10, marginTop: 2 }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
            >
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase" as const,
                  fontWeight: 700,
                  color: paper.inkMute,
                }}
              >
                Saldo via coöp
              </span>
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: s2Color,
                  paddingLeft: 12,
                }}
              >
                {s2 > 0 ? "+" : ""}
                {fmtMoney(s2)}
              </span>
            </div>
            {bankAccount && (
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkMute,
                  marginTop: 4,
                  paddingLeft: 16,
                }}
              >
                coöp ({bankAccount}) → {m.person_name}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CrossOwnerCard({ m }: { m: MemberStatement }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const totalMyBalance = m.cross_owner_balances?.reduce((s, b) => s + b.my_balance, 0) ?? 0;
  const balColor =
    totalMyBalance > 0 ? paper.green : totalMyBalance < 0 ? paper.accent : paper.inkMute;

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${paper.blue}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            fontFamily: fontSerif,
            fontSize: 16,
            fontWeight: 700,
            color: paper.ink,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            flex: "1 1 auto",
          }}
        >
          {m.person_name}
        </button>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 15,
            fontWeight: 700,
            color: balColor,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            cursor: "pointer",
          }}
          onClick={() => setOpen((v) => !v)}
        >
          {totalMyBalance > 0 ? "+" : "−"}
          {fmtMoney(totalMyBalance)}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, padding: "10px 14px 14px" }}>
          <SectionLabel>{t("settlement.section_cross_use")}</SectionLabel>
          {m.cross_owner_balances?.map((b, j) => {
            const detail = fmtDetail(
              b.my_trip_km,
              b.my_fuel_liters,
              b.my_expense_amount,
              b.my_fuel_settled_liters,
              b.my_expense_settled_amount
            );
            const bColor =
              b.my_balance > 0 ? paper.green : b.my_balance < 0 ? paper.accent : paper.inkMute;
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  paddingLeft: 16,
                  marginTop: 2,
                }}
              >
                <span style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>
                  {b.other_owner_name}
                  {detail ? ` ${detail}` : ""}
                </span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    color: bColor,
                    paddingLeft: 12,
                  }}
                >
                  {b.my_balance > 0 ? "+" : "−"} {fmtMoney(Math.abs(b.my_balance))}
                </span>
              </div>
            );
          })}
          <SettledNote
            fuelCount={
              m.cross_owner_balances?.reduce((s, b) => s + (b.my_fuel_settled_count ?? 0), 0) ?? 0
            }
            fuelLiters={
              m.cross_owner_balances?.reduce((s, b) => s + (b.my_fuel_settled_liters ?? 0), 0) ?? 0
            }
            expCount={
              m.cross_owner_balances?.reduce((s, b) => s + (b.my_expense_settled_count ?? 0), 0) ??
              0
            }
            expAmt={
              m.cross_owner_balances?.reduce((s, b) => s + (b.my_expense_settled_amount ?? 0), 0) ??
              0
            }
          />
        </div>
      )}
    </div>
  );
}

function generateSettlementMd(data: import("@/types").SettlementResult, year: number): string {
  const fmt = (n: number) =>
    n.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (n: number) => (n >= 0 ? `+€ ${fmt(n)}` : `−€ ${fmt(Math.abs(n))}`);

  const lines: string[] = [];
  lines.push(`# Afrekening ${year}`);
  if (data.frozen) {
    lines.push(`\n> ✓ Bevroren${data.settled_by ? ` door ${data.settled_by}` : ""}${data.settled_at ? ` op ${data.settled_at.slice(0, 10)}` : ""}`);
  }

  const nonOwners = data.members.filter((m) => !m.is_owner);
  const owners = data.members.filter((m) => m.is_owner);
  const step1Total = Math.round(nonOwners.reduce((s, m) => s + (m.s1 ?? 0), 0) * 100) / 100;
  const step2Total = Math.round(owners.reduce((s, m) => s + (m.s2 ?? 0), 0) * 100) / 100;

  // Step 1
  lines.push(`\n## Stap 1 — Leden → Coöp  (${sign(step1Total)})\n`);
  for (const m of [...nonOwners].sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))) {
    lines.push(`### ${m.person_name}  ${sign(m.s1 ?? 0)}`);
    for (const e of m.car_eras) {
      lines.push(`- **${e.car_name}** (${e.owner_name})`);
      lines.push(`  - Ritten: ${e.trip_km} km · € ${fmt(e.trip_amount)}`);
      if (e.fuel_amount) lines.push(`  - Brandstof: ${fmtL(e.fuel_liters)} L · € ${fmt(e.fuel_amount)}`);
      if (e.expense_amount) lines.push(`  - Kosten: € ${fmt(e.expense_amount)}`);
      lines.push(`  - Saldo: ${sign(e.balance)}`);
    }
  }

  // Step 2
  lines.push(`\n## Stap 2 — Coöp → Eigenaars  (${sign(step2Total)})\n`);
  for (const m of [...owners].sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))) {
    lines.push(`### ${m.person_name}  ${sign(m.s2 ?? 0)}`);
    for (const e of m.car_eras) {
      const nLabel = e.n_c_star != null ? sign(e.n_c_star) : sign(e.balance);
      lines.push(`- **${e.car_short} — ${e.car_name}**  ${nLabel}`);
      if (e.member_contributions && e.member_contributions.length > 0) {
        for (const c of e.member_contributions) {
          const parts: string[] = [`+${c.trip_km} km`];
          if (c.fuel_liters > 0) parts.push(`-${fmtL(c.fuel_liters)} L`);
          if (c.expense_amount > 0) parts.push(`-€ ${fmt(c.expense_amount)}`);
          const contribSign = c.contribution >= 0 ? `+€ ${fmt(c.contribution)}` : `−€ ${fmt(Math.abs(c.contribution))}`;
          lines.push(`  - ${c.person_name} (${parts.join(", ")}): ${contribSign}`);
        }
      }
    }
    lines.push(`- **Saldo via coöp: ${sign(m.s2 ?? 0)}**`);
  }

  // Step 3
  const step3 = data.transfers.filter((tr) => tr.step === 3);
  const crossOwners = owners.filter((m) => m.cross_owner_balances && m.cross_owner_balances.length > 0);
  if (step3.length > 0 || crossOwners.length > 0) {
    lines.push(`\n## Stap 3 — Tussen eigenaars\n`);
    for (const m of [...crossOwners].sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))) {
      const xTotal = m.cross_owner_balances!.reduce((s, b) => s + b.my_balance, 0);
      lines.push(`### ${m.person_name}  ${sign(xTotal)}`);
      lines.push(`_Mijn gebruik van andere wagens_`);
      for (const b of m.cross_owner_balances!) {
        const parts: string[] = [`+${b.my_trip_km} km`];
        if (b.my_fuel_liters > 0) parts.push(`-${fmtL(b.my_fuel_liters)} L`);
        if (b.my_expense_amount > 0) parts.push(`-€ ${fmt(b.my_expense_amount)}`);
        const balSign = b.my_balance >= 0 ? `+€ ${fmt(b.my_balance)}` : `−€ ${fmt(Math.abs(b.my_balance))}`;
        lines.push(`- ${b.other_owner_name} (${parts.join(", ")}): ${balSign}`);
      }
    }
    if (step3.length > 0) {
      lines.push(`\n**Betaling:**`);
      for (const tr of step3) {
        lines.push(`- ${tr.from} → ${tr.to}: € ${fmt(tr.amount)}`);
      }
    }
  }

  // Transfers summary
  lines.push(`\n## Betalingsoverzicht\n`);
  for (const tr of data.transfers) {
    lines.push(`- **Stap ${tr.step}** ${tr.from} → ${tr.to}: € ${fmt(tr.amount)}`);
  }

  return lines.join("\n");
}

export default function AdminSettlementPage() {
  const t = useT();
  const { data: me } = useMe();
  const { data: settings } = useAdminSettings();
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
          {(() => {
            const nonOwnerMembers = data.members.filter((m) => !m.is_owner);
            const ownerMembers = data.members.filter((m) => m.is_owner);
            const crossOwnerMembers = ownerMembers.filter((m) => Math.abs(m.x ?? 0) > 0.005);
            const step1Total =
              Math.round(nonOwnerMembers.reduce((s, m) => s + (m.s1 ?? 0), 0) * 100) / 100;
            const step2Total =
              Math.round(ownerMembers.reduce((s, m) => s + (m.s2 ?? 0), 0) * 100) / 100;
            const step1Color =
              step1Total < 0 ? paper.accent : step1Total > 0 ? paper.green : paper.inkMute;
            const step2Color =
              step2Total > 0 ? paper.green : step2Total < 0 ? paper.accent : paper.inkMute;
            return (
              <>
                {/* Stap 1 — non-owner member cards */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <SectionLabel style={{ marginBottom: 0 }}>
                    {t("settlement.step1_title")}
                  </SectionLabel>
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 11,
                      fontWeight: 700,
                      color: step1Color,
                    }}
                  >
                    {step1Total >= 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(step1Total))}
                  </span>
                </div>
                {nonOwnerMembers
                  .sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))
                  .map((m) => (
                    <NonOwnerMemberCard
                      key={m.person_id}
                      m={m}
                      year={year}
                      bankAccount={settings?.coop_bank_account ?? ""}
                    />
                  ))}

                {/* Stap 2 — owner cards */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    marginTop: 20,
                  }}
                >
                  <SectionLabel style={{ marginBottom: 0 }}>
                    {t("settlement.step2_title")}
                  </SectionLabel>
                  <span
                    style={{
                      fontFamily: fontMono,
                      fontSize: 11,
                      fontWeight: 700,
                      color: step2Color,
                    }}
                  >
                    {step2Total >= 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(step2Total))}
                  </span>
                </div>
                {ownerMembers
                  .sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))
                  .map((m) => (
                    <OwnerMemberCard
                      key={m.person_id}
                      m={m}
                      year={year}
                      bankAccount={settings?.coop_bank_account ?? ""}
                    />
                  ))}

                {/* Balance bar between Stap 2 and Stap 3 */}
                {(() => {
                  const balance = Math.round((step1Total + step2Total) * 100) / 100;
                  return (
                    <div
                      style={{
                        marginTop: 16,
                        padding: "9px 14px",
                        background: data.verify_ok ? paper.green : paper.accent,
                        color: paper.paper,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          marginRight: 4,
                        }}
                      >
                        {data.verify_ok ? "✓" : "⚠"}
                      </span>
                      <span
                        style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 0.5, flex: 1 }}
                      >
                        Leden → Coöp: {fmtMoney(Math.abs(step1Total))}
                        {"   ·   "}
                        Coöp → Eigenaars: {fmtMoney(Math.abs(step2Total))}
                      </span>
                      <span
                        style={{
                          fontFamily: fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}
                      >
                        Saldo: {fmtMoney(balance)}
                      </span>
                    </div>
                  );
                })()}

                {/* Stap 3 — cross-owner cards */}
                {crossOwnerMembers.length > 0 && (
                  <>
                    <SectionLabel style={{ marginTop: 20 }}>
                      {t("settlement.step3_title")}
                    </SectionLabel>
                    {crossOwnerMembers
                      .sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))
                      .map((m) => (
                        <CrossOwnerCard key={m.person_id} m={m} />
                      ))}
                  </>
                )}

                {/* Inter-owner transfer bar */}
                {(() => {
                  const step3 = data.transfers.filter((tr) => tr.step === 3);
                  if (step3.length === 0) return null;
                  return (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "9px 14px",
                        background: paper.green,
                        color: paper.paper,
                      }}
                    >
                      {step3.map((tr, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 0.5 }}>
                            {tr.from} → {tr.to}
                          </span>
                          <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 700 }}>
                            {fmtMoney(tr.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            );
          })()}

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
