import type Database from "better-sqlite3";
import type { SettlementResult, MemberStatement, CarEraBalance, AnnotatedTransfer } from "@/types";
import { getPaymentsByYear } from "./payments";

interface CarEraRow {
  id: number;
  name: string;
  short: string;
  owner_name: string;
  owner_from: string;
  owner_to: string; // COALESCE'd to '9999-12-31'
}

interface PersonRow {
  id: number;
  name: string;
}

interface AmountRow {
  person_id: number;
  car_id: number;
  amount: number;
}

interface SettlementRow {
  settled_at: string;
  settled_by: string;
}

function buildMap(rows: AmountRow[]): Map<number, Map<number, number>> {
  const m = new Map<number, Map<number, number>>();
  for (const r of rows) {
    if (!m.has(r.person_id)) m.set(r.person_id, new Map());
    m.get(r.person_id)!.set(r.car_id, r.amount);
  }
  return m;
}

interface SettledRow {
  person_id: number;
  car_id: number;
  cnt: number;
  amount: number;
}

function buildSettledMap(
  rows: SettledRow[]
): Map<number, Map<number, { cnt: number; amount: number }>> {
  const m = new Map<number, Map<number, { cnt: number; amount: number }>>();
  for (const r of rows) {
    if (!m.has(r.person_id)) m.set(r.person_id, new Map());
    m.get(r.person_id)!.set(r.car_id, { cnt: r.cnt, amount: r.amount });
  }
  return m;
}

function get(m: Map<number, Map<number, number>>, pid: number, cid: number): number {
  return m.get(pid)?.get(cid) ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds a Map<name, person_id> from the people list for resolving
 * transfer payer/payee names back to IDs.
 */
function buildNameToId(people: PersonRow[]): Map<string, number> {
  return new Map(people.map((p) => [p.name, p.id]));
}

function reduceDebts(
  positions: Map<string, number>
): { from: string; to: string; amount: number }[] {
  const pos = new Map(positions);
  const txns: { from: string; to: string; amount: number }[] = [];
  for (let i = 0; i < pos.size * 2; i++) {
    let creditor = "",
      debtor = "",
      maxC = 0,
      minD = 0;
    for (const [name, x] of pos) {
      if (x > maxC) {
        maxC = x;
        creditor = name;
      }
      if (x < minD) {
        minD = x;
        debtor = name;
      }
    }
    if (!creditor || !debtor) break;
    const amount = round2(Math.min(maxC, -minD));
    txns.push({ from: debtor, to: creditor, amount });
    pos.set(creditor, round2(maxC - amount));
    pos.set(debtor, round2(minD + amount));
  }
  return txns;
}

export function getSettlement(db: Database.Database, year: number): SettlementResult {
  const yearStr = String(year);

  // 1. Car-eras active in this year
  const carEras = db
    .prepare(
      `SELECT id, name, short, owner_name, owner_from,
              COALESCE(owner_to, '9999-12-31') AS owner_to
       FROM cars
       WHERE owner_name IS NOT NULL
         AND owner_from IS NOT NULL
         AND owner_from <= ?
         AND COALESCE(owner_to, '9999-12-31') >= ?`
    )
    .all(`${yearStr}-12-31`, `${yearStr}-01-01`) as CarEraRow[];

  // 2. Frozen status
  const lock = db
    .prepare("SELECT settled_at, settled_by FROM settlements WHERE year = ?")
    .get(year) as SettlementRow | undefined;

  if (carEras.length === 0) {
    return {
      year,
      frozen: !!lock,
      settled_at: lock?.settled_at ?? null,
      settled_by: lock?.settled_by ?? null,
      members: [],
      transfers: [],
      verify_ok: true,
      payments_by_person: {},
      all_paid: true,
    };
  }

  // 3. All people — active filter omitted so former members still appear in past years
  const people = db.prepare("SELECT id, name FROM people ORDER BY name").all() as PersonRow[];

  // 4. Classify owners vs non-owners
  const ownerNames = new Set(carEras.map((e) => e.owner_name));
  const owners = people.filter((p) => ownerNames.has(p.name));
  const nonOwners = people.filter((p) => !ownerNames.has(p.name));

  // 5. All trips/fuel/expenses on owned cars in year, within era date bounds
  const tripRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.amount), 0) AS amount
       FROM trips t
       JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from
         AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const tripKmRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.km), 0) AS amount
       FROM trips t
       JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from
         AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COALESCE(SUM(CASE WHEN f.settled_outside = 0 THEN f.amount ELSE 0 END), 0) AS amount
       FROM fuel_fillups f
       JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from
         AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelLiterRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COALESCE(SUM(f.liters), 0) AS amount
       FROM fuel_fillups f
       JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from
         AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelSettledRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COUNT(*) as cnt, COALESCE(SUM(f.liters), 0) as amount
       FROM fuel_fillups f
       JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from
         AND (c.owner_to IS NULL OR f.date <= c.owner_to)
         AND f.settled_outside = 1
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expSettledRows = db
    .prepare(
      `SELECT e.person_id, e.car_id, COUNT(*) as cnt, COALESCE(SUM(e.amount), 0) as amount
       FROM expenses e
       JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from
         AND (c.owner_to IS NULL OR e.date <= c.owner_to)
         AND e.settled_outside = 1
       GROUP BY e.person_id, e.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expRows = db
    .prepare(
      `SELECT e.person_id, e.car_id, COALESCE(SUM(CASE WHEN e.settled_outside = 0 THEN e.amount ELSE 0 END), 0) AS amount
       FROM expenses e
       JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL
         AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from
         AND (c.owner_to IS NULL OR e.date <= c.owner_to)
       GROUP BY e.person_id, e.car_id`
    )
    .all(yearStr) as AmountRow[];

  const trips = buildMap(tripRows);
  const tripKm = buildMap(tripKmRows);
  const fuel = buildMap(fuelRows);
  const fuelLiters = buildMap(fuelLiterRows);
  const exp = buildMap(expRows);
  const fuelSettled = buildSettledMap(fuelSettledRows);
  const expSettled = buildSettledMap(expSettledRows);

  // 6. Car-era lookups
  const carsByOwner = new Map<string, CarEraRow[]>();
  for (const era of carEras) {
    if (!carsByOwner.has(era.owner_name)) carsByOwner.set(era.owner_name, []);
    carsByOwner.get(era.owner_name)!.push(era);
  }

  // 7. N(c*) = -Σ_{non-owner p} b(p, c*) for each car-era
  // b(p,c) = -trips + fuel + expenses
  // N(c) = Σ_{non-owner} trips - Σ_{non-owner} fuel - Σ_{non-owner} expenses
  const N = new Map<number, number>();
  for (const era of carEras) {
    let n = 0;
    for (const p of nonOwners) {
      const b = -get(trips, p.id, era.id) + get(fuel, p.id, era.id) + get(exp, p.id, era.id);
      n += -b;
    }
    N.set(era.id, round2(n));
  }

  // 8. S₁(p) for non-owners: Σ_{all c*} b(p, c*)
  const S1 = new Map<number, number>();
  for (const p of nonOwners) {
    let s1 = 0;
    for (const era of carEras) {
      s1 += -get(trips, p.id, era.id) + get(fuel, p.id, era.id) + get(exp, p.id, era.id);
    }
    S1.set(p.id, round2(s1));
  }

  // 9. S₂(o) = Σ_{c* ∈ cars(o)} N(c*)
  const S2 = new Map<string, number>();
  for (const owner of owners) {
    const ownedCars = carsByOwner.get(owner.name) ?? [];
    const s2 = ownedCars.reduce((sum, c) => sum + (N.get(c.id) ?? 0), 0);
    S2.set(owner.name, round2(s2));
  }

  // 10. Cross-owner matrix M[i][j] = b(owner_i, c ∈ cars(owner_j)) for i≠j
  const Mx = new Map<string, Map<string, number>>();
  for (const ownerI of owners) {
    Mx.set(ownerI.name, new Map());
    for (const ownerJ of owners) {
      if (ownerI.name === ownerJ.name) continue;
      const jCars = carsByOwner.get(ownerJ.name) ?? [];
      let mij = 0;
      for (const c of jCars) {
        mij +=
          -get(trips, ownerI.id, c.id) + get(fuel, ownerI.id, c.id) + get(exp, ownerI.id, c.id);
      }
      Mx.get(ownerI.name)!.set(ownerJ.name, round2(mij));
    }
  }

  // 11. X(o) = Σ_{j≠o} (M[o][j] − M[j][o])
  const X = new Map<string, number>();
  for (const owner of owners) {
    let x = 0;
    for (const other of owners) {
      if (other.name === owner.name) continue;
      const mOO = Mx.get(owner.name)?.get(other.name) ?? 0;
      const mOther = Mx.get(other.name)?.get(owner.name) ?? 0;
      x += mOO - mOther;
    }
    X.set(owner.name, round2(x));
  }

  // 12. Build member statements
  const members: MemberStatement[] = [];

  for (const p of nonOwners) {
    const s1 = S1.get(p.id) ?? 0;
    const car_eras: CarEraBalance[] = carEras
      .map((era) => {
        const tripAmt = get(trips, p.id, era.id);
        const fuelAmt = get(fuel, p.id, era.id);
        const expAmt = get(exp, p.id, era.id);
        const fs = fuelSettled.get(p.id)?.get(era.id);
        const es = expSettled.get(p.id)?.get(era.id);
        return {
          car_name: era.name,
          car_short: era.short,
          owner_name: era.owner_name,
          owner_from: era.owner_from,
          owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
          trip_amount: tripAmt,
          trip_km: get(tripKm, p.id, era.id),
          fuel_amount: fuelAmt,
          fuel_liters: get(fuelLiters, p.id, era.id),
          expense_amount: expAmt,
          balance: round2(-tripAmt + fuelAmt + expAmt),
          fuel_settled_count: fs?.cnt,
          fuel_settled_liters: fs?.amount,
          expense_settled_count: es?.cnt,
          expense_settled_amount: es?.amount,
        };
      })
      .filter((e) => e.trip_amount > 0 || e.fuel_amount > 0 || e.expense_amount > 0);

    if (car_eras.length > 0) {
      members.push({ person_id: p.id, person_name: p.name, is_owner: false, s1, car_eras });
    }
  }

  for (const o of owners) {
    const s2 = S2.get(o.name) ?? 0;
    const x = X.get(o.name) ?? 0;
    const ownedCars = carsByOwner.get(o.name) ?? [];
    const car_eras: CarEraBalance[] = ownedCars.map((era) => ({
      car_name: era.name,
      car_short: era.short,
      owner_name: era.owner_name,
      owner_from: era.owner_from,
      owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
      trip_amount: 0,
      trip_km: 0,
      fuel_amount: 0,
      fuel_liters: 0,
      expense_amount: 0,
      balance: N.get(era.id) ?? 0,
      n_c_star: N.get(era.id) ?? 0,
      member_contributions: nonOwners
        .map((p) => {
          const fs = fuelSettled.get(p.id)?.get(era.id);
          const es = expSettled.get(p.id)?.get(era.id);
          return {
            person_name: p.name,
            trip_km: get(tripKm, p.id, era.id),
            fuel_liters: get(fuelLiters, p.id, era.id),
            expense_amount: get(exp, p.id, era.id),
            contribution: round2(
              get(trips, p.id, era.id) - get(fuel, p.id, era.id) - get(exp, p.id, era.id)
            ),
            fuel_settled_count: fs?.cnt ?? 0,
            fuel_settled_liters: fs?.amount ?? 0,
            expense_settled_count: es?.cnt ?? 0,
            expense_settled_amount: es?.amount ?? 0,
          };
        })
        .filter((c) => Math.abs(c.contribution) > 0.005)
        .sort((a, b) => b.contribution - a.contribution),
    }));

    const cross_owner_balances = owners
      .filter((j) => j.name !== o.name)
      .map((j) => {
        const jOwnedCars = carsByOwner.get(j.name) ?? [];
        let my_trip_km = 0;
        let my_fuel_liters = 0;
        let my_expense_amount = 0;
        let my_fuel_settled_count = 0;
        let my_fuel_settled_liters = 0;
        let my_expense_settled_count = 0;
        let my_expense_settled_amount = 0;
        for (const c of jOwnedCars) {
          my_trip_km += get(tripKm, o.id, c.id);
          my_fuel_liters += get(fuelLiters, o.id, c.id);
          my_expense_amount += get(exp, o.id, c.id);
          const fs = fuelSettled.get(o.id)?.get(c.id);
          if (fs) {
            my_fuel_settled_count += fs.cnt;
            my_fuel_settled_liters += fs.amount;
          }
          const es = expSettled.get(o.id)?.get(c.id);
          if (es) {
            my_expense_settled_count += es.cnt;
            my_expense_settled_amount += es.amount;
          }
        }
        return {
          other_owner_name: j.name,
          net: round2((Mx.get(o.name)?.get(j.name) ?? 0) - (Mx.get(j.name)?.get(o.name) ?? 0)),
          my_balance: Mx.get(o.name)?.get(j.name) ?? 0,
          my_trip_km,
          my_fuel_liters: round2(my_fuel_liters),
          my_expense_amount: round2(my_expense_amount),
          my_fuel_settled_count,
          my_fuel_settled_liters: round2(my_fuel_settled_liters),
          my_expense_settled_count,
          my_expense_settled_amount: round2(my_expense_settled_amount),
        };
      })
      .filter((b) => Math.abs(b.net) > 0.005)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    members.push({
      person_id: o.id,
      person_name: o.name,
      is_owner: true,
      s2,
      x,
      net: round2(s2 + x),
      car_eras,
      cross_owner_balances,
    });
  }

  // Sort: owners first (net desc), then non-owners (s1 desc)
  members.sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const av = a.is_owner ? (a.net ?? 0) : (a.s1 ?? 0);
    const bv = b.is_owner ? (b.net ?? 0) : (b.s1 ?? 0);
    return bv - av;
  });

  // 13. Build transfer list
  const transfers: Omit<AnnotatedTransfer, "payment_status">[] = [];

  for (const p of nonOwners) {
    const s1 = S1.get(p.id) ?? 0;
    if (Math.abs(s1) < 0.005) continue;
    if (s1 < 0) {
      transfers.push({
        from: p.name,
        to: "co-op",
        amount: round2(-s1),
        step: 1,
        label: `${p.name} → co-op`,
      });
    } else {
      transfers.push({
        from: "co-op",
        to: p.name,
        amount: s1,
        step: 1,
        label: `co-op → ${p.name}`,
      });
    }
  }

  for (const o of owners) {
    const s2 = S2.get(o.name) ?? 0;
    if (Math.abs(s2) < 0.005) continue;
    if (s2 > 0) {
      transfers.push({
        from: "co-op",
        to: o.name,
        amount: s2,
        step: 2,
        label: `co-op → ${o.name}`,
      });
    } else {
      transfers.push({
        from: o.name,
        to: "co-op",
        amount: round2(-s2),
        step: 2,
        label: `${o.name} → co-op`,
      });
    }
  }

  const xPositions = new Map<string, number>();
  for (const o of owners) {
    const x = X.get(o.name) ?? 0;
    if (Math.abs(x) > 0.005) xPositions.set(o.name, x);
  }
  for (const { from, to, amount } of reduceDebts(xPositions)) {
    transfers.push({ from, to, amount, step: 3, label: `${from} → ${to}` });
  }

  // 14. Load payments for this year and annotate transfers
  const paymentsByPerson = getPaymentsByYear(db, year);
  const nameToId = buildNameToId(people);

  const annotatedTransfers: AnnotatedTransfer[] = transfers.map((tr) => {
    // Identify the human payer: for step 1/2, the "from" side may be a person
    // or "co-op". For step 3, both sides are owners.
    // We annotate from the payer's perspective (who has to make the bank transfer).
    let payerName: string | null = null;
    if (tr.step === 1) {
      // member owes co-op: from = member name; co-op owes member: from = "co-op"
      payerName = tr.from !== "co-op" ? tr.from : null;
    } else if (tr.step === 2) {
      // co-op owes owner: from = "co-op"; owner owes co-op: from = owner name
      payerName = tr.from !== "co-op" ? tr.from : null;
    } else if (tr.step === 3) {
      // inter-owner: from = the paying owner
      payerName = tr.from;
    }

    if (payerName === null) {
      // co-op is the payer — no payment record to track
      return { ...tr, payment_status: null };
    }

    const payerId = nameToId.get(payerName) ?? null;
    if (payerId === null) {
      return { ...tr, payment_status: null };
    }

    const personPayments = paymentsByPerson.get(payerId) ?? [];
    const paid = round2(personPayments.reduce((s, p) => s + p.amount, 0));
    const open = round2(Math.max(0, tr.amount - paid));
    return { ...tr, payment_status: { paid, open, payments: personPayments } };
  });

  // 15. Compute all_paid flag
  const humanTransfers = annotatedTransfers.filter((t) => t.payment_status !== null);
  const all_paid =
    humanTransfers.length === 0 ||
    humanTransfers.every((t) => (t.payment_status?.open ?? 1) < 0.005);

  // 16. Verify
  const sumS1 = [...S1.values()].reduce((s, v) => s + v, 0);
  const sumS2 = [...S2.values()].reduce((s, v) => s + v, 0);
  const verify_ok = Math.abs(sumS1 + sumS2) < 0.05;

  return {
    year,
    frozen: !!lock,
    settled_at: lock?.settled_at ?? null,
    settled_by: lock?.settled_by ?? null,
    members,
    transfers: annotatedTransfers,
    verify_ok,
    payments_by_person: Object.fromEntries(
      [...paymentsByPerson.entries()].map(([id, rows]) => [id, rows.reduce((s, p) => s + p.amount, 0)])
    ),
    all_paid,
  };
}

export function lockSettlement(db: Database.Database, year: number, settledBy: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO settlements (year, settled_at, settled_by)
     VALUES (?, datetime('now'), ?)`
  ).run(year, settledBy);
}

export function unlockSettlement(db: Database.Database, year: number): void {
  db.prepare("DELETE FROM settlements WHERE year = ?").run(year);
}
