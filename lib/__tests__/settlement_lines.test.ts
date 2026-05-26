// lib/__tests__/settlement_lines.test.ts
import { describe, it, expect } from "vitest";
import { buildSettlementLines } from "../settlement-lines";
import type { SettlementLine } from "../settlement-lines";
import type { MemberStatement } from "@/types";

const mockT = (key: string): string => {
  const map: Record<string, string> = {
    "settlement.section_own_car": "Eigen wagen",
    "page.trips": "Ritten",
    "settlement.breakdown_fuel": "Brandstof",
    "settlement.breakdown_costs": "Kosten",
  };
  return map[key] ?? key;
};

const kinds = (lines: SettlementLine[]) => lines.map((l) => l.kind);

const nonOwner: MemberStatement = {
  person_id: 3,
  person_name: "Alice",
  is_owner: false,
  s1: -148.01,
  car_eras: [
    {
      car_name: "Car A",
      car_short: "CA",
      owner_name: "Bob",
      owner_from: "2020-01-01",
      owner_to: null,
      balance: -148.01,
      trip_km: 500,
      trip_amount: 100,
      fuel_liters: 20,
      fuel_amount: 48.01,
      expense_amount: 0,
    },
  ],
};

describe("buildSettlementLines — non-owner, no payments", () => {
  const lines = () =>
    buildSettlementLines({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });

  it("produces car_header → row(trips) → row(fuel) → separator → summary(Saldo) → instruction_pay", () => {
    expect(kinds(lines())).toEqual([
      "car_header",
      "row",
      "row",
      "separator",
      "summary",
      "instruction_pay",
    ]);
  });

  it("car_header has correct label, sign, amount", () => {
    const header = lines().find((l) => l.kind === "car_header") as Extract<SettlementLine, { kind: "car_header" }>;
    expect(header.label).toBe("CA");
    expect(header.sign).toBe("−");
    expect(header.amount).toBeCloseTo(148.01, 2);
  });

  it("trip row has correct label and sign", () => {
    const row = lines().find((l) => l.kind === "row") as Extract<SettlementLine, { kind: "row" }>;
    expect(row.label).toContain("Ritten");
    expect(row.label).toContain("500 km");
    expect(row.sign).toBe("−");
    expect(row.amount).toBeCloseTo(100, 2);
  });

  it("summary label is 'Saldo' when no payments", () => {
    const s = lines().find((l) => l.kind === "summary") as Extract<SettlementLine, { kind: "summary" }>;
    expect(s.label).toBe("Saldo");
    expect(s.sign).toBe("−");
    expect(s.amount).toBeCloseTo(148.01, 2);
  });

  it("no instruction line when person has no balance direction to settle", () => {
    // balance < 0 → person owes co-op → instruction_pay with iban
    const inst = lines().find((l) => l.kind === "instruction_pay") as Extract<SettlementLine, { kind: "instruction_pay" }> | undefined;
    expect(inst).toBeDefined();
    expect(inst!.iban).toBe("BE00 0000 0000 0000");
    expect(inst!.amount).toBeCloseTo(148.01, 2);
  });
});

describe("buildSettlementLines — non-owner, with partial payment", () => {
  const lines = () =>
    buildSettlementLines({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 50,
      t: mockT,
    });

  it("produces car_header → row → row → separator → summary(Bruto) → summary(Al betaald) → separator → summary(Nog te betalen)", () => {
    expect(kinds(lines())).toEqual([
      "car_header",
      "row",
      "row",
      "separator",
      "summary",  // Bruto saldo
      "summary",  // Al betaald
      "separator",
      "summary",  // Nog te betalen
      "instruction_pay",
    ]);
  });

  it("first summary is 'Bruto saldo'", () => {
    const summaries = lines().filter((l) => l.kind === "summary") as Extract<SettlementLine, { kind: "summary" }>[];
    expect(summaries[0].label).toBe("Bruto saldo");
    expect(summaries[0].amount).toBeCloseTo(148.01, 2);
  });

  it("second summary is 'Al betaald'", () => {
    const summaries = lines().filter((l) => l.kind === "summary") as Extract<SettlementLine, { kind: "summary" }>[];
    expect(summaries[1].label).toBe("Al betaald");
    expect(summaries[1].amount).toBeCloseTo(50, 2);
  });

  it("final summary is 'Nog te betalen' with remaining amount", () => {
    const summaries = lines().filter((l) => l.kind === "summary") as Extract<SettlementLine, { kind: "summary" }>[];
    expect(summaries[2].label).toBe("Nog te betalen");
    expect(summaries[2].amount).toBeCloseTo(98.01, 2);
    expect(summaries[2].emphasis).toBe(true);
  });
});

describe("buildSettlementLines — non-owner, net > 0 with payments", () => {
  it("instruction_receive when remaining > 0", () => {
    const lines = buildSettlementLines({
      m: { ...nonOwner, s1: 2.19 },
      year: 2025,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "BE00 0000 0000 0004",
      crossRows: [],
      alreadyPaid: -2,  // raw sum: 22 + (-24)
      t: mockT,
    });
    const inst = lines.find((l) => l.kind === "instruction_receive") as Extract<SettlementLine, { kind: "instruction_receive" }> | undefined;
    expect(inst).toBeDefined();
    expect(inst!.amount).toBeCloseTo(0.19, 2);
    expect(inst!.bankAccount).toBe("BE00 0000 0000 0004");
  });

  it("final summary is 'Nog te ontvangen' when co-op still owes", () => {
    const lines = buildSettlementLines({
      m: { ...nonOwner, s1: 2.19 },
      year: 2025,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: -2,
      t: mockT,
    });
    const summaries = lines.filter((l) => l.kind === "summary") as Extract<SettlementLine, { kind: "summary" }>[];
    expect(summaries.at(-1)!.label).toBe("Nog te ontvangen");
  });
});

describe("buildSettlementLines — two car eras → section_break between them", () => {
  it("inserts section_break between car sections", () => {
    const twoCarMember: MemberStatement = {
      ...nonOwner,
      car_eras: [
        { ...nonOwner.car_eras[0], car_short: "CA" },
        { ...nonOwner.car_eras[0], car_short: "CB", balance: -80, trip_km: 400, trip_amount: 80, fuel_liters: 0, fuel_amount: 0 },
      ],
    };
    const lines = buildSettlementLines({
      m: twoCarMember,
      year: 2024,
      bankAccount: "",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });
    expect(kinds(lines)).toContain("section_break");
    // section_break appears between the two car_headers
    const breakIdx = lines.findIndex((l) => l.kind === "section_break");
    expect(lines[breakIdx - 1].kind).not.toBe("car_header");  // after some rows
    expect(lines[breakIdx + 1].kind).toBe("car_header");      // before next header
  });
});

describe("buildSettlementLines — settled-outside notes", () => {
  it("emits note line when fuel_settled_liters > 0", () => {
    const member: MemberStatement = {
      ...nonOwner,
      car_eras: [{
        ...nonOwner.car_eras[0],
        fuel_settled_liters: 10,
        fuel_settled_count: 1,
      }],
    };
    const lines = buildSettlementLines({
      m: member,
      year: 2024,
      bankAccount: "",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });
    const note = lines.find((l) => l.kind === "note") as Extract<SettlementLine, { kind: "note" }> | undefined;
    expect(note).toBeDefined();
    expect(note!.text).toContain("(*)");
    expect(note!.text).toContain("buiten afrekening");
  });
});

describe("buildSettlementLines — owner, own car section", () => {
  const owner: MemberStatement = {
    person_id: 1,
    person_name: "Alice",
    is_owner: true,
    s2: 150,
    s1_cross: 0,
    net: 150,
    car_eras: [
      {
        car_name: "Car A",
        car_short: "CA",
        owner_name: "Alice",
        owner_from: "2020-01-01",
        owner_to: null,
        balance: 150,
        trip_km: 0,
        trip_amount: 0,
        fuel_liters: 0,
        fuel_amount: 0,
        expense_amount: 0,
        n_c_star: 150,
        member_contributions: [
          { person_name: "Bob", trip_km: 500, fuel_liters: 10, expense_amount: 0, contribution: 150, fuel_settled_count: 0, fuel_settled_liters: 0, expense_settled_count: 0, expense_settled_amount: 0 },
        ],
      },
    ],
  };

  it("produces car_header with 'Eigen wagen — CA' label", () => {
    const lines = buildSettlementLines({
      m: owner,
      year: 2024,
      bankAccount: "",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });
    const header = lines.find((l) => l.kind === "car_header") as Extract<SettlementLine, { kind: "car_header" }>;
    expect(header.label).toBe("Eigen wagen — CA");
  });

  it("produces row for each member contribution", () => {
    const lines = buildSettlementLines({
      m: owner,
      year: 2024,
      bankAccount: "",
      personBankAccount: "",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });
    const rows = lines.filter((l) => l.kind === "row") as Extract<SettlementLine, { kind: "row" }>[];
    expect(rows.length).toBe(1);
    expect(rows[0].label).toContain("Bob");
  });
});
