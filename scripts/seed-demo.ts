import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { mkdirSync } from "fs";
import path from "path";
import { runMigrations } from "../lib/db/migrate.js";
import { calcTripAmount, calcPricePerLiter } from "../lib/formulas.js";

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
  { name: "Admin One", username: "admin", password: "admin", is_admin: 1, discount: 0, discount_long: 0, bank_account: "BE00 0000 0000 0001", email: "admin@demo.local" },
  { name: "Owner Two", username: "owner", password: "owner", is_admin: 0, discount: 0, discount_long: 0, bank_account: "BE00 0000 0000 0002", email: "owner@demo.local" },
  { name: "Alice Smith", username: "alice", password: "alice", is_admin: 0, discount: 0, discount_long: 0, bank_account: "BE00 0000 0000 0003", email: "alice@demo.local" },
  { name: "Bob Jones", username: "bob", password: "bob", is_admin: 0, discount: 0.25, discount_long: 0.50, bank_account: "BE00 0000 0000 0004", email: "bob@demo.local" },
  { name: "Carol Brown", username: "carol", password: "carol", is_admin: 0, discount: 0.25, discount_long: 0.50, bank_account: "BE00 0000 0000 0005", email: "carol@demo.local" },
] as const;

const CARS = [
  { short: "AA", name: "Car AA", price_per_km: 0.28, owner_username: "admin", start_odometer: 45000, active: 1 },
  { short: "BB", name: "Car BB", price_per_km: 0.30, owner_username: "owner", start_odometer: 30000, active: 1 },
  { short: "CC", name: "Car CC", price_per_km: 0.26, owner_username: "admin", start_odometer: 62000, active: 1 },
  { short: "DD", name: "Car DD", price_per_km: 0.32, owner_username: "owner", start_odometer: 15000, active: 0 },
] as const;

const LOCATIONS = [
  "Antwerpen", "Gent", "Brussel", "Leuven", "Mechelen",
  "Hasselt", "Turnhout", "Herentals", "Mol", "Aarschot",
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
    (name, username, password_hash, is_admin, discount, discount_long, bank_account, email, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const updatePerson = db.prepare(`
  UPDATE people SET name = ?, is_admin = ?, discount = ?, discount_long = ?, bank_account = ?, email = ? WHERE username = ?
`);

db.transaction(() => {
  for (const p of PEOPLE) {
    const hash = bcrypt.hashSync(p.password, 10);
    insertPerson.run(p.name, p.username, hash, p.is_admin, p.discount, p.discount_long, p.bank_account, p.email);
    updatePerson.run(p.name, p.is_admin, p.discount, p.discount_long, p.bank_account, p.email, p.username);
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
  personDiscounts.set(personIdByUsername[p.username], { discount: p.discount, discount_long: p.discount_long });
}

console.log(`  → ${PEOPLE.length} people`);

// ── 2. Cars ───────────────────────────────────────────────────────────────────

console.log("Seeding cars...");

const insertCar = db.prepare(`
  INSERT OR IGNORE INTO cars (short, name, price_per_km, owner_person_id, owner_name, owner_from, active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateCar = db.prepare(`
  UPDATE cars SET name = ?, price_per_km = ?, owner_person_id = ?, owner_name = ?, owner_from = ?, active = ? WHERE short = ?
`);

const OWNER_FROM = "2020-01-01";

db.transaction(() => {
  for (const c of CARS) {
    const ownerId = personIdByUsername[c.owner_username];
    const ownerName = PEOPLE.find(p => p.username === c.owner_username)?.name ?? null;
    insertCar.run(c.short, c.name, c.price_per_km, ownerId, ownerName, OWNER_FROM, c.active);
    updateCar.run(c.name, c.price_per_km, ownerId, ownerName, OWNER_FROM, c.active, c.short);
  }
})();

const getCarByShort = db.prepare("SELECT id FROM cars WHERE short = ?");
const carIdByShort: Record<string, number> = {};
const carOdometer: Record<string, number> = {};
for (const c of CARS) {
  const row = getCarByShort.get(c.short) as { id: number };
  carIdByShort[c.short] = row.id;
  if (c.active) {
    const existing = db.prepare(
      "SELECT MAX(end_odometer) AS max_odo FROM trips WHERE car_id = ?"
    ).get(row.id) as { max_odo: number | null };
    carOdometer[c.short] = existing.max_odo ?? c.start_odometer;
  }
}

const ACTIVE_CARS = CARS.filter(c => c.active !== 0);
console.log(`  → ${CARS.length} cars (${ACTIVE_CARS.length} active)`);

// ── Price per litre drift table ───────────────────────────────────────────────

function buildPriceTable(): Map<string, number> {
  const prices = new Map<string, number>();
  let price = 1.85;
  for (const year of YEARS) {
    for (let month = 1; month <= 12; month++) {
      const step = (rng() - 0.5) * 0.10;
      price = Math.max(1.50, Math.min(2.50, price + step));
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

        insertTrip.run(personId, carId, dates[i], start_odometer, end_odometer, km, +amount.toFixed(2), pick(LOCATIONS));
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
        const liters = +Math.max(10, Math.min(45, rand(avgNeeded * 0.8, avgNeeded * 1.2))).toFixed(1);
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
  const lastTrip = db.prepare(
    "SELECT end_odometer FROM trips WHERE car_id = ? ORDER BY date DESC, id DESC LIMIT 1"
  ).get(carIdByShort["AA"]) as { end_odometer: number } | undefined;
  if (lastTrip) {
    const gapStart = lastTrip.end_odometer + 300;
    const alreadyExists = db.prepare(
      "SELECT 1 FROM trips WHERE car_id = ? AND start_odometer = ?"
    ).get(carIdByShort["AA"], gapStart);
    if (!alreadyExists) {
      db.prepare(`
        INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
        VALUES (?, ?, '2026-12-30', ?, ?, 85, 23.80, 'Turnhout')
      `).run(personIdByUsername["alice"], carIdByShort["AA"], gapStart, gapStart + 85);
    }
  }
}

// ── 6. Payments ───────────────────────────────────────────────────────────────

console.log("Seeding payments...");
function getPersonYearBalance(personId: number, year: number): number {
  const trips = (sumTripsByPersonYear.get(personId, String(year)) as { t: number }).t;
  const fuel = (sumFuelByPersonYear.get(personId, String(year)) as { t: number }).t;
  const expenses = (sumExpensesByPersonYear.get(personId, String(year)) as { t: number }).t;
  return -trips + fuel + expenses;
}

const sumTripsByPersonYear = db.prepare(
  "SELECT COALESCE(SUM(amount), 0) AS t FROM trips WHERE person_id = ? AND date LIKE ? || '%'"
);
const sumFuelByPersonYear = db.prepare(
  "SELECT COALESCE(SUM(amount), 0) AS t FROM fuel_fillups WHERE person_id = ? AND date LIKE ? || '%'"
);
const sumExpensesByPersonYear = db.prepare(
  "SELECT COALESCE(SUM(amount), 0) AS t FROM expenses WHERE person_id = ? AND date LIKE ? || '%'"
);

const checkPayments = db.prepare(
  "SELECT COUNT(*) AS n FROM payments WHERE person_id = ? AND year = ?"
);
const insertPayment = db.prepare(`
  INSERT INTO payments (person_id, date, amount, note, year)
  VALUES (?, ?, ?, ?, ?)
`);

const aliceId = personIdByUsername["alice"];
const carolId = personIdByUsername["carol"];
let paymentsTotal = 0;

for (const year of YEARS) {
  if (year === 2025) continue;
  const existing = (checkPayments.get(aliceId, year) as { n: number }).n;
  if (existing > 0) continue;

  const balance = getPersonYearBalance(aliceId, year);
  if (balance >= 0) continue;

  const installment = +(-balance / 10).toFixed(2);
  db.transaction(() => {
    for (let month = 1; month <= 10; month++) {
      const date = `${year + 1}-${String(month).padStart(2, "0")}-15`;
      insertPayment.run(aliceId, date, installment, `Payment ${month}/10`, year);
    }
  })();
  paymentsTotal += 10;
}

for (const username of ["bob", "carol"] as const) {
  const personId = personIdByUsername[username];
  for (const year of YEARS) {
    if (year === 2025) continue;
    const existing = (checkPayments.get(personId, year) as { n: number }).n;
    if (existing > 0) continue;

    const balance = getPersonYearBalance(personId, year);
    if (balance >= 0) continue;

    const payCount = randInt(1, 2);
    const totalToPay = +(-balance * rand(0.60, 0.80)).toFixed(2);
    const perInstallment = +(totalToPay / payCount).toFixed(2);
    db.transaction(() => {
      for (let i = 0; i < payCount; i++) {
        const month = randInt(1, 6);
        const date = `${year + 1}-${String(month).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
        insertPayment.run(personId, date, perInstallment, null, year);
      }
    })();
    paymentsTotal += payCount;
  }
}

console.log(`  → ${paymentsTotal} payments`);

// ── 7. Settlements + settings ─────────────────────────────────────────────────

console.log("Seeding settlements and settings...");

db.prepare(`
  INSERT OR IGNORE INTO settlements (year, settled_at, settled_by) VALUES
  (2021, '2022-02-01T10:00:00', 'admin'),
  (2022, '2023-02-01T10:00:00', 'admin'),
  (2023, '2024-02-01T10:00:00', 'admin'),
  (2024, '2025-02-01T10:00:00', 'admin')
`).run();

db.prepare(`
  INSERT OR IGNORE INTO settings (key, value)
  VALUES ('coop_bank_account', 'BE00 0000 0000 0000')
`).run();

// ── Pending reservations (for inbox screenshot) ────────────────────────────
db.prepare("DELETE FROM reservations WHERE status = 'pending'").run();
db.prepare(`
  INSERT INTO reservations (person_id, car_id, start_date, end_date, status, note)
  VALUES
    (?, ?, '2026-05-15', '2026-05-17', 'pending', 'Weekend trip to Ghent'),
    (?, ?, '2026-05-20', '2026-05-25', 'pending', 'Family visit'),
    (?, ?, '2026-06-01', '2026-06-04', 'pending', 'School run week')
`).run(
  aliceId,  carIdByShort["AA"],
  personIdByUsername["bob"],  carIdByShort["BB"],
  carolId,  carIdByShort["CC"]
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
  reservations: (db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'pending'").get() as { n: number }).n,
};

console.log("\n✅ Demo seed complete:");
console.table(counts);
console.log("\nLogin: admin / admin  (or owner/owner, alice/alice, bob/bob, carol/carol)");
