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
import { usePeople } from "@/hooks/use-people";
import { apiFetch } from "@/lib/api/client";
import { Card, Row, Perf } from "../_shared";
import type { MemberStatement, AnnotatedTransfer } from "@/types";
import { fullNameOf } from "@/lib/person-utils";

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
  const hasFuelSettled = (settledFuelLiters ?? 0) > 0.05;
  const hasExpSettled = (settledExpAmt ?? 0) > 0.005;
  const parts: string[] = [];
  if (km > 0) parts.push(`+${km} km`);
  if (liters > 0.05) {
    const star = hasFuelSettled ? " (*)" : "";
    parts.push(`−${fmtL(liters)} L${star}`);
  }
  if (expAmt > 0.005) {
    const star = hasExpSettled ? (hasFuelSettled ? " (**)" : " (*)") : "";
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
  const expPrefix = fuelHas ? "(**)" : "(*)";
  const noteStyle: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: 8,
    color: paper.inkDim,
    paddingLeft: 16,
    marginTop: 4,
    fontStyle: "italic",
  };
  return (
    <div style={{ marginTop: 6 }}>
      {fuelHas && (
        <div style={noteStyle}>
          {"(*) "}
          {fuelCount} tankbeurt{fuelCount !== 1 ? "en" : ""} ({fmtL(fuelLiters)} L){" "}
          {t("settlement.settled_outside_note")}
        </div>
      )}
      {expHas && (
        <div style={noteStyle}>
          {expPrefix} {expCount} kost{expCount !== 1 ? "en" : ""} ({fmtMoney(expAmt)}){" "}
          {t("settlement.settled_outside_note")}
        </div>
      )}
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
          color: year <= earliest ? paper.inkDim : paper.ink,
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
          color: year >= current ? paper.inkDim : paper.ink,
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
            color: paper.inkDim,
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

  const overpaid = transfer.amount > 0 && ps.paid > transfer.amount + 0.005;
  const pct = transfer.amount > 0 ? Math.max(0, Math.min(1, ps.paid / transfer.amount)) : 1;
  const barFilled = Math.round(pct * 10);
  const statusColor = overpaid
    ? paper.accent
    : ps.open < 0.005
      ? paper.green
      : ps.paid > 0.005
        ? paper.blue
        : paper.accent;
  const statusLabel = overpaid
    ? `+${fmtMoney(ps.paid - transfer.amount)} ${t("settlement.overpaid")}`
    : ps.open < 0.005
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
        <span
          style={{
            color: overpaid ? paper.accent : ps.open > 0.005 ? paper.accent : paper.inkDim,
          }}
        >
          {overpaid
            ? `${t("settlement.payment_open")}: ${fmtMoney(0)}`
            : `${t("settlement.payment_open")}: ${fmtMoney(ps.open)}`}
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
                color: paper.inkDim,
                letterSpacing: 0.5,
              }}
            >
              <span />
              <span>{p.date}</span>
              <span>
                {signPrefix(p.amount)}
                {fmtMoney(p.amount)}
              </span>
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
  const outstanding = data.transfers.filter((tr) => {
    const ps = tr.payment_status;
    if (!ps) return false;
    return Math.abs(ps.paid - tr.amount) > 0.05; // underpaid OR overpaid
  });
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

function CarSectionHeader({ label, saldo }: { label: string; saldo: number }) {
  return (
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
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color: paper.inkDim,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: fontMono,
          fontSize: 10,
          fontWeight: 700,
          color: amtColor(saldo),
          paddingLeft: 12,
        }}
      >
        {signPrefix(saldo)}
        {fmtMoney(saldo)}
      </span>
    </div>
  );
}

function MemberCard({
  m,
  year,
  bankAccount,
  personBankAccount,
  personFullName,
  crossRows,
  settlementTransfer,
  showAll,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  personBankAccount: string;
  personFullName: string;
  crossRows: { car_short: string; row: import("@/types").CarParticipantRow }[];
  settlementTransfer: AnnotatedTransfer | undefined;
  showAll: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  // Unified net: positive = co-op owes person, negative = person owes co-op
  const net = m.is_owner ? (m.net ?? 0) : (m.s1 ?? 0);
  const netColor = amtColor(net);

  const ps = settlementTransfer?.payment_status ?? null;
  const isCredit = net > 0;
  const borderColor =
    settlementTransfer == null
      ? paper.ink
      : ps == null
        ? isCredit
          ? paper.blue
          : paper.accent
        : ps.open < 0.005
          ? paper.green
          : paper.accent;
  const exactMatch =
    settlementTransfer == null ||
    (ps != null && Math.abs(ps.paid - settlementTransfer.amount) < 0.05);
  const isSlim = !showAll && exactMatch;

  const copyMsg = () => {
    const iban =
      bankAccount || "(rekeningnummer niet ingesteld — stel in via Admin → Instellingen)";
    const W = 40;
    const WC = 32;
    const e = (n: number) => `€ ${n.toFixed(2).replace(".", ",").padStart(6)}`;
    const row = (left: string, sign: "+" | "−", n: number, w = W) => {
      const right = `${sign} ${e(n)}`;
      return left + " ".repeat(Math.max(1, w - left.length - right.length)) + right;
    };

    const sections: string[] = [];

    if (m.is_owner) {
      for (const era of m.car_eras) {
        const nStar = era.n_c_star ?? 0;
        const contribs = era.member_contributions ?? [];
        if (Math.abs(nStar) < 0.005 && contribs.length === 0) continue;
        const lines: string[] = [
          row(
            `${t("settlement.section_own_car")} — ${era.car_short}`,
            nStar >= 0 ? "+" : "−",
            Math.abs(nStar)
          ),
        ];
        for (const c of contribs) {
          const detail =
            c.trip_km > 0
              ? ` (${c.trip_km} km${c.fuel_liters > 0.05 ? `, ${fmtL(c.fuel_liters)} L` : ""}${c.expense_amount > 0 ? `, € ${c.expense_amount.toFixed(2).replace(".", ",")}` : ""})`
              : "";
          if (c.contribution === 0) {
            const label = `  ${c.person_name}${detail}`;
            lines.push(label + " ".repeat(Math.max(1, W - label.length - 7)) + `€  0,00`);
          } else {
            lines.push(
              row(
                `  ${c.person_name}${detail}`,
                c.contribution >= 0 ? "+" : "−",
                Math.abs(c.contribution),
                WC
              )
            );
          }
        }
        sections.push(lines.join("\n"));
      }
      if (crossRows.length > 0) {
        const lines: string[] = [];
        for (const { car_short, row: r } of crossRows) {
          const parts: string[] = [];
          if (r.trip_km > 0) parts.push(`${r.trip_km} km`);
          if (r.fuel_liters > 0.05) parts.push(`${fmtL(r.fuel_liters)} L`);
          const saldo = -r.balance;
          lines.push(
            row(
              `${car_short}${parts.length ? ` (${parts.join(", ")})` : ""}`,
              saldo >= 0 ? "+" : "−",
              Math.abs(saldo)
            )
          );
        }
        sections.push(lines.join("\n"));
      }
    } else {
      // Group by car, then type — mirrors the card structure
      for (const era of m.car_eras) {
        if (era.trip_km === 0 && era.fuel_liters === 0 && era.expense_amount === 0) continue;
        const sec = [row(era.car_short, era.balance >= 0 ? "+" : "−", Math.abs(era.balance))];
        if (era.trip_km > 0)
          sec.push(row(`  ${t("page.trips")} (${era.trip_km} km)`, "−", era.trip_amount, WC));
        const hasFuelStar = (era.fuel_settled_liters ?? 0) > 0.05;
        const hasExpStar = (era.expense_settled_amount ?? 0) > 0.005;
        if (era.fuel_liters > 0)
          sec.push(
            row(
              `  ${t("settlement.breakdown_fuel")} (${fmtL(era.fuel_liters)} L)${hasFuelStar ? " (*)" : ""}`,
              "+",
              era.fuel_amount,
              WC
            )
          );
        if (era.expense_amount > 0)
          sec.push(
            row(
              `  ${t("settlement.breakdown_costs")}${hasExpStar ? (hasFuelStar ? " (**)" : " (*)") : ""}`,
              "+",
              era.expense_amount,
              WC
            )
          );
        if (hasFuelStar)
          sec.push(
            `  (*) ${era.fuel_settled_count} tankbeurt${(era.fuel_settled_count ?? 0) !== 1 ? "en" : ""} (${fmtL(era.fuel_settled_liters ?? 0)} L) buiten afrekening`
          );
        if (hasExpStar) {
          const prefix = hasFuelStar ? "(**)" : "(*)";
          sec.push(
            `  ${prefix} ${era.expense_settled_count} kost${(era.expense_settled_count ?? 0) !== 1 ? "en" : ""} buiten afrekening`
          );
        }
        sections.push(sec.join("\n"));
      }
    }

    const separator = "─".repeat(W);
    const lines = [
      "```",
      `Beste ${personFullName},`,
      m.is_owner
        ? `Jouw eigenaarspayout voor ${year}:`
        : `Jouw aandeel in de jaarafrekening ${year}:`,
      ...(sections.length > 0 ? [sections.join("\n")] : []),
      separator,
      row(`Saldo`, net >= 0 ? "+" : "−", Math.abs(net)),
      ``,
      ...(net > 0
        ? [
            personBankAccount
              ? `Coöp schrijft ${e(Math.abs(net))} over naar ${personBankAccount}.`
              : `Coöp schrijft ${e(Math.abs(net))} over naar jou.`,
          ]
        : net < 0
          ? [`Gelieve ${e(Math.abs(net))} over te schrijven naar ${iban}.`]
          : []),
      `Je overzicht: ${typeof window !== "undefined" ? window.location.origin : ""}`,
      "```",
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2000);
  };

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
          style={{ fontFamily: fontSerif, fontSize: 11, color: paper.inkDim, flex: "1 1 auto" }}
        >
          {m.person_name}
        </span>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: netColor }}>
          {signPrefix(net)}
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
          {signPrefix(net)}
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
            color: msgCopied ? paper.paper : paper.inkDim,
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
          {/* Non-owner: per-car breakdown */}
          {!m.is_owner &&
            m.car_eras.map((era, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
                <CarSectionHeader label={era.car_short} saldo={era.balance} />
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
                    car={`${t("settlement.breakdown_costs")}${(era.expense_settled_amount ?? 0) > 0.005 ? ((era.fuel_settled_liters ?? 0) > 0.05 ? " (**)" : " (*)") : ""}`}
                    detail={null}
                    amount={`+ ${fmtMoney(era.expense_amount)}`}
                    amountColor={paper.green}
                  />
                )}
                <SettledNote
                  fuelCount={era.fuel_settled_count ?? 0}
                  fuelLiters={era.fuel_settled_liters ?? 0}
                  expCount={era.expense_settled_count ?? 0}
                  expAmt={era.expense_settled_amount ?? 0}
                />
              </div>
            ))}

          {/* EIGEN WAGEN section — owners only, shown first */}
          {m.is_owner &&
            m.car_eras.map((era, i) => {
              const nStar = era.n_c_star ?? 0;
              const contribs = era.member_contributions ?? [];
              if (Math.abs(nStar) < 0.005 && contribs.length === 0) return null;
              return (
                <div
                  key={i}
                  style={{
                    marginTop: i > 0 ? 14 : 0,
                    borderTop: i > 0 ? `1px dashed ${paper.paperDark}` : undefined,
                    paddingTop: i > 0 ? 10 : 0,
                  }}
                >
                  <CarSectionHeader
                    label={`${t("settlement.section_own_car")} — ${era.car_short}`}
                    saldo={nStar}
                  />
                  {contribs.map((contrib, j) => {
                    const detail = fmtDetail(
                      contrib.trip_km,
                      contrib.fuel_liters,
                      contrib.expense_amount,
                      contrib.fuel_settled_liters,
                      contrib.expense_settled_amount
                    );
                    const isOwnRow = contrib.person_name === m.person_name;
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
                        <span style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkDim }}>
                          {contrib.person_name}
                          {detail ? ` ${detail}` : ""}
                        </span>
                        <span
                          style={{
                            fontFamily: fontMono,
                            fontSize: 10,
                            color: isOwnRow ? paper.inkDim : amtColor(contrib.contribution),
                            paddingLeft: 12,
                          }}
                        >
                          {isOwnRow
                            ? fmtMoney(0)
                            : `${signPrefix(contrib.contribution)}${fmtMoney(contrib.contribution)}`}
                        </span>
                      </div>
                    );
                  })}
                  <SettledNote
                    fuelCount={contribs.reduce((s, c) => s + (c.fuel_settled_count ?? 0), 0)}
                    fuelLiters={contribs.reduce((s, c) => s + (c.fuel_settled_liters ?? 0), 0)}
                    expCount={contribs.reduce((s, c) => s + (c.expense_settled_count ?? 0), 0)}
                    expAmt={contribs.reduce((s, c) => s + (c.expense_settled_amount ?? 0), 0)}
                  />
                </div>
              );
            })}

          {/* Cross-car sections — owners who drove other owners' cars */}
          {m.is_owner && crossRows.length > 0 && (
            <div
              style={{
                marginTop: 14,
                borderTop: `1px dashed ${paper.paperDark}`,
                paddingTop: 10,
              }}
            >
              {crossRows.map((item, i) => {
                const crossSaldo = -item.row.balance;
                return (
                  <div key={i} style={{ marginTop: i === 0 ? 0 : 14 }}>
                    <CarSectionHeader label={item.car_short} saldo={crossSaldo} />
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
                        car={`brandstof (${fmtL(item.row.fuel_liters)} L)${item.row.fuel_settled_liters > 0.05 ? " (*)" : ""}`}
                        detail={null}
                        amount={`+ ${fmtMoney(item.row.fuel_amount)}`}
                        amountColor={paper.green}
                      />
                    )}
                    {item.row.expense_amount > 0 && (
                      <BreakdownCarRow
                        car={`kosten${item.row.expense_settled_amount > 0.005 ? (item.row.fuel_settled_liters > 0.05 ? " (**)" : " (*)") : ""}`}
                        detail={null}
                        amount={`+ ${fmtMoney(item.row.expense_amount)}`}
                        amountColor={paper.green}
                      />
                    )}
                    <SettledNote
                      fuelCount={item.row.fuel_settled_count}
                      fuelLiters={item.row.fuel_settled_liters}
                      expCount={item.row.expense_settled_count}
                      expAmt={item.row.expense_settled_amount}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* SALDO */}
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
              {signPrefix(net)}
              {fmtMoney(net)}
            </span>
          </div>

          {/* Transfer direction */}
          {Math.abs(net) > 0.005 && bankAccount && (
            <div
              style={{
                fontFamily: fontMono,
                fontSize: 9,
                color: paper.inkDim,
                marginTop: 4,
                paddingLeft: 16,
              }}
            >
              {net > 0
                ? `coöp (${bankAccount}) → ${m.person_name}`
                : `${m.person_name} → coöp (${bankAccount})`}
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
      const hasFuelStar = (e.fuel_settled_liters ?? 0) > 0.05;
      const hasExpStar = (e.expense_settled_amount ?? 0) > 0.005;
      lines.push(`- **${e.car_name}** (${e.owner_name})`);
      lines.push(`  - Ritten: ${e.trip_km} km · € ${fmt(e.trip_amount)}`);
      if (e.fuel_amount)
        lines.push(
          `  - Brandstof: ${fmtL(e.fuel_liters)} L · € ${fmt(e.fuel_amount)}${hasFuelStar ? " (*)" : ""}`
        );
      if (e.expense_amount)
        lines.push(
          `  - Kosten: € ${fmt(e.expense_amount)}${hasExpStar ? (hasFuelStar ? " (**)" : " (*)") : ""}`
        );
      lines.push(`  - Saldo: ${sign(e.balance)}`);
      if (hasFuelStar)
        lines.push(
          `  - _(*) ${e.fuel_settled_count} tankbeurt${(e.fuel_settled_count ?? 0) !== 1 ? "en" : ""} (${fmtL(e.fuel_settled_liters ?? 0)} L) buiten afrekening_`
        );
      if (hasExpStar) {
        const prefix = hasFuelStar ? "(**)" : "(*)";
        lines.push(
          `  - _(${prefix}) ${e.expense_settled_count} kost${(e.expense_settled_count ?? 0) !== 1 ? "en" : ""} (€ ${fmt(e.expense_settled_amount ?? 0)}) buiten afrekening_`
        );
      }
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
        const rHasFuelStar = row.fuel_settled_liters > 0.05;
        const rHasExpStar = row.expense_settled_amount > 0.005;
        lines.push(`- **${cs.car_name}** (${cs.owner_name})`);
        if (row.trip_km > 0)
          lines.push(`  - Ritten: ${row.trip_km} km · € ${fmt(row.trip_amount)}`);
        if (row.fuel_liters > 0.05)
          lines.push(
            `  - Brandstof: ${fmtL(row.fuel_liters)} L · € ${fmt(row.fuel_amount)}${rHasFuelStar ? " (*)" : ""}`
          );
        if (row.expense_amount > 0.005)
          lines.push(
            `  - Kosten: € ${fmt(row.expense_amount)}${rHasExpStar ? (rHasFuelStar ? " (**)" : " (*)") : ""}`
          );
        lines.push(`  - Saldo: ${sign(row.balance)}`);
        if (rHasFuelStar)
          lines.push(
            `  - _(*) ${row.fuel_settled_count} tankbeurt${row.fuel_settled_count !== 1 ? "en" : ""} (${fmtL(row.fuel_settled_liters)} L) buiten afrekening_`
          );
        if (rHasExpStar) {
          const prefix = rHasFuelStar ? "(**)" : "(*)";
          lines.push(
            `  - _(${prefix}) ${row.expense_settled_count} kost${row.expense_settled_count !== 1 ? "en" : ""} (€ ${fmt(row.expense_settled_amount)}) buiten afrekening_`
          );
        }
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
  const { data: people } = usePeople();
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
              title={showAll ? t("settlement.show_problems") : t("settlement.show_all")}
              data-testid="settlement-expand-all"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = paper.paperDark;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              style={{
                position: "absolute",
                left: 0,
                fontFamily: fontMono,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                background: "transparent",
                color: paper.inkDim,
                border: `1px solid ${paper.paperDark}`,
                cursor: "pointer",
                padding: "4px 10px",
              }}
            >
              {showAll ? `≡` : `⚠`}
            </button>
            <button
              onClick={handleDownload}
              title={t("settlement.download")}
              data-testid="settlement-download"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = paper.paperDark;
                (e.currentTarget as HTMLButtonElement).style.borderColor = paper.paperDark;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.borderColor = paper.ink;
              }}
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
            <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkDim, marginTop: 4 }}>
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
            color: paper.inkDim,
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
            color: paper.inkDim,
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
            const step1Total =
              Math.round(
                data.members.filter((m) => !m.is_owner).reduce((s, m) => s + (m.s1 ?? 0), 0) * 100
              ) / 100;
            const step2Total =
              Math.round(
                data.members
                  .filter((m) => m.is_owner)
                  .reduce((s, m) => s + (m.net ?? m.s2 ?? 0), 0) * 100
              ) / 100;
            const balance = Math.round((step1Total + step2Total) * 100) / 100;

            const sortedMembers = [...data.members].sort((a, b) => {
              const av = Math.abs(a.is_owner ? (a.net ?? 0) : (a.s1 ?? 0));
              const bv = Math.abs(b.is_owner ? (b.net ?? 0) : (b.s1 ?? 0));
              return bv - av;
            });

            return (
              <>
                {sortedMembers.map((m) => (
                  <MemberCard
                    key={m.person_id}
                    m={m}
                    year={year}
                    bankAccount={settings?.coop_bank_account ?? ""}
                    personBankAccount={
                      people?.find((p) => p.id === m.person_id)?.bank_account ?? ""
                    }
                    personFullName={fullNameOf(
                      people?.find((p) => p.id === m.person_id) ?? {
                        first_name: m.person_name,
                        last_name: "",
                        username: null,
                      }
                    )}
                    crossRows={
                      m.is_owner
                        ? data.car_settlements.flatMap((cs) =>
                            cs.rows
                              .filter(
                                (r) =>
                                  r.row_type === "cross_owner" && r.person_name === m.person_name
                              )
                              .map((row) => ({ car_short: cs.car_short, row }))
                          )
                        : []
                    }
                    settlementTransfer={data.transfers.find(
                      (tr) =>
                        (tr.from === m.person_name || tr.to === m.person_name) &&
                        tr.payment_status !== null
                    )}
                    showAll={showAll}
                  />
                ))}

                {/* Verification bar */}
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
                    style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, marginRight: 4 }}
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
                color: data.frozen ? paper.inkDim : paper.paper,
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
