import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";

function makeDb() {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

describe("migration 0006 — settings table", () => {
  it("creates the settings table", () => {
    const db = makeDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).toContain("settings");
  });

  it("settings table has key and value columns", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(settings)").all() as {
      name: string;
      type: string;
      dflt_value: string | null;
    }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("key");
    expect(names).toContain("value");
  });

  it("value column defaults to empty string", () => {
    const db = makeDb();
    const col = (
      db.prepare("PRAGMA table_info(settings)").all() as {
        name: string;
        dflt_value: string | null;
      }[]
    ).find((c) => c.name === "value");
    expect(col!.dflt_value).toBe("''");
  });

  it("seeds coop_bank_account row", () => {
    const db = makeDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'coop_bank_account'").get() as
      | { value: string }
      | undefined;
    expect(row).toBeTruthy();
    expect(row!.value).toBe("");
  });

  it("running migration again does not duplicate the seed row", () => {
    const db = makeDb();
    runMigrations(db); // second run — idempotent
    const rows = db
      .prepare("SELECT COUNT(*) as cnt FROM settings WHERE key = 'coop_bank_account'")
      .get() as { cnt: number };
    expect(rows.cnt).toBe(1);
  });
});

describe("migration 0007 — settled_outside flag", () => {
  it("adds settled_outside to fuel_fillups", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(fuel_fillups)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "settled_outside");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("0");
  });

  it("adds settled_outside to expenses", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(expenses)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "settled_outside");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("0");
  });

  it("settled_outside defaults to 0 on insert", () => {
    const db = makeDb();
    db.exec("INSERT INTO people (id, first_name, active) VALUES (1, 'Alice', 1)");
    db.exec("INSERT INTO cars (id, short, name, price_per_km) VALUES (1, 'X', 'Car', 0.3)");
    db.prepare(
      "INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter) VALUES (?,?,?,?,?,?)"
    ).run(1, 1, "2026-01-01", 50, 30, 1.65);
    const row = db.prepare("SELECT settled_outside FROM fuel_fillups LIMIT 1").get() as {
      settled_outside: number;
    };
    expect(row.settled_outside).toBe(0);
  });
});

describe("migration 0008 — drop fixed_costs_json from cars", () => {
  it("fixed_costs_json column no longer exists on cars", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).not.toContain("fixed_costs_json");
  });

  it("cars table still has expected core columns after drop", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("short");
    expect(names).toContain("name");
    expect(names).toContain("price_per_km");
  });
});

describe("migration 0009 — updated_at on admin tables", () => {
  it("adds updated_at to payments", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(payments)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "updated_at");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'1970-01-01 00:00:00'");
  });

  it("adds updated_at to cars", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "updated_at");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'1970-01-01 00:00:00'");
  });

  it("adds updated_at to people", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "updated_at");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'1970-01-01 00:00:00'");
  });

  it("adds updated_at to settlements", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(settlements)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "updated_at");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'1970-01-01 00:00:00'");
  });

  it("adds updated_at to settings", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(settings)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "updated_at");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'1970-01-01 00:00:00'");
  });

  it("AFTER UPDATE trigger bumps updated_at on cars", () => {
    const db = makeDb();
    db.exec("INSERT INTO people (id, first_name, active) VALUES (1, 'Alice', 1)");
    db.exec("INSERT INTO cars (id, short, name, price_per_km) VALUES (1, 'X', 'Car', 0.3)");
    // Set a known sentinel value then update
    db.exec("UPDATE cars SET updated_at = '1970-01-01 00:00:00' WHERE id = 1");
    db.exec("UPDATE cars SET price_per_km = 0.4 WHERE id = 1");
    const row = db.prepare("SELECT updated_at FROM cars WHERE id = 1").get() as {
      updated_at: string;
    };
    expect(row.updated_at).not.toBe("1970-01-01 00:00:00");
  });

  it("AFTER UPDATE trigger bumps updated_at on people", () => {
    const db = makeDb();
    db.exec("INSERT INTO people (id, first_name, active) VALUES (1, 'Alice', 1)");
    db.exec("UPDATE people SET updated_at = '1970-01-01 00:00:00' WHERE id = 1");
    db.exec("UPDATE people SET discount = 0.1 WHERE id = 1");
    const row = db.prepare("SELECT updated_at FROM people WHERE id = 1").get() as {
      updated_at: string;
    };
    expect(row.updated_at).not.toBe("1970-01-01 00:00:00");
  });
});

describe("migration 0010 — people bank_account", () => {
  it("adds bank_account column to people", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "bank_account");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("''");
  });

  it("bank_account defaults to empty string on insert", () => {
    const db = makeDb();
    db.exec("INSERT INTO people (id, first_name, active) VALUES (1, 'Alice', 1)");
    const row = db.prepare("SELECT bank_account FROM people WHERE id = 1").get() as {
      bank_account: string;
    };
    expect(row.bank_account).toBe("");
  });

  it("bank_account accepts a value", () => {
    const db = makeDb();
    db.exec("INSERT INTO people (id, first_name, active) VALUES (1, 'Alice', 1)");
    db.exec("UPDATE people SET bank_account = 'BE68539007547034' WHERE id = 1");
    const row = db.prepare("SELECT bank_account FROM people WHERE id = 1").get() as {
      bank_account: string;
    };
    expect(row.bank_account).toBe("BE68539007547034");
  });
});
