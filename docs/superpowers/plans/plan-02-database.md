# CarSharing — Plan 02: Database Layer

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Set up SQLite connection singleton, full schema migration, and query modules for all 7 tables.

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

```ts
import type Database from "better-sqlite3";

export function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      korting      REAL    NOT NULL DEFAULT 0,
      korting_long REAL    NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cars (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      short TEXT    NOT NULL UNIQUE,
      name  TEXT    NOT NULL,
      prijs REAL    NOT NULL,
      merk  TEXT,
      kleur TEXT
    );

    CREATE TABLE IF NOT EXISTS ritten (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id    INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      datum     TEXT    NOT NULL,
      start     INTEGER NOT NULL,
      eind      INTEGER NOT NULL,
      km        INTEGER NOT NULL,
      bedrag    REAL    NOT NULL,
      locatie   TEXT
    );

    CREATE TABLE IF NOT EXISTS tankbeurten (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id      INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id         INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      datum          TEXT    NOT NULL,
      bedrag         REAL    NOT NULL,
      liter          REAL    NOT NULL,
      prijs_liter    REAL    NOT NULL,
      kilometerstand INTEGER,
      bonnetje       TEXT
    );

    CREATE TABLE IF NOT EXISTS kosten (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id    INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id       INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      datum        TEXT    NOT NULL,
      bedrag       REAL    NOT NULL,
      omschrijving TEXT
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      car_id     INTEGER NOT NULL REFERENCES cars(id)   ON DELETE RESTRICT,
      start_date TEXT    NOT NULL,
      end_date   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS betaald (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      datum      TEXT    NOT NULL,
      bedrag     REAL    NOT NULL,
      opmerking  TEXT,
      year       INTEGER NOT NULL
    );
  `);
}
```

- [ ] **Step 4: Write failing test**

Create `lib/__tests__/db.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
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
      "betaald", "cars", "kosten", "people", "reservations", "ritten", "tankbeurten"
    ]);
  });

  it("enforces foreign keys", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applySchema(db);
    expect(() =>
      db.prepare("INSERT INTO ritten (person_id,car_id,datum,start,eind,km,bedrag) VALUES (999,999,'2026-01-01',0,0,0,0)").run()
    ).toThrow();
  });
});
```

- [ ] **Step 5: Run test — expect FAIL**

```bash
npm test lib/__tests__/db.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 6: Run test — expect PASS**

```bash
npm test lib/__tests__/db.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/ data/.gitkeep
git commit -m "feat: sqlite connection singleton and schema"
```

---

### Task 2: Seed script

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Create scripts/seed.ts**

```ts
import { getDb } from "../lib/db";

const db = getDb();

const insertPerson = db.prepare(
  "INSERT OR IGNORE INTO people (name, korting, korting_long, active) VALUES (?,?,?,?)"
);
const insertCar = db.prepare(
  "INSERT OR IGNORE INTO cars (short, name, prijs, merk, kleur) VALUES (?,?,?,?,?)"
);

db.transaction(() => {
  insertPerson.run("Roeland", 0, 0, 1);
  insertPerson.run("Tinne", 0.25, 0.50, 1);
  insertPerson.run("Malvina", 0, 0, 1);
  insertPerson.run("Stefaan", 0, 0, 1);

  insertCar.run("ETH", "Ethel", 0.20, "Fiat Punto", "blauw");
  insertCar.run("JF", "Jean-Francois", 0.20, "Toyota Prius+", "wit");
  insertCar.run("LEW", "Lewis", 0.25, "Mercedes Sprinter", "wit");
})();

console.log("Seed complete");
```

- [ ] **Step 2: Run seed**

```bash
npx tsx scripts/seed.ts
```
Expected: "Seed complete" — no errors.

- [ ] **Step 3: Verify data**

```bash
npx tsx -e "import {getDb} from './lib/db'; const db=getDb(); console.log(db.prepare('SELECT * FROM people').all())"
```
Expected: array with 4 people.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "chore: add seed script with initial people and cars"
```
