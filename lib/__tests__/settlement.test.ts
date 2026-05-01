// lib/__tests__/settlement.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { getSettlement, lockSettlement, unlockSettlement } from "../queries/settlement";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  // People
  db.exec(`
    INSERT INTO people (id, name, active) VALUES
      (1, 'Alice', 1),
      (2, 'Bob',   1),
      (3, 'Carol', 1),
      (4, 'Dave',  1);
  `);
  // Cars with owner eras
  db.exec(`
    INSERT INTO cars (id, short, name, price_per_km, owner_name, owner_from, active)
    VALUES
      (1, 'CA', 'Car A', 0.2, 'Alice', '2020-01-01', 1),
      (2, 'CB', 'Car B', 0.2, 'Bob',   '2020-01-01', 1);
  `);
  // Trips in 2025
  // carol drives CarA: €100
  db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  ).run(3, 1, "2025-06-01", 0, 500, 500, 100);
  // dave drives CarA: €50
  db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  ).run(4, 1, "2025-06-02", 500, 750, 250, 50);
  // carol drives CarB: €80
  db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  ).run(3, 2, "2025-06-03", 0, 400, 400, 80);
  // dave drives CarB: €40
  db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  ).run(4, 2, "2025-06-04", 400, 600, 200, 40);
  // alice drives CarB (cross-owner): €30
  db.prepare(
    "INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount) VALUES (?,?,?,?,?,?,?)"
  ).run(1, 2, "2025-06-05", 600, 750, 150, 30);
}

describe("getSettlement", () => {
  it("computes N(c*) for each car — excludes owner own-car trips", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.car_eras[0].n_c_star).toBe(150); // N(CarA) = carol + dave trips
    expect(bob.car_eras[0].n_c_star).toBe(120); // N(CarB) = carol + dave trips only
  });

  it("computes S₁ for non-owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    const dave = result.members.find((m) => m.person_name === "Dave")!;
    expect(carol.s1).toBe(-180);
    expect(dave.s1).toBe(-90);
  });

  it("computes S₂ for owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.s2).toBe(150);
    expect(bob.s2).toBe(120);
  });

  it("computes cross-owner X positions", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.x).toBe(-30); // alice drove bob's car
    expect(bob.x).toBe(30);
  });

  it("computes net (s2 + x) for owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    const bob = result.members.find((m) => m.person_name === "Bob")!;
    expect(alice.net).toBe(120); // 150 - 30
    expect(bob.net).toBe(150); // 120 + 30
  });

  it("verify_ok: Σ S₁ + Σ S₂ = 0", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    expect(result.verify_ok).toBe(true);
  });

  it("builds step 1 transfers for non-owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step1 = result.transfers.filter((t) => t.step === 1);
    const carol = step1.find((t) => t.from === "Carol");
    const dave = step1.find((t) => t.from === "Dave");
    expect(carol?.amount).toBe(180);
    expect(carol?.to).toBe("co-op");
    expect(dave?.amount).toBe(90);
  });

  it("builds step 2 transfers for owners", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step2 = result.transfers.filter((t) => t.step === 2);
    const toAlice = step2.find((t) => t.to === "Alice");
    const toBob = step2.find((t) => t.to === "Bob");
    expect(toAlice?.amount).toBe(150);
    expect(toBob?.amount).toBe(120);
  });

  it("builds step 3 cross-owner transfer: Alice → Bob €30", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step3 = result.transfers.filter((t) => t.step === 3);
    expect(step3).toHaveLength(1);
    expect(step3[0].from).toBe("Alice");
    expect(step3[0].to).toBe("Bob");
    expect(step3[0].amount).toBe(30);
  });

  it("credits non-owner fuel payment against their balance", () => {
    const db = makeDb();
    seed(db);
    // Carol pays €20 fuel on CarA
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, liters, amount, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(3, 1, "2025-07-01", 20, 20, 1.0);
    const result = getSettlement(db, 2025);
    const carol = result.members.find((m) => m.person_name === "Carol")!;
    // S₁(Carol) was -180; now +20 fuel credit → -160
    expect(carol.s1).toBe(-160);
    // N(CarA) was 150; non-owner fuel reduces it: 150 - 20 = 130
    const alice = result.members.find((m) => m.person_name === "Alice")!;
    expect(alice.s2).toBe(130);
  });

  it("returns empty result when no car eras exist for the year", () => {
    const db = makeDb();
    const result = getSettlement(db, 2025);
    expect(result.members).toHaveLength(0);
    expect(result.verify_ok).toBe(true);
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
