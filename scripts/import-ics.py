#!/usr/bin/env python3
"""
Import reservations from Google Calendar ICS into the CarSharing app.

Usage:
  python3 scripts/import-ics.py --dry-run   # preview what will be imported
  python3 scripts/import-ics.py             # actually import
"""

import re
import sys
import json
import urllib.request
import urllib.parse
from datetime import date, timedelta, datetime

ICS_FILE = "/home/roeland/Downloads/autodelen.antwerpen@gmail.com.ical/autodelen.antwerpen@gmail.com.ics"
BASE_URL  = "http://localhost:3000"
USERNAME  = "autodelen.antwerpen"
PASSWORD  = None  # set via env or prompt below

DRY_RUN = "--dry-run" in sys.argv

# ── Mappings ──────────────────────────────────────────────────────────────────

CAR_ALIASES = {
    "jf":            2, "jean":       2, "jean-francois": 2, "jean francois": 2,
    "jeanfrancois":  2, "jeanfrançois": 2, "fjf": 2,
    "ethel":         1, "eth":        1, "et":   1,
    "bessie":        4, "bessy":      4, "bsy":  4, "bessye": 4,
    "lewis":         3, "lew":        3,
}

PERSON_ALIASES = {
    "roeland":  16, "roel":    16, "roma":    None,  # RoMa = ambiguous, skip
    "malvina":  13, "malvi":   13, "malbiba": 13,
    "susanna":  19, "sus":     19, "susnana": 19,
    "stefaan":  17, "stefan":  17, "stefasn": 17,
    "steven":   18, "stevb": 18, "syeven": 18,
    "joris":     9,
    "wouter":   23,
    "wouterlc": 24, "wouter lecot": 24, "wouter lekak": 24, "wouter dm": 23,
    "lecot": 24, "lekak": 24, "wlekak": 24,  # disambiguate Wouter Lecot from Wouter DM
    "leila":    12,
    "monica":   14,
    "inez":      8, "inès":    8,
    "hannah":    7,
    "tinne":    21,
    "sverre":   20, "svrre":   20,
    "armando":   1,
    "bas":       3,
    "bouke":     4,
    "david":     5,
    "gerry":     6,
    "komu":     10,
    "lander":   11,
    "mukta":    15,
    "wim":      22,
    "kaatje":   None,  # not in DB
    "muriel":   None,  # not in DB
    "adnan":    None,
    "marie":    None,
    "filbert":  None,
}

# Words in the summary that indicate this is NOT a member reservation
SKIP_KEYWORDS = [
    "onderhoud", "garage", "keuring", "garagist", "rijbewijs",
    "drivy", "getaround", "italië", "italie", "santiago", "rotterdam",
    "utrecht", "lokaal", "talent", "jarig", "travel", "advice",
    "booking", "sleutel", "uitladen", "papa", "mama", "haalt", "lezing",
    "key of life", "co-housing", "cohousing", "naar garage",
    "groot onderhoud", "naar garagist",
]

# ── ICS parser (no dependencies) ─────────────────────────────────────────────

def parse_ics(path):
    events = []
    with open(path, encoding="utf-8", errors="replace") as f:
        raw = f.read()

    # Unfold continuation lines (lines starting with space/tab)
    raw = re.sub(r"\r?\n[ \t]", "", raw)

    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.DOTALL):
        ev = {}
        for line in block.strip().splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                ev[k.strip()] = v.strip()
        events.append(ev)
    return events

def parse_date(key, ev):
    """Return a date object from a DTSTART/DTEND field."""
    # Find the key (could be DTSTART, DTSTART;VALUE=DATE, DTSTART;TZID=...)
    for k, v in ev.items():
        if k == key or k.startswith(key + ";"):
            v = v.replace("Z", "")
            if "T" in v:
                # datetime — take the date part (UTC is fine for day-level reservations)
                return datetime.strptime(v[:8], "%Y%m%d").date()
            else:
                return datetime.strptime(v[:8], "%Y%m%d").date()
    return None

def is_all_day(key, ev):
    for k in ev:
        if k == key or k.startswith(key + ";"):
            return "VALUE=DATE" in k or "T" not in ev.get(k, "T")
    return False

# ── Summary parser ────────────────────────────────────────────────────────────

SPLIT_RE = re.compile(r"[@:\-\+&,/]|\s+")

def normalise(word):
    return word.lower().strip("?! ")

def identify(summary):
    """Return (car_id, person_id, note) or None if not a valid reservation."""
    low = summary.lower()

    # Hard skip
    for kw in SKIP_KEYWORDS:
        if kw in low:
            return None

    tokens = [normalise(t) for t in SPLIT_RE.split(summary) if t.strip()]
    tokens = [t for t in tokens if t]

    car_id = None
    person_id = None
    note_tokens = []

    for tok in tokens:
        if tok in CAR_ALIASES:
            car_id = CAR_ALIASES[tok]
        elif tok in PERSON_ALIASES:
            pid = PERSON_ALIASES[tok]
            if pid is None:
                return None  # known-unknown person
            person_id = pid
        elif len(tok) >= 3:
            note_tokens.append(tok)

    if car_id is None or person_id is None:
        return None

    note = " ".join(note_tokens) if note_tokens else None
    return car_id, person_id, note

# ── Auth ──────────────────────────────────────────────────────────────────────

def get_session_cookie():
    import os, getpass
    pw = os.environ.get("AUTODELEN_PASSWORD") or getpass.getpass(f"Password for {USERNAME}: ")
    body = json.dumps({"username": USERNAME, "password": pw}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req)
        cookie = resp.headers.get("Set-Cookie", "")
        # extract session cookie name=value
        m = re.search(r"(autodelen_session=[^;]+)", cookie)
        if m:
            return m.group(1)
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)
    print("No session cookie returned")
    sys.exit(1)

def post_reservation(cookie, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/reservations",
        data=body,
        headers={"Content-Type": "application/json", "Cookie": cookie},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.request.HTTPError as e:
        return {"error": e.read().decode()}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    events = parse_ics(ICS_FILE)
    print(f"Found {len(events)} events in ICS\n")

    to_import = []
    skipped   = []

    for ev in events:
        summary = ev.get("SUMMARY", "").strip()
        if not summary:
            continue

        result = identify(summary)
        if result is None:
            skipped.append(summary)
            continue

        car_id, person_id, note = result

        start = parse_date("DTSTART", ev)
        end   = parse_date("DTEND",   ev)
        if start is None or end is None:
            skipped.append(f"{summary} (no dates)")
            continue

        # iCalendar DTEND for all-day events is exclusive — subtract one day
        if is_all_day("DTEND", ev):
            end = end - timedelta(days=1)

        # Keep end >= start
        if end < start:
            end = start

        # Skip very old events (before 2018) or future > 2 years
        if start.year < 2018 or start.year > 2027:
            skipped.append(f"{summary} ({start}) — out of range")
            continue

        to_import.append({
            "summary":   summary,
            "person_id": person_id,
            "car_id":    car_id,
            "start_date": start.isoformat(),
            "end_date":   end.isoformat(),
            "note":      note,
            "status":    "confirmed",
        })

    print(f"=== WILL IMPORT ({len(to_import)}) ===")
    for r in to_import:
        print(f"  {r['start_date']} → {r['end_date']}  car={r['car_id']}  person={r['person_id']}  [{r['summary']}]")

    print(f"\n=== SKIPPING ({len(skipped)}) ===")
    for s in skipped:
        print(f"  {s}")

    if DRY_RUN:
        print("\n(dry-run — pass no args to actually import)")
        return

    print(f"\nImporting {len(to_import)} reservations...")
    cookie = get_session_cookie()

    ok = 0
    for r in to_import:
        payload = {k: r[k] for k in ("person_id","car_id","start_date","end_date","note","status")}
        res = post_reservation(cookie, payload)
        if "id" in res:
            ok += 1
        else:
            print(f"  ERROR: {r['summary']} → {res}")

    print(f"\nDone: {ok}/{len(to_import)} imported successfully.")

if __name__ == "__main__":
    main()
