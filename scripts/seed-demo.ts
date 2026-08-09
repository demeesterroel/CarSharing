process.env.SESSION_PASSWORD =
  process.env.SESSION_PASSWORD || "dev-session-password-placeholder-32-chars";

import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { runMigrations } from "../lib/db/migrate.js";
import { calcPricePerLiter, calcTripAmount } from "../lib/formulas.js";
import { shortNameOf } from "../lib/person-utils.js";
import { getSettlement } from "../lib/queries/settlement.js";

// First, seed the Platform DB (Default + Demo Tenants)
console.log("Seeding platform database with demo tenants...");
execSync("npx tsx scripts/seed-platform.ts", { stdio: "inherit" });

function seedSingleTenantDb(targetPath: string) {
  console.log(`\n--- Seeding tenant database: ${path.basename(targetPath)} ---`);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const db = new Database(targetPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);

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

  db.prepare("DELETE FROM people WHERE first_name LIKE 'E2E%' AND username IS NULL").run();

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

  const personDiscounts = new Map<number, { discount: number; discount_long: number }>();
  for (const p of PEOPLE) {
    personDiscounts.set(personIdByUsername[p.username], {
      discount: p.discount,
      discount_long: p.discount_long,
    });
  }

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

  const checkTrips = db.prepare(
    "SELECT COUNT(*) AS n FROM trips WHERE car_id = ? AND date LIKE ? || '%'"
  );
  const insertTrip = db.prepare(`
    INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

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
          const amount = calcTripAmount(
            km,
            car.price_per_km,
            person.discount,
            person.discount_long
          );

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
    }
  }

  const checkFuel = db.prepare(
    "SELECT COUNT(*) AS n FROM fuel_fillups WHERE car_id = ? AND date LIKE ? || '%'"
  );
  const insertFuel = db.prepare(`
    INSERT INTO fuel_fillups (person_id, car_id, date, amount, liters, price_per_liter)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

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
          const liters = +Math.max(
            10,
            Math.min(45, rand(avgNeeded * 0.8, avgNeeded * 1.2))
          ).toFixed(1);
          const ppl = priceForDate(dates[i]);
          const amount = +(liters * ppl).toFixed(2);
          const price_per_liter = +calcPricePerLiter(amount, liters).toFixed(4);
          const personId = peopleIds[Math.floor(rng() * peopleIds.length)];
          litersBudget -= liters;

          insertFuel.run(personId, carId, dates[i], amount, liters, price_per_liter);
        }
      })();
    }
  }

  const checkExpenses = db.prepare(
    "SELECT COUNT(*) AS n FROM expenses WHERE car_id = ? AND date LIKE ? || '%'"
  );
  const insertExpense = db.prepare(`
    INSERT INTO expenses (person_id, car_id, date, amount, description, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

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
    }
  }

  {
    const lastTrip = db
      .prepare(
        "SELECT end_odometer FROM trips WHERE car_id = ? ORDER BY date DESC, id DESC LIMIT 1"
      )
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

  {
    const bbId = carIdByShort["BB"];
    const aliceIdVal = personIdByUsername["alice"];
    const lastBB = db
      .prepare(
        "SELECT end_odometer FROM trips WHERE car_id = ? ORDER BY start_odometer DESC LIMIT 1"
      )
      .get(bbId) as { end_odometer: number } | undefined;
    if (lastBB) {
      const base = lastBB.end_odometer + 50;
      const alreadyExists = db
        .prepare("SELECT 1 FROM trips WHERE car_id = ? AND start_odometer = ?")
        .get(bbId, base);
      if (!alreadyExists) {
        db.prepare(
          `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
           VALUES (?, ?, '2027-01-15', ?, ?, 120, 36.00, 'Leuven')`
        ).run(aliceIdVal, bbId, base, base + 120);
        db.prepare(
          `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
           VALUES (?, ?, '2027-01-10', ?, ?, 200, 60.00, 'Mechelen')`
        ).run(aliceIdVal, bbId, base + 120, base + 320);
      }
    }
  }

  {
    const aaId = carIdByShort["AA"];
    const bbId = carIdByShort["BB"];
    const aliceIdVal = personIdByUsername["alice"];
    const ownerIdVal = personIdByUsername["owner"];

    const p1Exists = db
      .prepare(
        "SELECT 1 FROM trips WHERE car_id = ? AND person_id = ? AND start_odometer = ? AND end_odometer = ?"
      )
      .get(aaId, aliceIdVal, 9000, 9080);
    if (!p1Exists) {
      db.prepare(
        `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
         VALUES (?, ?, '2025-03-12', 9000, 9080, 80, 24.00, 'Gent')`
      ).run(aliceIdVal, aaId);
      db.prepare(
        `INSERT INTO trips (person_id, car_id, date, start_odometer, end_odometer, km, amount, location)
         VALUES (?, ?, '2025-03-13', 9000, 9080, 80, 24.00, 'Gent (dup)')`
      ).run(aliceIdVal, aaId);
    }

    const p2Exists = db
      .prepare(
        "SELECT 1 FROM trips WHERE car_id = ? AND person_id = ? AND start_odometer = ? AND end_odometer = ?"
      )
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
        const amount = transfer.from === "co-op" ? -transfer.amount : transfer.amount;
        insertPayment.run(personId, payDate, +amount.toFixed(2), null, year);
      }
    })();
  }

  db.prepare(
    `
    INSERT OR IGNORE INTO settlements (year, settled_at, settled_by) VALUES
    (2021, '2022-02-01T10:00:00', 'admin'),
    (2022, '2023-02-01T10:00:00', 'admin'),
    (2023, '2024-02-01T10:00:00', 'admin')
  `
  ).run();
  db.prepare("DELETE FROM settlements WHERE year = 2024").run();

  db.prepare(
    `
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('coop_bank_account', 'BE00 0000 0000 0000')
  `
  ).run();

  const aliceIdRes = personIdByUsername["alice"];
  const carolIdRes = personIdByUsername["carol"];
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
    aliceIdRes,
    carIdByShort["AA"],
    personIdByUsername["bob"],
    carIdByShort["BB"],
    carolIdRes,
    carIdByShort["CC"],
    aliceIdRes,
    carIdByShort["AA"]
  );

  console.log(`  ✓ Demo seed complete for ${path.basename(targetPath)}`);
}

// 2. Determine target databases to seed
const targetPaths: string[] = [];

if (process.env.DB_PATH) {
  targetPaths.push(process.env.DB_PATH);
} else {
  targetPaths.push(
    path.join(process.cwd(), "data", "carsharing.db"),
    path.join(process.cwd(), "data", "tenants", "primary.db"),
    path.join(process.cwd(), "data", "tenants", "coop-a.db"),
    path.join(process.cwd(), "data", "tenants", "coop-b.db")
  );
}

for (const targetPath of targetPaths) {
  seedSingleTenantDb(targetPath);
}

console.log("\n✅ All demo tenant databases seeded successfully!");
console.log("Login: admin / admin  (or owner/owner, alice/alice, bob/bob, carol/carol)");
