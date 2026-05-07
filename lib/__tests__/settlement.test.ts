// lib/__tests__/settlement.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { getSettlement, lockSettlement, unlockSettlement } from "../queries/settlement";
import { insertPayment } from "../queries/payments";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  db.exec(`
    INSERT INTO people (id, name, active) VALUES
      (1, 'Alice', 1),
      (2, 'Bob',   1),
      (3, 'Carol', 1),
      (4, 'Dave',  1);
  `);
  db.exec(`
    INSERT INTO cars (id, short, name, price_per_km, owner_name, owner_from, active)
    VALUES
      (1, 'CA', 'Car A', 0.2, 'Alice', '2020-01-01', 1),
      (2, 'CB', 'Car B', 0.2, 'Bob',   '2020-01-01', 1);
  `);
  const addTrip = db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  );
  addTrip.run(3, 1, "2025-06-01", 0, 500, 500, 100); // carol drives CarA: €100
  addTrip.run(4, 1, "2025-06-02", 500, 750, 250, 50); // dave drives CarA:  €50
  addTrip.run(3, 2, "2025-06-03", 0, 400, 400, 80); // carol drives CarB: €80
  addTrip.run(4, 2, "2025-06-04", 400, 600, 200, 40); // dave drives CarB:  €40
  addTrip.run(1, 2, "2025-06-05", 600, 750, 150, 30); // alice drives CarB (cross-owner): €30
  addTrip.run(1, 1, "2025-06-06", 750, 900, 150, 30); // alice drives CarA (own): €30 — shown as €0 in settlement
}

describe("getSettlement", () => {
  it("N_new(c) includes cross-owner trips", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    // CarA: carol(100) + dave(50) = 150; alice own trip excluded
    expect(alice.car_eras[0].n_c_star).toBe(150);
    // CarB: carol(80) + dave(40) + alice-cross(30) = 150
    expect(bob.car_eras[0].n_c_star).toBe(150);
  });

  it("S₁ for non-owners unchanged", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    const dave = result.members.find((m) => m.person_name === "Dave")!;
    expect(carol.s1).toBe(-180); // -(100+80)
    expect(dave.s1).toBe(-90); // -(50+40)
  });

  it("S₂ for owners uses N_new", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.s2).toBe(150); // N_new(CarA) = 150
    expect(bob.s2).toBe(150); // N_new(CarB) = 150 (includes alice cross €30)
  });

  it("s1_cross for owners: their balance for using other cars", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.s1_cross).toBe(-30); // alice drove CarB: owes €30 to co-op
    expect(bob.s1_cross).toBe(0); // bob drove no other cars
  });

  it("net for owners: s2 + s1_cross", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.net).toBe(120); // 150 + (-30)
    expect(bob.net).toBe(150); // 150 + 0
  });

  it("verify_ok: co-op in = co-op out", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    expect(result.verify_ok).toBe(true);
  });

  it("step 1 transfers include only non-owners; cross-owners have no step 1 transfer", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step1 = result.transfers.filter((t) => t.step === 1);
    const carol = step1.find((t) => t.from === "Carol");
    const dave = step1.find((t) => t.from === "Dave");
    const alice = step1.find((t) => t.from === "Alice");
    expect(carol?.amount).toBe(180);
    expect(carol?.to).toBe("co-op");
    expect(dave?.amount).toBe(90);
    expect(dave?.to).toBe("co-op");
    // Cross-owner (Alice used CarB) → no separate step-1 transfer; folded into step-2 net
    expect(alice).toBeUndefined();
  });

  it("step 2 transfers use net (S2 + S1Cross) amounts", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step2 = result.transfers.filter((t) => t.step === 2);
    const toAlice = step2.find((t) => t.to === "Alice");
    const toBob = step2.find((t) => t.to === "Bob");
    // Alice net = S2(150) + S1Cross(-30) = 120
    expect(toAlice?.amount).toBe(120);
    // Bob net = S2(150) + S1Cross(0) = 150
    expect(toBob?.amount).toBe(150);
  });

  it("no step 3 transfers", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    expect(result.transfers.filter((t) => (t.step as number) === 3)).toHaveLength(0);
  });

  it("car_settlements: CarB has member, cross_owner, and own rows", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carB = result.car_settlements.find((c) => c.car_short === "CB")!;
    expect(carB.total_balance).toBe(150);
    const members = carB.rows.filter((r) => r.row_type === "member");
    const crossOwner = carB.rows.filter((r) => r.row_type === "cross_owner");
    const own = carB.rows.filter((r) => r.row_type === "own");
    expect(members.map((r) => r.person_name).sort()).toEqual(["Carol", "Dave"]);
    expect(crossOwner).toHaveLength(1);
    expect(crossOwner[0].person_name).toBe("Alice");
    expect(crossOwner[0].trip_amount).toBe(30);
    expect(crossOwner[0].balance).toBe(30);
    expect(own).toHaveLength(0); // Bob has no own trips recorded
  });

  it("car_settlements: CarA has member rows and own row for Alice", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carA = result.car_settlements.find((c) => c.car_short === "CA")!;
    expect(carA.total_balance).toBe(150);
    const own = carA.rows.filter((r) => r.row_type === "own");
    expect(own).toHaveLength(1);
    expect(own[0].person_name).toBe("Alice");
    expect(own[0].trip_km).toBe(150);
    expect(own[0].trip_amount).toBe(0); // own trips = €0 in settlement
    expect(own[0].balance).toBe(0);
  });

  it("credits non-owner fuel payment against their balance and N_new", () => {
    const db = makeDb();
    seed(db);
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(3, 1, "2025-07-01", 20, 20, 1.0);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    expect(carol.s1).toBe(-160); // was -180, +20 fuel credit
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    expect(alice.s2).toBe(130); // N_new(CarA): 150 - 20 = 130
  });

  it("returns empty result when no car eras exist for the year", () => {
    const db = makeDb();
    const result = getSettlement(db, 2025);
    expect(result.members).toHaveLength(0);
    expect(result.car_settlements).toHaveLength(0);
    expect(result.verify_ok).toBe(true);
  });
});

describe("getSettlement — payment integration", () => {
  it("annotates step-1 transfers with payment status when no payments exist", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step1 = result.transfers.filter((t) => t.step === 1);
    // All transfers should have payment_status with paid=0 and open=amount
    for (const t of step1) {
      if (t.payment_status !== null) {
        expect(t.payment_status.paid).toBe(0);
        expect(t.payment_status.open).toBeCloseTo(t.amount, 2);
      }
    }
  });

  it("reflects partial payment in transfer payment_status", () => {
    const db = makeDb();
    seed(db);
    const result0 = getSettlement(db, 2025);
    // Find Carol's step-1 transfer (Carol has s1 < 0 → she owes the co-op)
    const carolTransfer = result0.transfers.find((t) => t.step === 1 && t.from === "Carol");
    if (!carolTransfer) return; // skip if Carol has no debt
    const carolId = 3; // from seed
    // Carol pays half
    const halfAmount = carolTransfer.amount / 2;
    insertPayment(db, {
      person_id: carolId,
      date: "2026-03-01", // year = 2025
      amount: halfAmount,
      note: null,
    });
    const result1 = getSettlement(db, 2025);
    const carolT = result1.transfers.find((t) => t.step === 1 && t.from === "Carol")!;
    expect(carolT.payment_status).not.toBeNull();
    expect(carolT.payment_status!.paid).toBeCloseTo(halfAmount, 2);
    expect(carolT.payment_status!.open).toBeCloseTo(halfAmount, 2);
  });

  it("reports all_paid=false when outstanding payments remain", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    // No payments recorded → all_paid should be false (assuming any transfers exist)
    if (result.transfers.some((t) => t.payment_status !== null)) {
      expect(result.all_paid).toBe(false);
    }
  });

  it("reports all_paid=true when all transfers are fully paid", () => {
    const db = makeDb();
    seed(db);
    const nameToId: Record<string, number> = { Alice: 1, Bob: 2, Carol: 3, Dave: 4 };
    const result0 = getSettlement(db, 2025);
    // Pay every transfer that has a payment_status
    for (const t of result0.transfers) {
      if (t.payment_status === null) continue;
      if (t.step === 1) {
        // Step 1: human payer (non-owner owes co-op)
        const payerId = nameToId[t.from];
        if (payerId) {
          insertPayment(db, {
            person_id: payerId,
            date: "2026-03-01",
            amount: t.amount,
            note: null,
          });
        }
      } else if (t.step === 2) {
        // Step 2: net (S2 + S1Cross) paid to owner; record as payment for owner
        const ownerName = t.from === "co-op" ? t.to : t.from;
        const ownerId = nameToId[ownerName];
        if (ownerId) {
          insertPayment(db, {
            person_id: ownerId,
            date: "2026-03-01",
            amount: t.amount,
            note: null,
          });
        }
      }
    }
    const result1 = getSettlement(db, 2025);
    expect(result1.all_paid).toBe(true);
  });

  it("includes payments_by_person in the result", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 3, date: "2026-03-01", amount: 55, note: null });
    const result = getSettlement(db, 2025);
    expect(result.payments_by_person[3]).toBeCloseTo(55, 2);
  });
});

describe("lockSettlement / unlockSettlement", () => {
  it("marks a year as frozen", () => {
    const db = makeDb();
    lockSettlement(db, 2025, "admin");
    const result = getSettlement(db, 2025);
    expect(result.frozen).toBe(true);
    expect(result.settled_by).toBe("admin");
  });

  it("unlock removes the frozen flag", () => {
    const db = makeDb();
    lockSettlement(db, 2025, "admin");
    unlockSettlement(db, 2025);
    const result = getSettlement(db, 2025);
    expect(result.frozen).toBe(false);
  });
});
