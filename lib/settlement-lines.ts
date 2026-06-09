import type { CarParticipantRow, MemberStatement } from "@/types";

function fmtL(liters: number): string {
  return liters.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export type SettlementLine =
  | { kind: "section_break" }
  | { kind: "car_header"; label: string; sign: "+" | "−"; amount: number }
  | { kind: "row"; label: string; sign: "+" | "−"; amount: number }
  | { kind: "row_zero"; label: string }
  | { kind: "note"; text: string }
  | { kind: "separator" }
  | { kind: "summary"; label: string; sign: "+" | "−"; amount: number; emphasis?: boolean }
  | { kind: "instruction_pay"; amount: number; iban: string }
  | { kind: "instruction_receive"; amount: number; bankAccount: string };

export interface BuildSettlementLinesParams {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  personBankAccount: string;
  crossRows: { car_short: string; row: CarParticipantRow }[];
  alreadyPaid: number;
  t: (key: string) => string;
}

export function buildSettlementLines({
  m,
  bankAccount,
  personBankAccount,
  crossRows,
  alreadyPaid,
  t,
}: BuildSettlementLinesParams): SettlementLine[] {
  const lines: SettlementLine[] = [];
  const net = m.is_owner ? (m.net ?? 0) : (m.s1 ?? 0);

  if (m.is_owner) {
    let first = true;
    for (const era of m.car_eras) {
      const nStar = era.n_c_star ?? 0;
      const contribs = era.member_contributions ?? [];
      if (Math.abs(nStar) < 0.005 && contribs.length === 0) continue;
      if (!first) lines.push({ kind: "section_break" });
      first = false;
      lines.push({
        kind: "car_header",
        label: `${t("settlement.section_own_car")} — ${era.car_short}`,
        sign: nStar >= 0 ? "+" : "−",
        amount: Math.abs(nStar),
      });
      for (const c of contribs) {
        const detail =
          c.trip_km > 0
            ? ` (${c.trip_km} km${c.fuel_liters > 0.05 ? `, ${fmtL(c.fuel_liters)} L` : ""}${c.expense_amount > 0 ? `, € ${c.expense_amount.toFixed(2).replace(".", ",")}` : ""})`
            : "";
        if (c.contribution === 0) {
          lines.push({ kind: "row_zero", label: `${c.person_name}${detail}` });
        } else {
          lines.push({
            kind: "row",
            label: `${c.person_name}${detail}`,
            sign: c.contribution >= 0 ? "+" : "−",
            amount: Math.abs(c.contribution),
          });
        }
      }
      const fuelCount = contribs.reduce((s, c) => s + (c.fuel_settled_count ?? 0), 0);
      const fuelLiters = contribs.reduce((s, c) => s + (c.fuel_settled_liters ?? 0), 0);
      const expCount = contribs.reduce((s, c) => s + (c.expense_settled_count ?? 0), 0);
      const expAmt = contribs.reduce((s, c) => s + (c.expense_settled_amount ?? 0), 0);
      if (fuelLiters > 0.05) {
        lines.push({
          kind: "note",
          text: `(*) ${fuelCount} tankbeurt${fuelCount !== 1 ? "en" : ""} (${fmtL(fuelLiters)} L) buiten afrekening`,
        });
      }
      if (expAmt > 0.005) {
        const prefix = fuelLiters > 0.05 ? "(**)" : "(*)";
        lines.push({
          kind: "note",
          text: `${prefix} ${expCount} kost${expCount !== 1 ? "en" : ""} (€ ${expAmt.toFixed(2).replace(".", ",")}) buiten afrekening`,
        });
      }
    }
    if (crossRows.length > 0) {
      if (!first) lines.push({ kind: "section_break" });
      for (const { car_short, row: r } of crossRows) {
        const saldo = -r.balance;
        lines.push({
          kind: "car_header",
          label: car_short,
          sign: saldo >= 0 ? "+" : "−",
          amount: Math.abs(saldo),
        });
        if (r.trip_km > 0) {
          lines.push({
            kind: "row",
            label: `ritten (${r.trip_km} km)`,
            sign: "−",
            amount: r.trip_amount,
          });
        }
        if (r.fuel_liters > 0.05) {
          const hasFuelStar = r.fuel_settled_liters > 0.05;
          lines.push({
            kind: "row",
            label: `brandstof (${fmtL(r.fuel_liters)} L)${hasFuelStar ? " (*)" : ""}`,
            sign: "+",
            amount: r.fuel_amount,
          });
        }
        if (r.expense_amount > 0.005) {
          const hasFuelStar = r.fuel_settled_liters > 0.05;
          const hasExpStar = r.expense_settled_amount > 0.005;
          lines.push({
            kind: "row",
            label: `kosten${hasExpStar ? (hasFuelStar ? " (**)" : " (*)") : ""}`,
            sign: "+",
            amount: r.expense_amount,
          });
        }
        if (r.fuel_settled_liters > 0.05) {
          lines.push({
            kind: "note",
            text: `(*) ${r.fuel_settled_count} tankbeurt${r.fuel_settled_count !== 1 ? "en" : ""} (${fmtL(r.fuel_settled_liters)} L) buiten afrekening`,
          });
        }
        if (r.expense_settled_amount > 0.005) {
          const prefix = r.fuel_settled_liters > 0.05 ? "(**)" : "(*)";
          lines.push({
            kind: "note",
            text: `${prefix} ${r.expense_settled_count} kost${r.expense_settled_count !== 1 ? "en" : ""} (€ ${r.expense_settled_amount.toFixed(2).replace(".", ",")}) buiten afrekening`,
          });
        }
      }
    }
  } else {
    let first = true;
    for (const era of m.car_eras) {
      if (era.trip_km === 0 && era.fuel_liters === 0 && era.expense_amount === 0) continue;
      if (!first) lines.push({ kind: "section_break" });
      first = false;
      lines.push({
        kind: "car_header",
        label: era.car_short,
        sign: era.balance >= 0 ? "+" : "−",
        amount: Math.abs(era.balance),
      });
      if (era.trip_km > 0) {
        lines.push({
          kind: "row",
          label: `${t("page.trips")} (${era.trip_km} km)`,
          sign: "−",
          amount: era.trip_amount,
        });
      }
      const hasFuelStar = (era.fuel_settled_liters ?? 0) > 0.05;
      const hasExpStar = (era.expense_settled_amount ?? 0) > 0.005;
      if (era.fuel_liters > 0) {
        lines.push({
          kind: "row",
          label: `${t("settlement.breakdown_fuel")} (${fmtL(era.fuel_liters)} L)${hasFuelStar ? " (*)" : ""}`,
          sign: "+",
          amount: era.fuel_amount,
        });
      }
      if (era.expense_amount > 0) {
        lines.push({
          kind: "row",
          label: `${t("settlement.breakdown_costs")}${hasExpStar ? (hasFuelStar ? " (**)" : " (*)") : ""}`,
          sign: "+",
          amount: era.expense_amount,
        });
      }
      if (hasFuelStar) {
        lines.push({
          kind: "note",
          text: `(*) ${era.fuel_settled_count} tankbeurt${(era.fuel_settled_count ?? 0) !== 1 ? "en" : ""} (${fmtL(era.fuel_settled_liters ?? 0)} L) buiten afrekening`,
        });
      }
      if (hasExpStar) {
        const prefix = hasFuelStar ? "(**)" : "(*)";
        lines.push({
          kind: "note",
          text: `${prefix} ${era.expense_settled_count} kost${(era.expense_settled_count ?? 0) !== 1 ? "en" : ""} (€ ${(era.expense_settled_amount ?? 0).toFixed(2).replace(".", ",")}) buiten afrekening`,
        });
      }
    }
  }

  // Summary
  lines.push({ kind: "separator" });
  const paid = Math.abs(alreadyPaid) > 0.005 ? Math.abs(alreadyPaid) : 0;
  const remaining = net > 0 ? net - paid : net + paid;

  if (paid > 0.005) {
    lines.push({
      kind: "summary",
      label: "Bruto saldo",
      sign: net >= 0 ? "+" : "−",
      amount: Math.abs(net),
    });
    lines.push({ kind: "summary", label: "Al betaald", sign: "+", amount: paid });
    lines.push({ kind: "separator" });
  }

  const finalLabel =
    paid > 0.005 ? (remaining >= 0 ? "Nog te ontvangen" : "Nog te betalen") : "Saldo";
  lines.push({
    kind: "summary",
    label: finalLabel,
    sign: remaining >= 0 ? "+" : "−",
    amount: Math.abs(remaining),
    emphasis: true,
  });

  // Payment instruction
  const iban = bankAccount || "(rekeningnummer niet ingesteld — stel in via Admin → Instellingen)";
  if (remaining > 0.005) {
    lines.push({ kind: "instruction_receive", amount: remaining, bankAccount: personBankAccount });
  } else if (remaining < -0.005) {
    lines.push({ kind: "instruction_pay", amount: Math.abs(remaining), iban });
  }

  return lines;
}
