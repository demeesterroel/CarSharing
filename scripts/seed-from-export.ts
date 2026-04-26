import Database from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";
import { runMigrations } from "../lib/db/migrate.js";
import { calcTripAmount, calcPricePerLiter, calcPaymentYear } from "../lib/formulas.js";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "autodelen.db");
const JSON_PATH = path.join(process.cwd(), "docs", "data", "car_sharing.json");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
runMigrations(db);

const data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

// ── 1. Cars ──────────────────────────────────────────────────────────────────

const carNameMap: Record<string, number> = {}; // fullname → id

const carsToInsert = [
  ...data.cars.map((c: any) => ({
    short: c.short,
    name: c.name.trim(),
    price_per_km: c.prijs,
    brand: c.merk ?? null,
    color: c.kleur ?? null,
  })),
  // Bessy is an old car referenced in historical trips but not in the cars export
  { short: "BSY", name: "Bessy", price_per_km: 0.20, brand: null, color: null },
];

const insertCar = db.prepare(
  "INSERT OR IGNORE INTO cars (short, name, price_per_km, brand, color) VALUES (?,?,?,?,?)"
);
const getCarByName = db.prepare("SELECT id FROM cars WHERE name=?");
const getCarByShort = db.prepare("SELECT id FROM cars WHERE short=?");

db.transaction(() => {
  for (const car of carsToInsert) {
    insertCar.run(car.short, car.name, car.price_per_km, car.brand, car.color);
  }
})();

// Build name → id lookup (strip trailing spaces)
for (const car of carsToInsert) {
  const row = getCarByShort.get(car.short) as any;
  if (row) carNameMap[car.name] = row.id;
}
// Also map by short code
for (const car of carsToInsert) {
  const row = getCarByShort.get(car.short) as any;
  if (row) carNameMap[car.short] = row.id;
}

console.log(`Cars inserted: ${Object.keys(carNameMap).length / 2}`);

// ── 2. People ────────────────────────────────────────────────────────────────

const personNameMap: Record<string, number> = {}; // name → id

// Collect all unique person names from all tables
const allNames = new Set<string>();
const nameAlias: Record<string, string> = { "Roel": "Roeland" };

for (const table of [data.trips, data.fuel_fillups, data.expenses, data.payments]) {
  for (const row of table) {
    const name = (row.Naam || row.Name || "").trim();
    if (name) allNames.add(nameAlias[name] ?? name);
  }
}
// Add people from people table
for (const p of data.people) {
  allNames.add(p.name.trim());
}

// Build a map of name → {discount, discount_long, active} from people table
const peopleDefaults: Record<string, { discount: number; discount_long: number; active: number }> = {};
for (const p of data.people) {
  peopleDefaults[p.name.trim()] = {
    discount: p.korting ?? 0,
    discount_long: p.korting_long ?? 0,
    active: p.Active ? 1 : 0,
  };
}

const insertPerson = db.prepare(
  "INSERT OR IGNORE INTO people (name, discount, discount_long, active) VALUES (?,?,?,?)"
);
const getPersonByName = db.prepare("SELECT id FROM people WHERE name=?");

db.transaction(() => {
  for (const name of Array.from(allNames).sort()) {
    const defaults = peopleDefaults[name] ?? { discount: 0, discount_long: 0, active: 0 };
    insertPerson.run(name, defaults.discount, defaults.discount_long, defaults.active);
  }
})();

// Build name → id lookup
for (const name of allNames) {
  const row = getPersonByName.get(name) as any;
  if (row) personNameMap[name] = row.id;
}
// Also map aliases
for (const [alias, canonical] of Object.entries(nameAlias)) {
  if (personNameMap[canonical]) personNameMap[alias] = personNameMap[canonical];
}

console.log(`People inserted: ${Object.keys(personNameMap).length}`);

// ── Helper: resolve car name from data rows ───────────────────────────────────

function resolveCarId(wagenName: string): number | null {
  const name = wagenName?.trim();
  return carNameMap[name] ?? null;
}

function resolvePersonId(naam: string): number | null {
  const name = (nameAlias[naam?.trim()] ?? naam?.trim());
  return personNameMap[name] ?? null;
}

// ── 3. Trips ─────────────────────────────────────────────────────────────────

let tripsSkipped = 0;
let tripsInserted = 0;

const insertTrip = db.prepare(`
  INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
  VALUES (?,?,?,?,?,?,?,?)
`);

db.transaction(() => {
  for (let idx = 0; idx < data.trips.length; idx++) {
    const row = data.trips[idx];
    const person_id = resolvePersonId(row.Naam);
    const car_id = resolveCarId(row.Wagen);

    if (!person_id || !car_id) {
      console.warn(`SKIP trip: cannot resolve person="${row.Naam}" or car="${row.Wagen}"`);
      tripsSkipped++;
      continue;
    }

    const start_odometer = Math.round(row.start ?? 0);
    const end_odometer = Math.round(row.eind ?? 0);
    const km = Math.round(row.Kilometers ?? (end_odometer - start_odometer));

    // Validate km
    if (!Number.isFinite(km)) {
      console.warn(`SKIP trip ${idx}: invalid km=${km} (Kilometers=${row.Kilometers}, start=${row.start}, eind=${row.eind})`);
      tripsSkipped++;
      continue;
    }

    // Re-compute amount using the formula; fall back to exported value if person has no discount data
    const person = db.prepare("SELECT discount, discount_long FROM people WHERE id=?").get(person_id) as any;
    const car = db.prepare("SELECT price_per_km FROM cars WHERE id=?").get(car_id) as any;
    const amount = row["Manueel bedrag"] != null
      ? row["Manueel bedrag"]
      : calcTripAmount(km, car.price_per_km, person.discount, person.discount_long);

    const date = (row.datum ?? "").slice(0, 10);
    const location = row.Locatie ?? null;

    insertTrip.run(person_id, car_id, date, start_odometer, end_odometer, km, amount, location);
    tripsInserted++;
  }
})();

console.log(`Trips: ${tripsInserted} inserted, ${tripsSkipped} skipped`);

// ── 4. Fuel fillups ───────────────────────────────────────────────────────────

let fuelSkipped = 0;
let fuelInserted = 0;

const insertFuel = db.prepare(`
  INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter, odometer, receipt)
  VALUES (?,?,?,?,?,?,?,?)
`);

db.transaction(() => {
  for (const row of data.fuel_fillups) {
    const person_id = resolvePersonId(row.Naam);
    const car_id = resolveCarId(row.Wagen);

    if (!person_id || !car_id) {
      console.warn(`SKIP fuel: cannot resolve person="${row.Naam}" or car="${row.Wagen}"`);
      fuelSkipped++;
      continue;
    }

    const amount = row.bedrag ?? 0;
    const liters = row["#liter"] ?? 0;
    const price_per_liter = row["prijs/liter"] ?? calcPricePerLiter(amount, liters);
    const date = (row.Datum ?? "").slice(0, 10);

    insertFuel.run(
      person_id, car_id, date, amount, liters,
      price_per_liter,
      row.kilometerstand ?? null,
      row.Bonnetje ?? null
    );
    fuelInserted++;
  }
})();

console.log(`Fuel fillups: ${fuelInserted} inserted, ${fuelSkipped} skipped`);

// ── 5. Expenses ───────────────────────────────────────────────────────────────

let expensesSkipped = 0;
let expensesInserted = 0;

const insertExpense = db.prepare(`
  INSERT INTO expenses (person_id, car_id, date, amount, description)
  VALUES (?,?,?,?,?)
`);

db.transaction(() => {
  for (const row of data.expenses) {
    const person_id = resolvePersonId(row.Naam);
    const car_id = resolveCarId(row.Wagen);

    if (!person_id || !car_id) {
      console.warn(`SKIP expense: cannot resolve person="${row.Naam}" or car="${row.Wagen}"`);
      expensesSkipped++;
      continue;
    }

    const date = (row.Datum ?? "").slice(0, 10);
    insertExpense.run(person_id, car_id, date, row.Bedrag ?? 0, row.Kosten ?? null);
    expensesInserted++;
  }
})();

console.log(`Expenses: ${expensesInserted} inserted, ${expensesSkipped} skipped`);

// ── 6. Payments ───────────────────────────────────────────────────────────────

let paymentsSkipped = 0;
let paymentsInserted = 0;

const insertPayment = db.prepare(`
  INSERT INTO payments (person_id, date, amount, note, year)
  VALUES (?,?,?,?,?)
`);

db.transaction(() => {
  for (const row of data.payments) {
    const person_id = resolvePersonId(row.Name ?? row.Naam);

    if (!person_id) {
      console.warn(`SKIP payment: cannot resolve person="${row.Name ?? row.Naam}"`);
      paymentsSkipped++;
      continue;
    }

    const date = (row.Datum ?? "").slice(0, 10);
    // YEAR-1 field contains Sheets formula strings — compute ourselves
    const year = calcPaymentYear(date);
    insertPayment.run(person_id, date, row.bedrag ?? 0, row.Opmerking ?? null, year);
    paymentsInserted++;
  }
})();

console.log(`Payments: ${paymentsInserted} inserted, ${paymentsSkipped} skipped`);

// ── Summary ───────────────────────────────────────────────────────────────────

const counts = {
  cars:        (db.prepare("SELECT COUNT(*) AS n FROM cars").get() as any).n,
  people:      (db.prepare("SELECT COUNT(*) AS n FROM people").get() as any).n,
  trips:       (db.prepare("SELECT COUNT(*) AS n FROM trips").get() as any).n,
  fuel_fillups:(db.prepare("SELECT COUNT(*) AS n FROM fuel_fillups").get() as any).n,
  expenses:    (db.prepare("SELECT COUNT(*) AS n FROM expenses").get() as any).n,
  payments:    (db.prepare("SELECT COUNT(*) AS n FROM payments").get() as any).n,
};

console.log("\n✅ Seed complete:");
console.table(counts);
