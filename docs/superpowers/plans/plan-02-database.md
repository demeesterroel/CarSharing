# CarSharing — Plan 02: Database Layer

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Set up SQLite connection singleton, full schema migration with English column names, and query modules for all 7 tables.

**Architecture:** `better-sqlite3` runs server-side only. A singleton `db` instance is created once. Schema is applied via `db.exec()` on startup. All queries live in `lib/queries/` — one file per table.

**Tech Stack:** better-sqlite3, TypeScript, Vitest.

---

### Task 1: DB connection singleton

**Files:**
- Create: `lib/db.ts`
- Create: `lib/schema.sql.ts`

- [ ] **Step 1: Create data directory**

```bash
mkdir -p data
echo "data/*.db" >> .gitignore
```

- [ ] **Step 2: Create lib/db.ts**

```ts
import Database from "better-sqlite3";
import path from "path";
import { applySchema } from "./schema.sql";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "autodelen.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    applySchema(_db);
  }
  return _db;
}
```

- [ ] **Step 3: Create lib/schema.sql.ts**

All column names are in English.

```ts
import type Database from "better-sqlite3";

export function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      discount      REAL    NOT NULL DEFAULT 0,
      discount_long REAL    NOT NULL DEFAULT 0,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cars (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      short        TEXT    NOT NULL UNIQUE,
      name         TEXT    NOT NULL,
      price_per_km REAL    NOT NULL,
      brand        TEXT,
      color        TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id      INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id         INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date           TEXT    NOT NULL,
      start_odometer INTEGER NOT NULL,
      end_odometer   INTEGER NOT NULL,
      km             INTEGER NOT NULL,
      amount         REAL    NOT NULL,
      location       TEXT
    );

    CREATE TABLE IF NOT EXISTS fuel_fillups (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id          INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date            TEXT    NOT NULL,
      amount          REAL    NOT NULL,
      liters          REAL    NOT NULL,
      price_per_liter REAL    NOT NULL,
      odometer        INTEGER,
      receipt         TEXT,
      location        TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id      INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      date        TEXT    NOT NULL,
      amount      REAL    NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id     INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      start_date TEXT    NOT NULL,
      end_date   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      date      TEXT    NOT NULL,
      amount    REAL    NOT NULL,
      note      TEXT,
      year      INTEGER NOT NULL
    );
  `);
}
```

- [ ] **Step 4: Write failing test**

Create `lib/__tests__/db.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applySchema } from "../schema.sql";

describe("applySchema", () => {
  it("creates all 7 tables", () => {
    const db = new Database(":memory:");
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual([
      "cars", "expenses", "fuel_fillups", "payments", "people", "reservations", "trips"
    ]);
  });

  it("enforces foreign keys", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchema(db);
    expect(() =>
      db.prepare(
        "INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount) VALUES (999,999,'2026-01-01',0,0,0,0)"
      ).run()
    ).toThrow();
  });
});
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npm test lib/__tests__/db.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ data/.gitkeep
git commit -m "feat: sqlite connection singleton and english schema"
```

---

### Task 2: Seed from exported data

**Files:**
- Create: `scripts/seed.ts`

See **plan-02b-seed.md** for the full seed script that imports all historical data from `docs/data/car_sharing.json`.
