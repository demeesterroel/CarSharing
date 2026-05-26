import type { MemberStatement, CarParticipantRow } from "@/types";
import { buildSettlementLines, type SettlementLine } from "./settlement-lines";

export type { SettlementLine };
export { buildSettlementLines };

export interface SettlementMessageParams {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  personBankAccount: string;
  personFullName: string;
  crossRows: { car_short: string; row: CarParticipantRow }[];
  alreadyPaid: number;
  t: (key: string) => string;
}

const W = 40;
const WC = 32;

function e(n: number): string {
  return `€ ${n.toFixed(2).replace(".", ",").padStart(6)}`;
}

function row(left: string, sign: "+" | "−", n: number, w = W): string {
  const right = `${sign} ${e(n)}`;
  return left + " ".repeat(Math.max(1, w - left.length - right.length)) + right;
}

export function renderLinesToText(lines: SettlementLine[]): string {
  const result: string[] = [];
  for (const line of lines) {
    switch (line.kind) {
      case "section_break":
        // sections in text are contiguous — no blank line between car sections
        break;
      case "car_header":
        result.push(row(line.label, line.sign, line.amount, W));
        break;
      case "row":
        result.push(row(`  ${line.label}`, line.sign, line.amount, WC));
        break;
      case "row_zero": {
        const label = `  ${line.label}`;
        result.push(label + " ".repeat(Math.max(1, W - label.length - 7)) + `€  0,00`);
        break;
      }
      case "note":
        result.push(`  ${line.text}`);
        break;
      case "separator":
        result.push("─".repeat(W));
        break;
      case "summary":
        result.push(row(line.label, line.sign, line.amount, W));
        break;
      case "instruction_pay":
        result.push(``, `Gelieve ${e(line.amount)} over te schrijven naar ${line.iban}.`);
        break;
      case "instruction_receive":
        result.push(
          ``,
          line.bankAccount
            ? `Coöp schrijft ${e(line.amount)} over naar ${line.bankAccount}.`
            : `Coöp schrijft ${e(line.amount)} over naar jou.`
        );
        break;
    }
  }
  return result.join("\n");
}

export function buildSettlementMessage({
  m,
  year,
  bankAccount,
  personBankAccount,
  personFullName,
  crossRows,
  alreadyPaid,
  t,
}: SettlementMessageParams): string {
  const lines = buildSettlementLines({ m, year, bankAccount, personBankAccount, crossRows, alreadyPaid, t });
  const body = renderLinesToText(lines);
  const header = [
    `Beste ${personFullName},`,
    m.is_owner ? `Jouw eigenaarspayout voor ${year}:` : `Jouw aandeel in de jaarafrekening ${year}:`,
  ].join("\n");
  return ["```", header, body, `Je overzicht: `, "```"].join("\n");
}
