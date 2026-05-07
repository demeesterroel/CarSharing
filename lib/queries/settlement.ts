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

function getTransferPaymentStatus(
  paymentsByPerson: Map<number, { id: number; date: string; amount: number }[]>,
  nameToId: Map<string, number>,
  tr: Omit<AnnotatedTransfer, "payment_status">
): AnnotatedTransfer["payment_status"] {
  const personName = tr.from === "co-op" ? tr.to : tr.from;
  const personId = nameToId.get(personName) ?? null;
  if (personId === null) return null;

  const personPayments = paymentsByPerson.get(personId) ?? [];
  const matchingPayments = personPayments.filter((p) =>
    tr.from === "co-op" ? p.amount < 0 : p.amount > 0
  );
  const paid = round2(matchingPayments.reduce((s, p) => s + Math.abs(p.amount), 0));
  const open = round2(Math.max(0, tr.amount - paid));

  return { paid, open, payments: matchingPayments };
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
      car_settlements: [],
      transfers: [],
      verify_ok: true,
      payments_by_person: {},
      all_paid: true,
    };
  }

  // 3. All people
  const people = db.prepare("SELECT id, name FROM people ORDER BY name").all() as PersonRow[];

  // 4. Classify owners vs non-owners
  const ownerNames = new Set(carEras.map((e) => e.owner_name));
  const owners = people.filter((p) => ownerNames.has(p.name));
  const nonOwners = people.filter((p) => !ownerNames.has(p.name));

  // 5. Query all trips/fuel/expenses for owned cars in year, within era bounds
  const tripRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.amount), 0) AS amount
       FROM trips t JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const tripKmRows = db
    .prepare(
      `SELECT t.person_id, t.car_id, COALESCE(SUM(t.km), 0) AS amount
       FROM trips t JOIN cars c ON c.id = t.car_id
       WHERE strftime('%Y', t.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND t.date >= c.owner_from AND (c.owner_to IS NULL OR t.date <= c.owner_to)
       GROUP BY t.person_id, t.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelRows = db
    .prepare(
      `SELECT f.person_id, f.car_id,
              COALESCE(SUM(CASE WHEN f.settled_outside = 0 THEN f.amount ELSE 0 END), 0) AS amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelLiterRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COALESCE(SUM(f.liters), 0) AS amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as AmountRow[];

  const fuelSettledRows = db
    .prepare(
      `SELECT f.person_id, f.car_id, COUNT(*) as cnt, COALESCE(SUM(f.liters), 0) as amount
       FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
       WHERE strftime('%Y', f.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
         AND f.settled_outside = 1
       GROUP BY f.person_id, f.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expSettledRows = db
    .prepare(
      `SELECT e.person_id, e.car_id, COUNT(*) as cnt, COALESCE(SUM(e.amount), 0) as amount
       FROM expenses e JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from AND (c.owner_to IS NULL OR e.date <= c.owner_to)
         AND e.settled_outside = 1
       GROUP BY e.person_id, e.car_id`
    )
    .all(yearStr) as SettledRow[];

  const expRows = db
    .prepare(
      `SELECT e.person_id, e.car_id,
              COALESCE(SUM(CASE WHEN e.settled_outside = 0 THEN e.amount ELSE 0 END), 0) AS amount
       FROM expenses e JOIN cars c ON c.id = e.car_id
       WHERE strftime('%Y', e.date) = ?
         AND c.owner_name IS NOT NULL AND c.owner_from IS NOT NULL
         AND e.date >= c.owner_from AND (c.owner_to IS NULL OR e.date <= c.owner_to)
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

  // 6. Car-era lookup by owner
  const carsByOwner = new Map<string, CarEraRow[]>();
  for (const era of carEras) {
    if (!carsByOwner.has(era.owner_name)) carsByOwner.set(era.owner_name, []);
    carsByOwner.get(era.owner_name)!.push(era);
  }

  // Helper: build a CarParticipantRow for a given person × car
  function makeRow(
    p: PersonRow,
    era: CarEraRow,
    rowType: "member" | "cross_owner" | "own"
  ): import("@/types").CarParticipantRow {
    const tripAmt = rowType === "own" ? 0 : get(trips, p.id, era.id);
    const fuelAmt = rowType === "own" ? 0 : get(fuel, p.id, era.id);
    const expAmt = rowType === "own" ? 0 : get(exp, p.id, era.id);
    const fs = fuelSettled.get(p.id)?.get(era.id);
    const es = expSettled.get(p.id)?.get(era.id);
    return {
      person_name: p.name,
      row_type: rowType,
      trip_km: get(tripKm, p.id, era.id),
      trip_amount: tripAmt,
      fuel_liters: rowType === "own" ? 0 : get(fuelLiters, p.id, era.id),
      fuel_amount: fuelAmt,
      expense_amount: expAmt,
      balance: round2(tripAmt - fuelAmt - expAmt),
      fuel_settled_count: fs?.cnt ?? 0,
      fuel_settled_liters: fs?.amount ?? 0,
      expense_settled_count: es?.cnt ?? 0,
      expense_settled_amount: es?.amount ?? 0,
    };
  }

  // 7. N_new(c) = Σ all people EXCEPT car's own owner: (trip − fuel − exp)
  //    Includes cross-owners (other car owners who used this car)
  const N = new Map<number, number>();
  for (const era of carEras) {
    let n = 0;
    for (const p of people) {
      if (p.name === era.owner_name) continue; // own-car trips are free (vestzak/broekzak)
      n += get(trips, p.id, era.id) - get(fuel, p.id, era.id) - get(exp, p.id, era.id);
    }
    N.set(era.id, round2(n));
  }

  // 8. S₁(p) for non-owners: Σ b(p, c*) across all cars (negative = owes co-op)
  const S1 = new Map<number, number>();
  for (const p of nonOwners) {
    let s1 = 0;
    for (const era of carEras) {
      s1 += -get(trips, p.id, era.id) + get(fuel, p.id, era.id) + get(exp, p.id, era.id);
    }
    S1.set(p.id, round2(s1));
  }

  // 9. S₂(o) = Σ N_new(cars owned by o)
  const S2 = new Map<string, number>();
  for (const owner of owners) {
    const ownedCars = carsByOwner.get(owner.name) ?? [];
    S2.set(owner.name, round2(ownedCars.reduce((s, c) => s + (N.get(c.id) ?? 0), 0)));
  }

  // 10. s1_cross(o) = balance of owner o for using OTHER owners' cars (negative = owes co-op)
  const S1Cross = new Map<string, number>();
  for (const owner of owners) {
    let s1c = 0;
    for (const era of carEras) {
      if (era.owner_name === owner.name) continue; // skip own car
      s1c +=
        -get(trips, owner.id, era.id) + get(fuel, owner.id, era.id) + get(exp, owner.id, era.id);
    }
    S1Cross.set(owner.name, round2(s1c));
  }

  // 11. Build car_settlements (car-centric view for display)
  const car_settlements: import("@/types").CarSettlement[] = carEras.map((era) => {
    const rows: import("@/types").CarParticipantRow[] = [];

    // Regular members
    for (const p of nonOwners) {
      const tripAmt = get(trips, p.id, era.id);
      const fuelAmt = get(fuel, p.id, era.id);
      const expAmt = get(exp, p.id, era.id);
      if (tripAmt === 0 && fuelAmt === 0 && expAmt === 0) continue;
      rows.push(makeRow(p, era, "member"));
    }

    // Cross-owners (other car owners using this car)
    for (const o of owners) {
      if (o.name === era.owner_name) continue;
      const tripAmt = get(trips, o.id, era.id);
      const fuelAmt = get(fuel, o.id, era.id);
      const expAmt = get(exp, o.id, era.id);
      if (tripAmt === 0 && fuelAmt === 0 && expAmt === 0) continue;
      rows.push(makeRow(o, era, "cross_owner"));
    }

    // Owner's own trips (shown as €0 — vestzak/broekzak)
    const ownerPerson = people.find((p) => p.name === era.owner_name);
    if (ownerPerson && get(tripKm, ownerPerson.id, era.id) > 0) {
      rows.push(makeRow(ownerPerson, era, "own"));
    }

    // Sort: members (alpha) → cross_owners (alpha) → own
    const order = { member: 0, cross_owner: 1, own: 2 } as const;
    rows.sort((a, b) =>
      order[a.row_type] !== order[b.row_type]
        ? order[a.row_type] - order[b.row_type]
        : a.person_name.localeCompare(b.person_name)
    );

    return {
      car_name: era.name,
      car_short: era.short,
      owner_name: era.owner_name,
      owner_from: era.owner_from,
      owner_to: era.owner_to === "9999-12-31" ? null : era.owner_to,
      rows,
      total_balance: N.get(era.id) ?? 0,
    };
  });

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
    const s1_cross = S1Cross.get(o.name) ?? 0;
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
      member_contributions: [...nonOwners, ...owners.filter((j) => j.name !== o.name)]
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
        .filter((c) => c.trip_km > 0 || c.fuel_liters > 0 || c.expense_amount > 0)
        .sort((a, b) => b.contribution - a.contribution),
    }));

    members.push({
      person_id: o.id,
      person_name: o.name,
      is_owner: true,
      s2,
      s1_cross,
      net: round2(s2 + s1_cross),
      car_eras,
    });
  }

  // Sort: owners first (net desc), then non-owners (s1 desc)
  members.sort((a, b) => {
    if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
    const av = a.is_owner ? (a.net ?? 0) : (a.s1 ?? 0);
    const bv = b.is_owner ? (b.net ?? 0) : (b.s1 ?? 0);
    return bv - av;
  });

  // 13. Build transfers — Step 1 (non-owners + cross-owners) and Step 2 (owners)
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
    const s1c = S1Cross.get(o.name) ?? 0;
    if (Math.abs(s1c) < 0.005) continue;
    if (s1c < 0) {
      transfers.push({
        from: o.name,
        to: "co-op",
        amount: round2(-s1c),
        step: 1,
        label: `${o.name} → co-op`,
      });
    } else {
      transfers.push({
        from: "co-op",
        to: o.name,
        amount: s1c,
        step: 1,
        label: `co-op → ${o.name}`,
      });
    }
  }

  for (const o of owners) {
    const s2 = S2.get(o.name) ?? 0;
    if (Math.abs(s2) < 0.005) continue;
    transfers.push({ from: "co-op", to: o.name, amount: s2, step: 2, label: `co-op → ${o.name}` });
  }

  // 14. Load payments and annotate transfers
  const paymentsByPerson = getPaymentsByYear(db, year);
  const nameToId = buildNameToId(people);

  const annotatedTransfers: AnnotatedTransfer[] = transfers.map((tr) => {
    const payment_status = getTransferPaymentStatus(paymentsByPerson, nameToId, tr);
    return { ...tr, payment_status };
  });

  const humanTransfers = annotatedTransfers.filter((t) => t.payment_status !== null);
  const all_paid =
    humanTransfers.length === 0 ||
    humanTransfers.every((t) => (t.payment_status?.open ?? 1) < 0.005);

  // 15. Verify: Σ S1 + Σ S1Cross + Σ S2 ≈ 0
  const sumS1 = [...S1.values()].reduce((s, v) => s + v, 0);
  const sumS1c = [...S1Cross.values()].reduce((s, v) => s + v, 0);
  const sumS2 = [...S2.values()].reduce((s, v) => s + v, 0);
  const verify_ok = Math.abs(sumS1 + sumS1c + sumS2) < 0.05;

  return {
    year,
    frozen: !!lock,
    settled_at: lock?.settled_at ?? null,
    settled_by: lock?.settled_by ?? null,
    members,
    car_settlements,
    transfers: annotatedTransfers,
    verify_ok,
    payments_by_person: Object.fromEntries(
      [...paymentsByPerson.entries()].map(([id, rows]) => [
        id,
        rows.reduce((s, p) => s + p.amount, 0),
      ])
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
