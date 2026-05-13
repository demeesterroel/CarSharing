#!/usr/bin/env python3
"""
Universal CarSharing comparison tool.

Sources:  gsheet | local | prod | <path/to/file.db>

  gsheet  — Google Sheet (downloads fresh xlsx unless --no-refresh)
  local   — data/carsharing.db
  prod    — scp prod DB to /tmp/prod.db first (unless --no-refresh)
  <path>  — any SQLite file path

Examples:
  python3 scripts/compare.py                         # gsheet vs local (default)
  python3 scripts/compare.py gsheet prod             # gsheet vs prod
  python3 scripts/compare.py local prod              # local vs prod
  python3 scripts/compare.py gsheet /tmp/other.db
  python3 scripts/compare.py local prod --table trips
  python3 scripts/compare.py gsheet local --no-refresh
"""

import argparse
import sqlite3
import subprocess
import urllib.request
from collections import Counter, namedtuple
from datetime import datetime

import openpyxl

GSHEET_URL       = ("https://docs.google.com/spreadsheets/d/"
                    "17_BBYzLg9uWGDV1MTzUfQ6JTtDbxQjVgNBhyD2O6MPY/export?format=xlsx")
DEFAULT_XLSX     = "data/CarSharing.xlsx"
DEFAULT_LOCAL_DB = "data/carsharing.db"
DEFAULT_PROD_DB  = "/tmp/prod.db"
PROD_SSH         = "root@100.86.173.115"
PROD_DB_REMOTE   = "/opt/dockge/stacks/autodelen/data/carsharing.db"


# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt(d):
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10] if d else ""


def real_rows(wb, sheet, min_cols=3):
    ws = wb[sheet]
    return [r for r in ws.iter_rows(values_only=True)
            if sum(1 for v in r if v is not None) >= min_cols]


def excess_rows(rows, keyfn, own_counts, other_counts, fmtfn):
    seen = Counter()
    result = []
    for r in sorted(rows, key=lambda r: str(r[0]) if not isinstance(r[0], datetime) else fmt(r[0])):
        k = keyfn(r)
        excess = own_counts[k] - other_counts.get(k, 0)
        if excess > 0 and seen[k] < excess:
            seen[k] += 1
            result.append(fmtfn(r))
    return result


def section(title, rows1, rows2, only1, only2, dups1, dups2, label1, label2):
    status = "OK" if not only1 and not only2 and len(rows1) == len(rows2) else "DIFF"
    print(f"\n{'=' * 68}")
    print(f"[{status}] {title}")
    print(f"  {label1}={len(rows1)} (unique={len(rows1) - dups1})  "
          f"{label2}={len(rows2)} (unique={len(rows2) - dups2})")
    if only1:
        print(f"  ── In {label1}, missing from {label2} ({len(only1)}) ──")
        for r in only1:
            print(f"    {label1}> {r}")
    if only2:
        print(f"  ── In {label2}, missing from {label1} ({len(only2)}) ──")
        for r in only2:
            print(f"    {label2}> {r}")


TableData = namedtuple("TableData", ["rows", "keyfn", "fmtfn"])


def compare_table(td1, td2, title, label1, label2):
    c1 = Counter(td1.keyfn(r) for r in td1.rows)
    c2 = Counter(td2.keyfn(r) for r in td2.rows)
    d1 = sum(n - 1 for n in c1.values() if n > 1)
    d2 = sum(n - 1 for n in c2.values() if n > 1)
    only1 = excess_rows(td1.rows, td1.keyfn, c1, c2, td1.fmtfn)
    only2 = excess_rows(td2.rows, td2.keyfn, c2, c1, td2.fmtfn)
    section(title, td1.rows, td2.rows, only1, only2, d1, d2, label1, label2)


# ── GsheetSource ──────────────────────────────────────────────────────────────

class GsheetSource:
    def __init__(self, wb):
        self.wb = wb

    def trips(self):
        rows = [r for r in real_rows(self.wb, "kilometers")[1:] if r[3] and r[4] is not None]
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[3]), int(r[4] or 0), int(r[5] or 0)),
            fmtfn=lambda r: (f"{fmt(r[3])} | {str(r[1]):12} | {str(r[2]):16} | "
                             f"odo={int(r[4] or 0)}→{int(r[5] or 0)} km={r[6]} €{r[7]} | loc={r[9]}"),
        )

    def fuel(self):
        rows = [r for r in real_rows(self.wb, "tankbeurten")[1:] if r[3] and r[4] is not None]
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[3]), round(float(r[4] or 0), 2), round(float(r[5] or 0), 2)),
            fmtfn=lambda r: (f"{fmt(r[3])} | {str(r[1]):12} | {str(r[2]):16} | "
                             f"€{r[4]} L={r[5]} price/L={r[6]} odo={r[7]} receipt={r[8]}"),
        )

    def expenses(self, cars=None):
        rows = [r for r in real_rows(self.wb, "kosten")[1:] if r[3] is not None]
        car_name_id = {v: k for k, v in (cars or {}).items()}
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[3]), round(float(r[4] or 0), 2),
                             int(car_name_id.get(str(r[2]), 0))),
            fmtfn=lambda r: f"{fmt(r[3])} | {str(r[1]):12} | {str(r[2]):16} | €{r[4]} | {r[5]}",
        )

    def payments(self):
        rows = [r for r in real_rows(self.wb, "betalingen")[1:]
                if r[1] is not None and r[3] is not None]
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[2]), round(float(r[3] or 0), 2), (r[4] or "").strip()),
            fmtfn=lambda r: (f"{fmt(r[2])} | {str(r[1]):15} | €{float(r[3]):>10.2f} | "
                             f"note={r[4] or ''} | year={r[5]}"),
        )


# ── DbSource ──────────────────────────────────────────────────────────────────

class DbSource:
    def __init__(self, cur, people, cars):
        self.cur    = cur
        self.people = people
        self.cars   = cars

    def trips(self):
        rows = self.cur.execute(
            "SELECT date, start_odometer, end_odometer, km, amount, person_id, car_id, parking, location "
            "FROM trips ORDER BY date"
        ).fetchall()
        p, c = self.people, self.cars
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[0]), int(r[1] or 0), int(r[2] or 0)),
            fmtfn=lambda r: (f"{r[0]} | {p.get(r[5], f'p#{r[5]}'):20} | {c.get(r[6], f'c#{r[6]}'):6} | "
                             f"odo={r[1]}→{r[2]} km={r[3]} €{r[4]} | loc={r[8]}"),
        )

    def fuel(self):
        rows = self.cur.execute(
            "SELECT date, amount, liters, person_id, car_id, price_per_liter, odometer, receipt "
            "FROM fuel_fillups ORDER BY date"
        ).fetchall()
        p, c = self.people, self.cars
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[0]), round(float(r[1] or 0), 2), round(float(r[2] or 0), 2)),
            fmtfn=lambda r: (f"{r[0]} | {p.get(r[3], f'p#{r[3]}'):20} | {c.get(r[4], f'c#{r[4]}'):6} | "
                             f"€{r[1]} L={r[2]} price/L={r[5]} odo={r[6]} receipt={r[7]}"),
        )

    def expenses(self, cars=None):
        rows = self.cur.execute(
            "SELECT date, amount, description, person_id, car_id FROM expenses ORDER BY date"
        ).fetchall()
        p, c = self.people, self.cars
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[0]), round(float(r[1] or 0), 2), int(r[4] or 0)),
            fmtfn=lambda r: (f"{r[0]} | {p.get(r[3], f'p#{r[3]}'):20} | {c.get(r[4], f'c#{r[4]}'):16} | "
                             f"€{r[1]} | {r[2]}"),
        )

    def payments(self):
        rows = self.cur.execute(
            "SELECT id, date, amount, person_id, note FROM payments ORDER BY date"
        ).fetchall()
        p = self.people
        return TableData(
            rows,
            keyfn=lambda r: (fmt(r[1]), round(float(r[2] or 0), 2), (r[4] or "").strip()),
            fmtfn=lambda r: (f"{r[1]} | {p.get(r[3], f'p#{r[3]}'):15} | "
                             f"€{float(r[2]):>10.2f} | note={r[4] or ''}"),
        )


# ── Source resolution ──────────────────────────────────────────────────────────

def resolve_source(spec, xlsx_path, no_refresh):
    """Return (source_object, label). Downloads gsheet or prod DB if needed."""
    if spec == "gsheet":
        if not no_refresh:
            print(f"Downloading gsheet → {xlsx_path} ...", end=" ", flush=True)
            req = urllib.request.Request(GSHEET_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as r, open(xlsx_path, "wb") as f:
                data = r.read(); f.write(data)
            print(f"{len(data) // 1024} KB")
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
        return GsheetSource(wb), "gsheet"

    if spec == "prod":
        if not no_refresh:
            print("Downloading prod DB via scp ...", end=" ", flush=True)
            for suffix in ["", "-shm", "-wal"]:
                subprocess.run(
                    ["scp", f"{PROD_SSH}:{PROD_DB_REMOTE}{suffix}", f"{DEFAULT_PROD_DB}{suffix}"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
            print("done")
        db_path = DEFAULT_PROD_DB
        label   = "prod"
    elif spec == "local":
        db_path = DEFAULT_LOCAL_DB
        label   = "local"
    else:
        db_path = spec
        label   = spec

    cur    = sqlite3.connect(db_path).cursor()
    people = {r[0]: f"{r[1]} {r[2] or ''}".strip()
              for r in cur.execute("SELECT id, first_name, last_name FROM people")}
    cars   = {r[0]: r[1] for r in cur.execute("SELECT id, name FROM cars")}
    return DbSource(cur, people, cars), label


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src1", nargs="?", default="gsheet",
                        help="gsheet | local | prod | <db-path>  (default: gsheet)")
    parser.add_argument("src2", nargs="?", default="local",
                        help="local | prod | <db-path>           (default: local)")
    parser.add_argument("--xlsx",       default=DEFAULT_XLSX)
    parser.add_argument("--no-refresh", action="store_true", help="Skip downloads")
    parser.add_argument("--table",      choices=["trips", "fuel", "expenses", "payments"])
    args = parser.parse_args()

    src1, label1 = resolve_source(args.src1, args.xlsx, args.no_refresh)
    src2, label2 = resolve_source(args.src2, args.xlsx, args.no_refresh)

    # gsheet expenses key needs car name→id from a DB source
    ref_cars = src2.cars if isinstance(src1, GsheetSource) else (
               src1.cars if isinstance(src2, GsheetSource) else src1.cars)

    run = args.table
    if not run or run == "trips":
        compare_table(src1.trips(), src2.trips(),
                      "TRIPS  (key: date + start_odo + end_odo)", label1, label2)
    if not run or run == "fuel":
        compare_table(src1.fuel(), src2.fuel(),
                      "FUEL  (key: date + amount€ + liters)", label1, label2)
    if not run or run == "expenses":
        compare_table(src1.expenses(ref_cars), src2.expenses(ref_cars),
                      "EXPENSES  (key: date + amount + car_id)", label1, label2)
    if not run or run == "payments":
        compare_table(src1.payments(), src2.payments(),
                      "PAYMENTS  (key: date + amount + note)", label1, label2)
    print()


if __name__ == "__main__":
    main()
