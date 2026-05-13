#!/usr/bin/env python3
"""
Settlement audit: per year, show all people where what they owe ≠ what they paid.

Replicates lib/queries/settlement.ts logic in Python.
Payment sign convention: positive = person paid co-op, negative = co-op paid person.

Usage:
  python3 scripts/settlement-audit.py
  python3 scripts/settlement-audit.py --db /tmp/prod.db
  python3 scripts/settlement-audit.py --year 2022
"""

import argparse
import sqlite3
from collections import defaultdict

DEFAULT_DB = "data/carsharing.db"
TOLERANCE  = 0.05


def round2(n):
    return round(n * 100) / 100


def compute_year(cur, year):
    y = str(year)

    # Car eras active in this year
    eras = cur.execute("""
        SELECT c.id, c.name, c.owner_person_id,
               c.owner_from, COALESCE(c.owner_to, '9999-12-31') AS owner_to
        FROM cars c
        WHERE c.owner_person_id IS NOT NULL AND c.owner_from IS NOT NULL
          AND c.owner_from     <= ? AND COALESCE(c.owner_to, '9999-12-31') >= ?
    """, (f"{y}-12-31", f"{y}-01-01")).fetchall()

    if not eras:
        return []

    owner_ids = {e[2] for e in eras}

    people = cur.execute(
        "SELECT id, first_name, last_name FROM people ORDER BY first_name, last_name"
    ).fetchall()
    person_name = {p[0]: f"{p[1]} {p[2] or ''}".strip() for p in people}

    def load_amounts(sql):
        m = {}
        for pid, cid, amt in cur.execute(sql, (y,)):
            m[(pid, cid)] = amt or 0
        return m

    trips = load_amounts("""
        SELECT t.person_id, t.car_id, SUM(t.amount)
        FROM trips t JOIN cars c ON c.id = t.car_id
        WHERE strftime('%Y', t.date) = ?
          AND c.owner_person_id IS NOT NULL AND c.owner_from IS NOT NULL
          AND t.date >= c.owner_from AND (c.owner_to IS NULL OR t.date <= c.owner_to)
        GROUP BY t.person_id, t.car_id
    """)

    fuel = load_amounts("""
        SELECT f.person_id, f.car_id,
               SUM(CASE WHEN f.settled_outside = 0 THEN f.amount ELSE 0 END)
        FROM fuel_fillups f JOIN cars c ON c.id = f.car_id
        WHERE strftime('%Y', f.date) = ?
          AND c.owner_person_id IS NOT NULL AND c.owner_from IS NOT NULL
          AND f.date >= c.owner_from AND (c.owner_to IS NULL OR f.date <= c.owner_to)
        GROUP BY f.person_id, f.car_id
    """)

    exp = load_amounts("""
        SELECT e.person_id, e.car_id,
               SUM(CASE WHEN e.settled_outside = 0 THEN e.amount ELSE 0 END)
        FROM expenses e JOIN cars c ON c.id = e.car_id
        WHERE strftime('%Y', e.date) = ?
          AND c.owner_person_id IS NOT NULL AND c.owner_from IS NOT NULL
          AND e.date >= c.owner_from AND (c.owner_to IS NULL OR e.date <= c.owner_to)
        GROUP BY e.person_id, e.car_id
    """)

    def g(m, pid, cid): return m.get((pid, cid), 0)

    # N(c) — net revenue per car (excludes own-car trips)
    N = {}
    for era in eras:
        n = 0
        for p in people:
            if p[0] == era[2]: continue  # own-car rule
            n += g(trips, p[0], era[0]) - g(fuel, p[0], era[0]) - g(exp, p[0], era[0])
        N[era[0]] = round2(n)

    # S1(p) for non-owners
    S1 = {}
    non_owners = [p for p in people if p[0] not in owner_ids]
    for p in non_owners:
        s1 = 0
        for era in eras:
            s1 += -g(trips, p[0], era[0]) + g(fuel, p[0], era[0]) + g(exp, p[0], era[0])
        S1[p[0]] = round2(s1)

    # S2(o) and S1Cross(o) for owners
    S2      = {}
    S1Cross = {}
    owners = [p for p in people if p[0] in owner_ids]
    # group eras by owner
    cars_by_owner = defaultdict(list)
    for era in eras:
        cars_by_owner[era[2]].append(era)

    for o in owners:
        own_car_ids = {era[0] for era in cars_by_owner[o[0]]}
        # S2 = sum of N(c) for own cars
        s2 = round2(sum(N[cid] for cid in own_car_ids))
        # S1Cross = balance on OTHER owners' cars
        s1c = 0
        for era in eras:
            if era[0] in own_car_ids: continue  # own car
            s1c += -g(trips, o[0], era[0]) + g(fuel, o[0], era[0]) + g(exp, o[0], era[0])
        S2[o[0]]      = s2
        S1Cross[o[0]] = round2(s1c)

    # Payments for this settlement year
    pay_total = defaultdict(float)
    for pid, amt in cur.execute(
        "SELECT person_id, amount FROM payments WHERE year = ?", (year,)
    ):
        pay_total[pid] += amt

    results = []

    for p in people:
        pid  = p[0]
        name = person_name[pid]

        if pid in owner_ids:
            net = round2(S2[pid] + S1Cross[pid])
            if abs(net) < 0.005:
                continue  # no transfer for this owner
            # co-op pays owner → expected payment in DB is negative (disbursement)
            expected = round2(-net)
        else:
            s1 = S1.get(pid, 0)
            if abs(s1) < 0.005:
                continue  # no transfer
            # s1 < 0: person owes co-op → expected positive payment
            # s1 > 0: co-op owes person → expected negative payment
            expected = round2(-s1)
            net       = None

        actual = round2(pay_total.get(pid, 0))
        diff   = round2(actual - expected)

        results.append({
            "name":     name,
            "is_owner": pid in owner_ids,
            "s1":       S1.get(pid),
            "net":      net,
            "expected": expected,
            "actual":   actual,
            "diff":     diff,
        })

    return results


def status_label(exp, diff):
    if abs(diff) <= TOLERANCE:
        return "OK"
    if exp > 0 and diff > 0:
        return "OVERPAID  ▲"       # person paid more than owed → co-op owes refund
    if exp > 0 and diff < 0:
        return "STILL OWES ▼"      # person hasn't paid enough yet
    if exp < 0 and diff > 0:
        return "NOT PAID OUT ▼"    # co-op hasn't disbursed yet
    return "OVER-DISBURSED ▲"      # co-op paid out too much


def print_row(r):
    role  = "owner" if r["is_owner"] else "member"
    exp   = r["expected"]
    act   = r["actual"]
    diff  = r["diff"]
    print(f"  {r['name']:<20} {role:<10} {exp:>10.2f} {act:>10.2f} {diff:>+10.2f}  {status_label(exp, diff)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db",        default=DEFAULT_DB)
    parser.add_argument("--year",      type=int, help="Audit a single year only")
    parser.add_argument("--sum-until", type=int, metavar="YEAR",
                        help="Include years up to and including YEAR in the TOTAL row")
    parser.add_argument("--all",       action="store_true",
                        help="Show all people (not just mismatches)")
    args = parser.parse_args()

    cur   = sqlite3.connect(args.db).cursor()
    years = ([args.year] if args.year
             else sorted({r[0] for r in cur.execute("SELECT DISTINCT year FROM payments")}))

    # totals[name] = {expected, actual, diff, is_owner}
    totals: dict[str, dict] = {}

    for year in years:
        rows = compute_year(cur, year)
        if not rows:
            continue

        # Accumulate totals (optionally capped)
        if not args.year and (args.sum_until is None or year <= args.sum_until):
            for r in rows:
                if r["name"] not in totals:
                    totals[r["name"]] = {"expected": 0.0, "actual": 0.0,
                                         "diff": 0.0, "is_owner": r["is_owner"]}
                totals[r["name"]]["expected"] = round2(totals[r["name"]]["expected"] + r["expected"])
                totals[r["name"]]["actual"]   = round2(totals[r["name"]]["actual"]   + r["actual"])
                totals[r["name"]]["diff"]     = round2(totals[r["name"]]["diff"]     + r["diff"])

        show = rows if args.all else [r for r in rows if abs(r["diff"]) > TOLERANCE]
        if not show and not args.all:
            print(f"\n{'─' * 72}")
            print(f"  {year}  ✓  all settled")
            continue

        print(f"\n{'═' * 72}")
        print(f"  {year}  —  {len(show)} person(s) with mismatch" if not args.all
              else f"  {year}  —  all people with a transfer")
        print(f"  {'Name':<20} {'Type':<10} {'Expected':>10} {'Actual':>10} {'Diff':>10}  Status")
        print(f"  {'─'*20} {'─'*10} {'─'*10} {'─'*10} {'─'*10}  {'─'*12}")

        for r in sorted(show, key=lambda x: x["name"]):
            print_row(r)

    # ── TOTAL ────────────────────────────────────────────────────────────────
    if totals and not args.year:
        cap_label = f" (through {args.sum_until})" if args.sum_until else " (all years)"
        show_totals = (list(totals.values()) if args.all
                       else [v for v in totals.values() if abs(v["diff"]) > TOLERANCE])

        print(f"\n{'═' * 72}")
        print(f"  TOTAL{cap_label}")
        print(f"  {'Name':<20} {'Type':<10} {'Expected':>10} {'Actual':>10} {'Diff':>10}  Status")
        print(f"  {'─'*20} {'─'*10} {'─'*10} {'─'*10} {'─'*10}  {'─'*12}")

        for name, t in sorted(totals.items(), key=lambda x: x[1]["diff"]):
            if not args.all and abs(t["diff"]) <= TOLERANCE:
                continue
            r = {"name": name, **t}
            print_row(r)

    print()


if __name__ == "__main__":
    main()
