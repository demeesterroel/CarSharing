// lib/__tests__/settlement_message.test.ts
import type { MemberStatement } from "@/types";
import { describe, expect, it } from "vitest";
import { buildSettlementMessage } from "../settlement-message";

const mockT = (key: string): string => {
  const map: Record<string, string> = {
    "settlement.section_own_car": "Eigen wagen",
    "page.trips": "Ritten",
    "settlement.breakdown_fuel": "Brandstof",
    "settlement.breakdown_costs": "Kosten",
  };
  return map[key] ?? key;
};

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
      fuel_amount: 25,
      expense_amount: 0,
    },
  ],
};

describe("buildSettlementMessage — no payments", () => {
  it("contains 'Saldo' when alreadyPaid is 0", () => {
    const msg = buildSettlementMessage({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Alice",
      crossRows: [],
      alreadyPaid: 0,
      t: mockT,
    });
    expect(msg).toContain("Saldo");
    expect(msg).not.toContain("Bruto saldo");
    expect(msg).not.toContain("Al betaald");
  });
});

describe("buildSettlementMessage — with partial payment", () => {
  it("shows Bruto saldo, Al betaald when alreadyPaid > 0", () => {
    const msg = buildSettlementMessage({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Alice",
      crossRows: [],
      alreadyPaid: 50,
      t: mockT,
    });
    expect(msg).toContain("Bruto saldo");
    expect(msg).toContain("Al betaald");
  });

  it("remaining amount = |net| - alreadyPaid when still underpaid", () => {
    // net = -148.01, paid = 50 → still owe 98.01
    const msg = buildSettlementMessage({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Alice",
      crossRows: [],
      alreadyPaid: 50,
      t: mockT,
    });
    expect(msg).toContain("98,01");
    expect(msg).toContain("Gelieve");
  });

  it("shows co-op owes back when overpaid", () => {
    // net = -100, paid = 150 → co-op owes back 50
    const msg = buildSettlementMessage({
      m: { ...nonOwner, s1: -100 },
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Alice",
      crossRows: [],
      alreadyPaid: 150,
      t: mockT,
    });
    expect(msg).toContain("50,00");
    expect(msg).toContain("Coöp schrijft");
  });

  it("net > 0: co-op already paid person partially — remaining = net - paid", () => {
    // net = +2.19 (co-op owes person), co-op already paid 21 → overpaid by 18.81 → person owes back
    const msg = buildSettlementMessage({
      m: { ...nonOwner, s1: 2.19 },
      year: 2025,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Bob",
      crossRows: [],
      alreadyPaid: 21,
      t: mockT,
    });
    expect(msg).toContain("Bruto saldo");
    expect(msg).toContain("Al betaald");
    // remaining = 2.19 - 21 = -18.81 → Bob owes co-op €18.81
    expect(msg).toContain("18,81");
    expect(msg).toContain("Gelieve");
    expect(msg).not.toContain("Coöp schrijft");
  });

  it("net > 0: negative alreadyPaid (netted payments) treated as absolute value", () => {
    // net = +2.19, payments_by_person = 22 + (−24) = −2 → effective paid = 2
    // remaining = 2.19 − 2 = 0.19 → co-op still owes 0.19
    const msg = buildSettlementMessage({
      m: { ...nonOwner, s1: 2.19 },
      year: 2025,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "BE00 0000 0000 0004",
      personFullName: "Bob",
      crossRows: [],
      alreadyPaid: -2,
      t: mockT,
    });
    expect(msg).toContain("Bruto saldo");
    expect(msg).toContain("Al betaald");
    expect(msg).toContain("0,19");
    expect(msg).toContain("Coöp schrijft");
    expect(msg).not.toContain("4,19");
  });

  it("shows fully settled when exactly paid", () => {
    // net = -148.01, paid = 148.01 → nothing left
    const msg = buildSettlementMessage({
      m: nonOwner,
      year: 2024,
      bankAccount: "BE00 0000 0000 0000",
      personBankAccount: "",
      personFullName: "Alice",
      crossRows: [],
      alreadyPaid: 148.01,
      t: mockT,
    });
    expect(msg).toContain("Bruto saldo");
    expect(msg).toContain("Al betaald");
    expect(msg).not.toContain("Gelieve");
    expect(msg).not.toContain("Coöp schrijft");
  });
});
