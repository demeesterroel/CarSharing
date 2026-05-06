"use client";
import { useState, Suspense } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { paper, fontMono, fontSerif, fmtMoney, amtColor, signPrefix } from "@/lib/paper-theme";
import { useT } from "@/components/locale-provider";
import { useEarliestDashboardYear } from "@/hooks/use-dashboard";
import { useSettlement } from "@/hooks/use-settlement";
import { useMe } from "@/hooks/use-me";
import { useAdminSettings } from "@/hooks/use-admin-settings";
import { apiFetch } from "@/lib/api/client";
import { Card, Row, Perf } from "../_shared";
import type { MemberStatement, AnnotatedTransfer } from "@/types";

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
      {parts.join(" en ")} {t("settlement.settled_outside_note")}
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

function TransferPaymentRow({ transfer }: { transfer: AnnotatedTransfer }) {
  const t = useT();
  const ps = transfer.payment_status;
  if (!ps) return null; // co-op is the payer, no tracking

  const pct = transfer.amount > 0 ? Math.max(0, Math.min(1, ps.paid / transfer.amount)) : 1;
  const barFilled = Math.round(pct * 10);
  const statusColor = ps.open < 0.005 ? paper.green : ps.paid > 0.005 ? paper.blue : paper.accent;
  const statusLabel =
    ps.open < 0.005
      ? t("settlement.fully_paid")
      : ps.paid > 0.005
        ? t("settlement.partially_paid")
        : t("settlement.unpaid");

  return (
    <div
      style={{
        padding: "6px 14px 10px",
        borderTop: `1px dashed ${paper.paperDark}`,
        background: paper.paperDeep,
      }}
    >
      {/* Row 1: Te betalen | Openstaand */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        <span>
          {t("settlement.payment_due")}: {fmtMoney(transfer.amount)}
        </span>
        <span style={{ color: ps.open > 0.005 ? paper.accent : paper.inkMute }}>
          {t("settlement.payment_open")}: {fmtMoney(ps.open)}
        </span>
      </div>
      {/* Row 2: Betaald | progress bar | status label */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        <span>
          {t("settlement.payment_paid")}: {fmtMoney(ps.paid)}
        </span>
        <span style={{ color: statusColor, letterSpacing: 2 }}>
          {"●".repeat(barFilled)}
          {"○".repeat(10 - barFilled)} {Math.round(pct * 100)}%
        </span>
        <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
      </div>
      {/* Individual payments with dates */}
      {ps.payments.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {ps.payments.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 90px 1fr",
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkMute,
                letterSpacing: 0.5,
              }}
            >
              <span />
              <span>{p.date}</span>
              <span>{fmtMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentSummaryBanner({
  data,
}: {
  data: { all_paid: boolean; transfers: AnnotatedTransfer[] };
}) {
  const t = useT();
  const outstanding = data.transfers.filter(
    (tr) => tr.payment_status !== null && (tr.payment_status?.open ?? 0) > 0.005
  );
  const count = outstanding.length;
  const isAllPaid = data.all_paid;

  if (data.transfers.filter((tr) => tr.payment_status !== null).length === 0) return null;

  return (
    <div
      style={{
        padding: "10px 14px",
        background: isAllPaid ? paper.green : paper.accent,
        color: paper.paper,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700 }}>
        {isAllPaid ? "✓" : "!"}
      </span>
      <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 0.5 }}>
        {isAllPaid
          ? t("settlement.payment_all_paid")
          : t(
              count === 1 ? "settlement.payment_outstanding_one" : "settlement.payment_outstanding",
              { count }
            )}
      </span>
    </div>
  );
}

function NonOwnerMemberCard({
  m,
  year,
  bankAccount,
  settlementTransfer,
  showAll,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  settlementTransfer: AnnotatedTransfer | undefined;
  showAll: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  const s1 = m.s1 ?? 0;
  const netColor = amtColor(-s1);

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
      const sec = [
        row(`${t("settlement.breakdown_fuel")} (${fmtL(totalFuelL)} L)`, "+", totalFuelAmt, W),
      ];
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

  const ps = settlementTransfer?.payment_status ?? null;
  const hasCreditTransfer = settlementTransfer != null && settlementTransfer.from === "co-op";
  const borderColor = hasCreditTransfer
    ? (ps != null && ps.open < 0.005 ? paper.green : paper.blue)
    : ps == null
      ? paper.ink
      : ps.open < 0.005
        ? paper.green
        : paper.accent;
  const isSlim = !showAll && borderColor !== paper.accent && borderColor !== paper.blue;

  const toggle = () => setOpen((v) => !v);

  if (isSlim) {
    return (
      <div
        style={{
          background: paper.paper,
          marginBottom: 2,
          borderLeft: `3px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          padding: "3px 14px",
          gap: 8,
        }}
      >
        <span
          style={{ fontFamily: fontSerif, fontSize: 11, color: paper.inkMute, flex: "1 1 auto" }}
        >
          {m.person_name}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: netColor }}>
          {signPrefix(-s1)}
          {fmtMoney(s1)}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${borderColor}`,
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
          {signPrefix(-s1)}
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

      {/* Expanded breakdown — grouped by car */}
      {open && (
        <div style={{ borderTop: `1px dashed ${paper.paperDark}`, padding: "10px 14px 14px" }}>
          {m.car_eras.map((era, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
              {/* Car label */}
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  letterSpacing: 1.5,
                  textTransform: "uppercase" as const,
                  color: paper.inkMute,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {era.car_short}
              </div>
              {era.trip_km > 0 && (
                <BreakdownCarRow
                  car={`${t("page.trips")} (${era.trip_km} km)`}
                  detail={null}
                  amount={`− ${fmtMoney(era.trip_amount)}`}
                  amountColor={paper.accent}
                />
              )}
              {era.fuel_liters > 0 && (
                <BreakdownCarRow
                  car={`${t("settlement.breakdown_fuel")} (${fmtL(era.fuel_liters)} L${(era.fuel_settled_liters ?? 0) > 0.05 ? " (*)" : ""})`}
                  detail={null}
                  amount={`+ ${fmtMoney(era.fuel_amount)}`}
                  amountColor={paper.green}
                />
              )}
              {era.expense_amount > 0 && (
                <BreakdownCarRow
                  car={`${t("settlement.breakdown_costs")}${(era.expense_settled_amount ?? 0) > 0.005 ? " (*)" : ""}`}
                  detail={null}
                  amount={`+ ${fmtMoney(era.expense_amount)}`}
                  amountColor={paper.green}
                />
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 4,
                  paddingLeft: 16,
                }}
              >
                <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim }}>
                  saldo
                </span>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    fontWeight: 600,
                    color: amtColor(era.balance),
                  }}
                >
                  {signPrefix(era.balance)}
                  {fmtMoney(era.balance)}
                </span>
              </div>
              <SettledNote
                fuelCount={era.fuel_settled_count ?? 0}
                fuelLiters={era.fuel_settled_liters ?? 0}
                expCount={era.expense_settled_count ?? 0}
                expAmt={era.expense_settled_amount ?? 0}
              />
            </div>
          ))}

          {/* Total saldo */}
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
                textTransform: "uppercase" as const,
                color: paper.inkDim,
                fontWeight: 700,
              }}
            >
              Saldo
            </span>
            <span style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 700, color: netColor }}>
              {signPrefix(-s1)}
              {fmtMoney(s1)}
            </span>
          </div>

          {/* Payment status */}
          {settlementTransfer && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontFamily: fontMono,
                  fontSize: 9,
                  color: paper.inkDim,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {t("settlement.payment_status_title")}
              </div>
              <TransferPaymentRow transfer={settlementTransfer} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OwnerMemberCard({
  m,
  year,
  bankAccount,
  crossRows,
  settlementTransfer,
  showAll,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  crossRows: { car_short: string; row: import("@/types").CarParticipantRow }[];
  settlementTransfer: AnnotatedTransfer | undefined;
  showAll: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const s2 = m.s2 ?? 0;
  const s1c = m.s1_cross ?? 0;
  const net = m.net ?? s2;
  const netColor = amtColor(-net);
  const hasCrossUse = crossRows.length > 0;

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

    const crossSection: string[] = [];
    if (hasCrossUse) {
      crossSection.push(`\nGebruik andere wagens:`);
      for (const { car_short, row: r } of crossRows) {
        const parts: string[] = [];
        if (r.trip_km > 0) parts.push(`${r.trip_km} km`);
        if (r.fuel_liters > 0.05) parts.push(`${fmtL(r.fuel_liters)} L`);
        crossSection.push(
          row(
            `  ${car_short}${parts.length ? ` (${parts.join(", ")})` : ""}`,
            r.balance <= 0 ? "+" : "−",
            Math.abs(r.balance)
          )
        );
      }
    }

    const separator = "─".repeat(W);
    const lines = [
      `Beste ${m.person_name},`,
      ``,
      `Jouw eigenaarspayout voor ${year}:`,
      ...(carSections.length > 0 ? [``, carSections.join("\n\n")] : []),
      ...crossSection,
      ``,
      separator,
      row(hasCrossUse ? `Netto saldo` : `Saldo via coöp`, net >= 0 ? "+" : "−", Math.abs(net)),
      ``,
      ...(net > 0
        ? [`Coöp (${iban}) schrijft dit bedrag over naar jou.`]
        : net < 0
          ? [`Gelieve dit bedrag over te schrijven naar ${iban}.`]
          : []),
      ``,
      `Je overzicht: ${typeof window !== "undefined" ? window.location.origin : ""}`,
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

  const ps = settlementTransfer?.payment_status ?? null;
  const borderColor =
    ps == null
      ? settlementTransfer != null
        ? paper.blue
        : paper.ink
      : ps.open < 0.005
        ? paper.green
        : paper.accent;
  const isSlim = !showAll && borderColor !== paper.accent && borderColor !== paper.blue;

  const toggle = () => setOpen((v) => !v);

  if (isSlim) {
    return (
      <div
        style={{
          background: paper.paper,
          marginBottom: 2,
          borderLeft: `3px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          padding: "3px 14px",
          gap: 8,
        }}
      >
        <span
          style={{ fontFamily: fontSerif, fontSize: 11, color: paper.inkMute, flex: "1 1 auto" }}
        >
          {m.person_name}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: netColor }}>
          {signPrefix(-net)}
          {fmtMoney(net)}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: paper.paper,
        marginBottom: 6,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
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
            color: netColor,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            cursor: "pointer",
          }}
          onClick={toggle}
        >
          {signPrefix(-net)}
          {fmtMoney(net)}
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
                    color: amtColor(era.n_c_star ?? 0),
                    paddingLeft: 12,
                  }}
                >
                  {signPrefix(era.n_c_star ?? 0)}
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
                        color: amtColor(contrib.contribution),
                        paddingLeft: 12,
                      }}
                    >
                      {signPrefix(contrib.contribution)}
                      {fmtMoney(contrib.contribution)}
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

          {/* ── Gebruik andere wagens (cross-owner) ── */}
          {hasCrossUse && (
            <div
              style={{ borderTop: `1px dashed ${paper.paperDark}`, paddingTop: 10, marginTop: 2 }}
            >
              <SectionLabel>{t("settlement.section_cross_use")}</SectionLabel>
              {crossRows.map((item, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : 10 }}>
                  <div
                    style={{
                      fontFamily: fontMono,
                      fontSize: 9,
                      letterSpacing: 1.5,
                      textTransform: "uppercase" as const,
                      color: paper.inkMute,
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    {item.car_short}
                  </div>
                  {item.row.trip_km > 0 && (
                    <BreakdownCarRow
                      car={`ritten (${item.row.trip_km} km)`}
                      detail={null}
                      amount={`− ${fmtMoney(item.row.trip_amount)}`}
                      amountColor={paper.accent}
                    />
                  )}
                  {item.row.fuel_liters > 0 && (
                    <BreakdownCarRow
                      car={`brandstof (${fmtL(item.row.fuel_liters)} L)`}
                      detail={null}
                      amount={`+ ${fmtMoney(item.row.fuel_amount)}`}
                      amountColor={paper.green}
                    />
                  )}
                  {item.row.expense_amount > 0 && (
                    <BreakdownCarRow
                      car="kosten"
                      detail={null}
                      amount={`+ ${fmtMoney(item.row.expense_amount)}`}
                      amountColor={paper.green}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginTop: 4,
                      paddingLeft: 16,
                    }}
                  >
                    <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim }}>
                      saldo
                    </span>
                    <span
                      style={{
                        fontFamily: fontMono,
                        fontSize: 10,
                        fontWeight: 600,
                        color: amtColor(-item.row.balance),
                      }}
                    >
                      {signPrefix(-item.row.balance)}
                      {fmtMoney(item.row.balance)}
                    </span>
                  </div>
                  <SettledNote
                    fuelCount={item.row.fuel_settled_count}
                    fuelLiters={item.row.fuel_settled_liters}
                    expCount={item.row.expense_settled_count}
                    expAmt={item.row.expense_settled_amount}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Netto saldo ── */}
          <div
            style={{
              borderTop: `1px dashed ${paper.paperDark}`,
              paddingTop: 10,
              marginTop: hasCrossUse ? 10 : 2,
            }}
          >
            {hasCrossUse && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim }}>
                  via coöp
                </span>
                <span style={{ fontFamily: fontMono, fontSize: 10, color: amtColor(s2) }}>
                  {signPrefix(s2)}
                  {fmtMoney(s2)}
                </span>
              </div>
            )}
            {hasCrossUse && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim }}>
                  gebruik andere wagens
                </span>
                <span style={{ fontFamily: fontMono, fontSize: 10, color: amtColor(s1c) }}>
                  {signPrefix(s1c)}
                  {fmtMoney(s1c)}
                </span>
              </div>
            )}
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
                {hasCrossUse ? "Netto" : "Saldo via coöp"}
              </span>
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: netColor,
                  paddingLeft: 12,
                }}
              >
                {signPrefix(net)}
                {fmtMoney(net)}
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

            {/* Payment status */}
            {settlementTransfer && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    fontFamily: fontMono,
                    fontSize: 9,
                    color: paper.inkDim,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {t("settlement.payment_status_title")}
                </div>
                <TransferPaymentRow transfer={settlementTransfer} />
              </div>
            )}
          </div>
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
    lines.push(
      `\n> ✓ Bevroren${data.settled_by ? ` door ${data.settled_by}` : ""}${data.settled_at ? ` op ${data.settled_at.slice(0, 10)}` : ""}`
    );
  }

  const nonOwners = data.members.filter((m) => !m.is_owner);
  const owners = data.members.filter((m) => m.is_owner);
  const step1Total = Math.round(nonOwners.reduce((s, m) => s + (m.s1 ?? 0), 0) * 100) / 100;
  const step2Total = Math.round(owners.reduce((s, m) => s + (m.net ?? m.s2 ?? 0), 0) * 100) / 100;

  // Step 1 — non-owners only
  lines.push(`\n## Stap 1 — Leden → Coöp  (${sign(step1Total)})\n`);
  for (const m of [...nonOwners].sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))) {
    lines.push(`### ${m.person_name}  ${sign(m.s1 ?? 0)}`);
    for (const e of m.car_eras) {
      lines.push(`- **${e.car_name}** (${e.owner_name})`);
      lines.push(`  - Ritten: ${e.trip_km} km · € ${fmt(e.trip_amount)}`);
      if (e.fuel_amount)
        lines.push(`  - Brandstof: ${fmtL(e.fuel_liters)} L · € ${fmt(e.fuel_amount)}`);
      if (e.expense_amount) lines.push(`  - Kosten: € ${fmt(e.expense_amount)}`);
      lines.push(`  - Saldo: ${sign(e.balance)}`);
    }
  }

  // Step 2 — owners (net = s2 + s1_cross)
  lines.push(`\n## Stap 2 — Coöp → Eigenaars  (${sign(step2Total)})\n`);
  for (const m of [...owners].sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))) {
    const net = m.net ?? m.s2 ?? 0;
    const s1c = m.s1_cross ?? 0;
    const hasCross = Math.abs(s1c) > 0.005;
    lines.push(`### ${m.person_name}  ${sign(net)}`);
    lines.push(`\n#### Bijdrage van Leden\n`);
    for (const e of m.car_eras) {
      const nLabel = e.n_c_star != null ? sign(e.n_c_star) : sign(e.balance);
      lines.push(`- **${e.car_short} — ${e.car_name}**  ${nLabel}`);
      if (e.member_contributions && e.member_contributions.length > 0) {
        for (const c of e.member_contributions) {
          const parts: string[] = [];
          if (c.trip_km > 0) parts.push(`+${c.trip_km} km`);
          if (c.fuel_liters > 0) parts.push(`-${fmtL(c.fuel_liters)} L`);
          if (c.expense_amount > 0) parts.push(`-€ ${fmt(c.expense_amount)}`);
          const contribSign =
            c.contribution >= 0
              ? `+€ ${fmt(c.contribution)}`
              : `−€ ${fmt(Math.abs(c.contribution))}`;
          lines.push(
            `  - ${c.person_name}${parts.length > 0 ? ` (${parts.join(", ")})` : ""}: ${contribSign}`
          );
        }
      }
    }
    lines.push(`- **Via coöp: ${sign(m.s2 ?? 0)}**`);
    if (hasCross) {
      lines.push(`\n#### Gebruik andere wagens\n`);
      for (const cs of data.car_settlements) {
        const row = cs.rows.find(
          (r) => r.row_type === "cross_owner" && r.person_name === m.person_name
        );
        if (!row) continue;
        lines.push(`- **${cs.car_name}** (${cs.owner_name})`);
        if (row.trip_km > 0)
          lines.push(`  - Ritten: ${row.trip_km} km · € ${fmt(row.trip_amount)}`);
        if (row.fuel_liters > 0.05)
          lines.push(`  - Brandstof: ${fmtL(row.fuel_liters)} L · € ${fmt(row.fuel_amount)}`);
        if (row.expense_amount > 0.005) lines.push(`  - Kosten: € ${fmt(row.expense_amount)}`);
        lines.push(`  - Saldo: ${sign(row.balance)}`);
      }
      lines.push(`- **Gebruik andere wagens: ${sign(s1c)}**`);
      lines.push(`- **Netto: ${sign(net)}**`);
    }
  }

  // Transfers summary
  lines.push(`\n## Betalingsoverzicht\n`);
  for (const tr of data.transfers) {
    lines.push(`- **Stap ${tr.step}** ${tr.from} → ${tr.to}: € ${fmt(tr.amount)}`);
  }

  return lines.join("\n");
}

function AdminSettlementPageContent() {
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
    if (newYear === currentYear) p.delete("year");
    else p.set("year", String(newYear));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const [showAll, setShowAll] = useState(false);
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
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <YearPicker
          year={year}
          earliest={earliest}
          current={currentYear}
          onChange={(y) => setYear(y)}
        />
        {data && data.members.length > 0 && (
          <>
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                position: "absolute",
                left: 0,
                fontFamily: fontMono,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                background: "transparent",
                color: paper.inkMute,
                border: `1px solid ${paper.paperDark}`,
                cursor: "pointer",
                padding: "4px 10px",
              }}
            >
              {showAll ? `≡` : `⚠`}
            </button>
            <button
              onClick={handleDownload}
              title="Download als .md"
              style={{
                position: "absolute",
                right: 0,
                padding: "6px 10px",
                background: "transparent",
                border: `1.5px solid ${paper.ink}`,
                color: paper.ink,
                cursor: "pointer",
                fontFamily: fontMono,
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              ↓
            </button>
          </>
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
            const step1Total =
              Math.round(nonOwnerMembers.reduce((s, m) => s + (m.s1 ?? 0), 0) * 100) / 100;
            const step2Total =
              Math.round(ownerMembers.reduce((s, m) => s + (m.net ?? m.s2 ?? 0), 0) * 100) / 100;
            // step1Total is sum of member s1 (member-perspective: negative = they owe)
            // invert to show coop-perspective: coop receives = positive
            const step1Color = amtColor(-step1Total);
            // step2Total is sum of owner net (owner-perspective: positive = they receive)
            // invert to show coop-perspective: coop pays out = negative
            const step2Color = amtColor(-step2Total);
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
                    {step1Total <= 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(step1Total))}
                  </span>
                </div>
                {[...nonOwnerMembers]
                  .sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))
                  .map((m) => (
                    <NonOwnerMemberCard
                      key={m.person_id}
                      m={m}
                      year={year}
                      bankAccount={settings?.coop_bank_account ?? ""}
                      settlementTransfer={data.transfers.find(
                        (tr) =>
                          tr.step === 1 && (tr.from === m.person_name || tr.to === m.person_name)
                      )}
                      showAll={showAll}
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
                    {step2Total <= 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(step2Total))}
                  </span>
                </div>
                {[...ownerMembers]
                  .sort((a, b) => a.person_name.localeCompare(b.person_name, "nl"))
                  .map((m) => (
                    <OwnerMemberCard
                      key={m.person_id}
                      m={m}
                      year={year}
                      bankAccount={settings?.coop_bank_account ?? ""}
                      crossRows={data.car_settlements.flatMap((cs) =>
                        cs.rows
                          .filter(
                            (r) => r.row_type === "cross_owner" && r.person_name === m.person_name
                          )
                          .map((row) => ({ car_short: cs.car_short, row }))
                      )}
                      settlementTransfer={data.transfers.find(
                        (tr) => tr.step === 2 && tr.to === m.person_name
                      )}
                      showAll={showAll}
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
                        style={{
                          fontFamily: fontMono,
                          fontSize: 9,
                          letterSpacing: 0.5,
                          flex: 1,
                          lineHeight: 1.7,
                        }}
                      >
                        <span style={{ display: "block" }}>
                          {t("settlement.balance_members_to_coop", {
                            amount: `${step1Total <= 0 ? "+" : "−"}${fmtMoney(Math.abs(step1Total))}`,
                          })}
                        </span>
                        <span style={{ display: "block" }}>
                          {t("settlement.balance_coop_to_owners", {
                            amount: `${step2Total <= 0 ? "+" : "−"}${fmtMoney(Math.abs(step2Total))}`,
                          })}
                        </span>
                      </span>
                      <span
                        style={{
                          fontFamily: fontMono,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}
                      >
                        {t("settlement.balance_total", { amount: fmtMoney(balance) })}
                      </span>
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {data && <PaymentSummaryBanner data={data} />}

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

export default function AdminSettlementPage() {
  return (
    <Suspense>
      <AdminSettlementPageContent />
    </Suspense>
  );
}
