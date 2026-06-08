import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import path from "path";
import { runMigrations } from "../lib/db/migrate.js";
import { calcTripAmount, calcPricePerLiter } from "../lib/formulas.js";
import { getSettlement } from "../lib/queries/settlement.js";
import { shortNameOf } from "../lib/person-utils.js";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "carsharing.db");
mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);

// ── Seeded RNG ────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xdeadbeef);
const rand = (min: number, max: number) => min + rng() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: readonly T[] | T[]): T => arr[Math.floor(rng() * arr.length)];

// ── Static data ───────────────────────────────────────────────────────────────

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

const PEOPLE = [
  {
    first_name: "Admin",
    last_name: "One",
    username: "admin",
    password: "admin",
    is_admin: 1,
    discount: 0,
    discount_long: 0,
    bank_account: "BE00 0000 0000 0001",
    email: "admin@demo.local",
  },
  {
    first_name: "Owner",
    last_name: "Two",
    username: "owner",
    password: "owner",
    is_admin: 0,
    discount: 0,
    discount_long: 0,
    bank_account: "BE00 0000 0000 0002",
    email: "owner@demo.local",
  },
  {
    first_name: "Alice",
    last_name: "Smith",
    username: "alice",
    password: "alice",
    is_admin: 0,
    discount: 0,
    discount_long: 0,
    bank_account: "BE00 0000 0000 0003",
    email: "alice@demo.local",
  },
  {
    first_name: "Bob",
    last_name: "Jones",
    username: "bob",
    password: "bob",
    is_admin: 0,
    discount: 0.25,
    discount_long: 0.5,
    bank_account: "BE00 0000 0000 0004",
    email: "bob@demo.local",
  },
  {
    first_name: "Carol",
    last_name: "Brown",
    username: "carol",
    password: "carol",
    is_admin: 0,
    discount: 0.25,
    discount_long: 0.5,
    bank_account: "BE00 0000 0000 0005",
    email: "carol@demo.local",
  },
] as const;

const CARS = [
  {
    short: "AA",
    name: "Car AA",
    price_per_km: 0.28,
    owner_username: "admin",
    start_odometer: 45000,
    active: 1,
  },
  {
    short: "BB",
    name: "Car BB",
    price_per_km: 0.3,
    owner_username: "owner",
    start_odometer: 30000,
    active: 1,
  },
  {
    short: "CC",
    name: "Car CC",
    price_per_km: 0.26,
    owner_username: "admin",
    start_odometer: 62000,
    active: 1,
  },
  {
    short: "DD",
    name: "Car DD",
    price_per_km: 0.32,
    owner_username: "owner",
    start_odometer: 15000,
    active: 0,
  },
] as const;

const LOCATIONS = [
  "Antwerpen",
  "Gent",
  "Brussel",
  "Leuven",
  "Mechelen",
  "Hasselt",
  "Turnhout",
  "Herentals",
  "Mol",
  "Aarschot",
];

const EXPENSE_CATEGORIES = ["maintenance", "repair", "insurance"] as const;
const EXPENSE_DESCRIPTIONS: Record<string, string[]> = {
  maintenance: ["Oil change", "Tire rotation", "Air filter", "Brake inspection"],
  repair: ["Windshield repair", "Battery replacement", "Wiper blades", "Coolant flush"],
  insurance: ["Annual premium", "Third-party top-up", "Roadside assistance"],
};

// ── 1. People ─────────────────────────────────────────────────────────────────

console.log("Seeding people...");

const insertPerson = db.prepare(`
  INSERT OR IGNORE INTO people
    (first_name, last_name, username, password_hash, is_admin, discount, discount_long, bank_account, email, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const updatePerson = db.prepare(`
  UPDATE people SET first_name = ?, last_name = ?, is_admin = ?, discount = ?, discount_long = ?, bank_account = ?, email = ? WHERE username = ?
`);

db.transaction(() => {
  for (const p of PEOPLE) {
    const hash = bcrypt.hashSync(p.password, 10);
    insertPerson.run(
      p.first_name,
      p.last_name,
      p.username,
      hash,
      p.is_admin,
      p.discount,
      p.discount_long,
      p.bank_account,
      p.email
    );
    updatePerson.run(
      p.first_name,
      p.last_name,
      p.is_admin,
      p.discount,
      p.discount_long,
      p.bank_account,
      p.email,
      p.username
    );
  }
})();

const getPersonByUsername = db.prepare("SELECT id FROM people WHERE username = ?");
const personIdByUsername: Record<string, number> = {};
for (const p of PEOPLE) {
  const row = getPersonByUsername.get(p.username) as { id: number };
  personIdByUsername[p.username] = row.id;
}

// Build discount lookup map: person id → {discount, discount_long}
const personDiscounts = new Map<number, { discount: number; discount_long: number }>();
for (const p of PEOPLE) {
  personDiscounts.set(personIdByUsername[p.username], {
    discount: p.discount,
    discount_long: p.discount_long,
  });
}

console.log(`  → ${PEOPLE.length} people`);

// ── 2. Cars ───────────────────────────────────────────────────────────────────

console.log("Seeding cars...");

const insertCar = db.prepare(`
  INSERT OR IGNORE INTO cars (short, name, price_per_km, owner_person_id, owner_from, active)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateCar = db.prepare(`
  UPDATE cars SET name = ?, price_per_km = ?, owner_person_id = ?, owner_from = ?, active = ? WHERE short = ?
`);

const OWNER_FROM = "2020-01-01";

db.transaction(() => {
  for (const c of CARS) {
    const ownerId = personIdByUsername[c.owner_username];
    insertCar.run(c.short, c.name, c.price_per_km, ownerId, OWNER_FROM, c.active);
    updateCar.run(c.name, c.price_per_km, ownerId, OWNER_FROM, c.active, c.short);
  }
})();

const getCarByShort = db.prepare("SELECT id FROM cars WHERE short = ?");
const carIdByShort: Record<string, number> = {};
const carOdometer: Record<string, number> = {};
for (const c of CARS) {
  const row = getCarByShort.get(c.short) as { id: number };
  carIdByShort[c.short] = row.id;
  if (c.active) {
    const existing = db
      .prepare("SELECT MAX(end_odometer) AS max_odo FROM trips WHERE car_id = ?")
      .get(row.id) as { max_odo: number | null };
    carOdometer[c.short] = existing.max_odo ?? c.start_odometer;
  }
}

const ACTIVE_CARS = CARS.filter((c) => c.active !== 0);
console.log(`  → ${CARS.length} cars (${ACTIVE_CARS.length} active)`);

// ── Price per litre drift table ───────────────────────────────────────────────

function buildPriceTable(): Map<string, number> {
  const prices = new Map<string, number>();
  let price = 1.85;
  for (const year of YEARS) {
    for (let month = 1; month <= 12; month++) {
      const step = (rng() - 0.5) * 0.1;
      price = Math.max(1.5, Math.min(2.5, price + step));
      prices.set(`${year}-${String(month).padStart(2, "0")}`, +price.toFixed(4));
    }
  }
  return prices;
}

const priceTable = buildPriceTable();

function priceForDate(dateStr: string): number {
  const ym = dateStr.slice(0, 7);
  return priceTable.get(ym) ?? 1.85;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function randomDateInMonth(year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = randInt(1, daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function datesSpreadAcrossYear(year: number, count: number): string[] {
  const dates: string[] = [];
  const base = Math.floor(count / 12);
  const extra = count % 12;
  for (let m = 1; m <= 12; m++) {
    const n = base + (m <= extra ? 1 : 0);
    for (let i = 0; i < n; i++) dates.push(randomDateInMonth(year, m));
  }
  return dates.sort();
}

// ── 3. Trips ──────────────────────────────────────────────────────────────────

console.log("Seeding trips...");

const checkTrips = db.prepare(
  "SELECT COUNT(*) AS n FROM trips WHERE car_id = ? AND date LIKE ? || '%'"
);
const insertTrip = db.prepare(`
  INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let tripsTotal = 0;
const peopleIds = Object.values(personIdByUsername);

for (const car of ACTIVE_CARS) {
  const carId = carIdByShort[car.short];
  for (const year of YEARS) {
    const existing = (checkTrips.get(carId, String(year)) as { n: number }).n;
    if (existing > 0) continue;

    const TARGET_KM = randInt(5000, 10000);
    const dates = datesSpreadAcrossYear(year, 50);
    let kmBudget = TARGET_KM;

    db.transaction(() => {
      for (let i = 0; i < dates.length; i++) {
        const remaining = dates.length - i;
        const maxKm = Math.min(250, Math.floor((kmBudget / remaining) * 1.5));
        const minKm = Math.max(80, Math.floor((kmBudget / remaining) * 0.5));
        const km = Math.max(1, Math.min(maxKm, randInt(Math.min(minKm, maxKm), maxKm)));

        const personId = peopleIds[Math.floor(rng() * peopleIds.length)];
        const person = personDiscounts.get(personId)!;
        const amount = calcTripAmount(km, car.price_per_km, person.discount, person.discount_long);

        const start_odometer = carOdometer[car.short];
        const end_odometer = start_odometer + km;
        carOdometer[car.short] = end_odometer;
        kmBudget -= km;

        insertTrip.run(
          personId,
          carId,
          dates[i],
          start_odometer,
          end_odometer,
          km,
          +amount.toFixed(2),
          pick(LOCATIONS)
        );
      }
    })();
    tripsTotal += dates.length;
  }
}

console.log(`  → ${tripsTotal} trips`);

// ── 4. Fuel fill-ups ──────────────────────────────────────────────────────────

console.log("Seeding fuel fill-ups...");

const checkFuel = db.prepare(
  "SELECT COUNT(*) AS n FROM fuel_fillups WHERE car_id = ? AND date LIKE ? || '%'"
);
const insertFuel = db.prepare(`
  INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let fuelTotal = 0;

for (const car of ACTIVE_CARS) {
  const carId = carIdByShort[car.short];
  for (const year of YEARS) {
    const existing = (checkFuel.get(carId, String(year)) as { n: number }).n;
    if (existing > 0) continue;

    const TARGET_LITERS = 700;
    const dates = datesSpreadAcrossYear(year, 20);
    let litersBudget = TARGET_LITERS;

    db.transaction(() => {
      for (let i = 0; i < dates.length; i++) {
        const remaining = dates.length - i;
        const avgNeeded = litersBudget / remaining;
        const liters = +Math.max(10, Math.min(45, rand(avgNeeded * 0.8, avgNeeded * 1.2))).toFixed(
          1
        );
        const ppl = priceForDate(dates[i]);
        const amount = +(liters * ppl).toFixed(2);
        const price_per_liter = +calcPricePerLiter(amount, liters).toFixed(4);
        const personId = peopleIds[Math.floor(rng() * peopleIds.length)];
        litersBudget -= liters;

        insertFuel.run(personId, carId, dates[i], amount, liters, price_per_liter);
      }
    })();
    fuelTotal += dates.length;
  }
}

console.log(`  → ${fuelTotal} fuel fill-ups`);

// ── 5. Expenses ───────────────────────────────────────────────────────────────

console.log("Seeding expenses...");

const checkExpenses = db.prepare(
  "SELECT COUNT(*) AS n FROM expenses WHERE car_id = ? AND date LIKE ? || '%'"
);
const insertExpense = db.prepare(`
  INSERT INTO expenses (person_id, car_id, date, amount, description, category)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let expensesTotal = 0;

for (const car of ACTIVE_CARS) {
  const carId = carIdByShort[car.short];
  for (const year of YEARS) {
    const existing = (checkExpenses.get(carId, String(year)) as { n: number }).n;
    if (existing > 0) continue;

    const count = randInt(1, 3);
    db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const category = pick(EXPENSE_CATEGORIES);
        const description = pick(EXPENSE_DESCRIPTIONS[category]);
        const amount = +rand(50, 500).toFixed(2);
        const date = randomDateInMonth(year, randInt(1, 12));
        const personId = peopleIds[Math.floor(rng() * peopleIds.length)];
        insertExpense.run(personId, carId, date, amount, description, category);
      }
    })();
    expensesTotal += count;
  }
}

console.log(`  → ${expensesTotal} expenses`);

// ── Odometer gap for AA (shows in admin inbox) ────────────────────────────────
{
  const lastTrip = db
    .prepare("SELECT end_odometer FROM trips WHERE car_id = ? ORDER BY date DESC, id DESC LIMIT 1")
    .get(carIdByShort["AA"]) as { end_odometer: number } | undefined;
  if (lastTrip) {
    const gapStart = lastTrip.end_odometer + 300;
    const alreadyExists = db
      .prepare("SELECT 1 FROM trips WHERE car_id = ? AND start_odometer = ?")
      .get(carIdByShort["AA"], gapStart);
    if (!alreadyExists) {
      db.prepare(
        `
        INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
        VALUES (?, ?, '2026-12-30', ?, ?, 85, 23.80, 'Turnhout')
      `
      ).run(personIdByUsername["alice"], carIdByShort["AA"], gapStart, gapStart + 85);
    }
  }
}

// ── 5b. Out-of-date-order trips for BB (proves odometer sort) ────────────────
// Two trips where date order ≠ odometer order.
// Old sort (date DESC) would show Jan-15 first → start=X before end=X+120 of Jan-10 → broken.
// New sort (start_odometer DESC) shows Jan-10 trip first → correct chain.
{
  const bbId = carIdByShort["BB"];
  const aliceId = personIdByUsername["alice"];
  const lastBB = db
    .prepare("SELECT end_odometer FROM trips WHERE car_id = ? ORDER BY start_odometer DESC LIMIT 1")
    .get(bbId) as { end_odometer: number } | undefined;
  if (lastBB) {
    const base = lastBB.end_odometer + 50;
    const alreadyExists = db
      .prepare("SELECT 1 FROM trips WHERE car_id = ? AND start_odometer = ?")
      .get(bbId, base);
    if (!alreadyExists) {
      // Trip entered late: date=Jan-10 but odometer continues after Jan-15 trip
      db.prepare(
        `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
         VALUES (?, ?, '2027-01-15', ?, ?, 120, 36.00, 'Leuven')`
      ).run(aliceId, bbId, base, base + 120);
      db.prepare(
        `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
         VALUES (?, ?, '2027-01-10', ?, ?, 200, 60.00, 'Mechelen')`
      ).run(aliceId, bbId, base + 120, base + 320);
    }
  }
}

// ── 5c. Duplicate trips (proves duplicate-detection feature) ─────────────────
// Insert 2 pairs of trips with identical person+car+odometer range.
{
  const aaId = carIdByShort["AA"];
  const bbId = carIdByShort["BB"];
  const aliceId = personIdByUsername["alice"];
  const ownerIdVal = personIdByUsername["owner"];

  // Pair 1: Alice on AA — same range entered twice on different dates
  const p1Exists = db
    .prepare("SELECT 1 FROM trips WHERE car_id = ? AND person_id = ? AND start_odometer = ? AND end_odometer = ?")
    .get(aaId, aliceId, 9000, 9080);
  if (!p1Exists) {
    db.prepare(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
       VALUES (?, ?, '2025-03-12', 9000, 9080, 80, 24.00, 'Gent')`
    ).run(aliceId, aaId);
    db.prepare(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
       VALUES (?, ?, '2025-03-13', 9000, 9080, 80, 24.00, 'Gent (dup)')`
    ).run(aliceId, aaId);
  }

  // Pair 2: Owner on BB — same range, different dates
  const p2Exists = db
    .prepare("SELECT 1 FROM trips WHERE car_id = ? AND person_id = ? AND start_odometer = ? AND end_odometer = ?")
    .get(bbId, ownerIdVal, 8800, 8950);
  if (!p2Exists) {
    db.prepare(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
       VALUES (?, ?, '2025-04-05', 8800, 8950, 150, 45.00, 'Antwerpen')`
    ).run(ownerIdVal, bbId);
    db.prepare(
      `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
       VALUES (?, ?, '2025-04-06', 8800, 8950, 150, 45.00, 'Antwerpen (dup)')`
    ).run(ownerIdVal, bbId);
  }
}

// ── 6. Payments ───────────────────────────────────────────────────────────────
// 2023: all transfers fully paid (settlement will be finalized).
// 2024: all transfers paid EXCEPT Owner — they still have an outstanding balance.

console.log("Seeding payments...");

const deletePaymentsByYear = db.prepare("DELETE FROM payments WHERE year = ?");
const insertPayment = db.prepare(
  "INSERT INTO payments (person_id, date, amount, note, year) VALUES (?, ?, ?, ?, ?)"
);

interface PersonRow {
  id: number;
  first_name: string;
  last_name: string;
  username: string | null;
}
const allPeople = db
  .prepare("SELECT id, first_name, last_name, username FROM people")
  .all() as PersonRow[];
const personByShort = new Map<string, number>(allPeople.map((p) => [shortNameOf(p), p.id]));
const ownerPersonId = personIdByUsername["owner"];

let paymentsTotal = 0;

for (const { year, skipPersonIds } of [
  { year: 2023, skipPersonIds: new Set<number>() },
  { year: 2024, skipPersonIds: new Set([ownerPersonId]) },
]) {
  deletePaymentsByYear.run(year);
  const settlement = getSettlement(db, year);
  const payDate = `${year + 1}-02-15`;

  db.transaction(() => {
    for (const transfer of settlement.transfers) {
      if (transfer.payment_status === null) continue;
      const personName = transfer.from === "co-op" ? transfer.to : transfer.from;
      const personId = personByShort.get(personName);
      if (!personId) continue;
      if (skipPersonIds.has(personId)) continue;
      // Positive = person pays co-op; negative = co-op pays person.
      // Step 2 (owner transfers) uses abs(sum), so sign doesn't matter for them.
      const amount = transfer.from === "co-op" ? -transfer.amount : transfer.amount;
      insertPayment.run(personId, payDate, +amount.toFixed(2), null, year);
      paymentsTotal++;
    }
  })();
}

console.log(`  → ${paymentsTotal} payments`);

// ── 7. Settlements + settings ─────────────────────────────────────────────────

console.log("Seeding settlements and settings...");

db.prepare(
  `
  INSERT OR IGNORE INTO settlements (year, settled_at, settled_by) VALUES
  (2021, '2022-02-01T10:00:00', 'admin'),
  (2022, '2023-02-01T10:00:00', 'admin'),
  (2023, '2024-02-01T10:00:00', 'admin')
`
).run();
// 2024 is intentionally left open so screenshots show an active settlement
db.prepare("DELETE FROM settlements WHERE year = 2024").run();

db.prepare(
  `
  INSERT OR IGNORE INTO settings (key, value)
  VALUES ('coop_bank_account', 'BE00 0000 0000 0000')
`
).run();

// ── Reservations (for screenshots) ─────────────────────────────────────────
const aliceId = personIdByUsername["alice"];
const carolId = personIdByUsername["carol"];
db.prepare("DELETE FROM reservations WHERE status IN ('pending', 'confirmed')").run();
db.prepare(
  `
  INSERT INTO reservations (person_id, car_id, start_date, end_date, start_time, end_time, status, note)
  VALUES
    (?, ?, '2026-05-15', '2026-05-17', NULL,    NULL,    'pending',   'Weekend trip to Ghent'),
    (?, ?, '2026-05-20', '2026-05-25', NULL,    NULL,    'confirmed', 'Family visit'),
    (?, ?, '2026-06-01', '2026-06-04', NULL,    NULL,    'confirmed', 'School run week'),
    (?, ?, '2026-05-18', '2026-05-18', '09:00', '12:30', 'pending',   'Morning errands (half day)')
`
).run(
  aliceId,
  carIdByShort["AA"],
  personIdByUsername["bob"],
  carIdByShort["BB"],
  carolId,
  carIdByShort["CC"],
  aliceId,
  carIdByShort["AA"]
);

// ── Summary ───────────────────────────────────────────────────────────────────

const counts = {
  people: (db.prepare("SELECT COUNT(*) AS n FROM people").get() as { n: number }).n,
  cars: (db.prepare("SELECT COUNT(*) AS n FROM cars").get() as { n: number }).n,
  trips: (db.prepare("SELECT COUNT(*) AS n FROM trips").get() as { n: number }).n,
  fuel: (db.prepare("SELECT COUNT(*) AS n FROM fuel_fillups").get() as { n: number }).n,
  expenses: (db.prepare("SELECT COUNT(*) AS n FROM expenses").get() as { n: number }).n,
  payments: (db.prepare("SELECT COUNT(*) AS n FROM payments").get() as { n: number }).n,
  settlements: (db.prepare("SELECT COUNT(*) AS n FROM settlements").get() as { n: number }).n,
  reservations: (db.prepare("SELECT COUNT(*) AS n FROM reservations").get() as { n: number }).n,
};

console.log("\n✅ Demo seed complete:");
console.table(counts);
console.log("\nLogin: admin / admin  (or owner/owner, alice/alice, bob/bob, carol/carol)");
