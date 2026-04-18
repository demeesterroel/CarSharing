# Autodelen PWA — Design Spec

**Date:** 2026-04-18  
**Project:** Convert Google AppSheet "Autodelen" app to a self-hosted PWA  
**Target repo:** `cloud-infra/stacks/autodelen/`

---

## Overview

Autodelen is a car-sharing cooperative app used by ~15 members with 3 shared cars (Ethel/ETH, Jean-Francois/JF, Lewis/LEW). It tracks mileage trips, fuel fill-ups, extra costs, car reservations, and settlement payments, with a per-person balance dashboard.

The current implementation is Google AppSheet backed by Google Sheets. The goal is to replace it with a self-hosted PWA built with the same stack as `sacred-fire-songs`, backed by SQLite, deployed as a Docker container in the existing homelab via Traefik.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + Radix UI + Lucide icons |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack Query |
| Database | SQLite via `better-sqlite3` (Next.js API routes) |
| PWA | `next-pwa` (service worker, offline queue) |
| Maps | Leaflet (open-source, no API key) |
| Calendar | FullCalendar (day/week/month) |
| Toasts | Sonner |
| Deployment | Docker + Traefik (cloud-infra stacks) |

SQLite is chosen deliberately: this is a low-volume, low-user, single-server app. No connection pooling or separate DB container needed.

---

## Database Schema

### people
```sql
CREATE TABLE people (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  korting      REAL DEFAULT 0,   -- short-trip discount rate (e.g. 0.25)
  korting_long REAL DEFAULT 0,   -- long-trip discount rate (e.g. 0.50)
  active  INTEGER DEFAULT 1      -- 1 = active
);
```

### cars
```sql
CREATE TABLE cars (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  short TEXT NOT NULL,   -- ETH, JF, LEW
  name  TEXT NOT NULL,   -- Ethel, Jean-Francois, Lewis
  prijs REAL NOT NULL,   -- price per km (e.g. 0.20)
  merk  TEXT,            -- brand
  kleur TEXT             -- color
);
```

### ritten (mileage trips)
```sql
CREATE TABLE ritten (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  car_id    INTEGER NOT NULL REFERENCES cars(id),
  datum     TEXT NOT NULL,     -- ISO date
  start     INTEGER NOT NULL,  -- odometer start
  eind      INTEGER NOT NULL,  -- odometer end
  km        INTEGER NOT NULL,  -- computed: eind - start (stored)
  bedrag    REAL NOT NULL,     -- computed (stored, see formula below)
  locatie   TEXT               -- "lat, lng"
);
```

**Bedrag formula:**
```
bedrag = car.prijs
       × ( min(km, 500) × (1 − person.korting)
         + max(km − 500, 0) × (1 − person.korting_long) )
```
First 500 km charged at short-trip rate, remainder at long-trip rate. Both `km` and `bedrag` are computed on write and stored.

### tankbeurten (fuel fill-ups)
```sql
CREATE TABLE tankbeurten (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id      INTEGER NOT NULL REFERENCES people(id),
  car_id         INTEGER NOT NULL REFERENCES cars(id),
  datum          TEXT NOT NULL,
  bedrag         REAL NOT NULL,   -- amount paid €
  liter          REAL NOT NULL,   -- litres
  prijs_liter    REAL NOT NULL,   -- computed: bedrag / liter (stored)
  kilometerstand INTEGER,         -- odometer at fill-up
  bonnetje       TEXT             -- path to receipt photo
);
```

### kosten (extra costs)
```sql
CREATE TABLE kosten (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   INTEGER NOT NULL REFERENCES people(id),
  car_id      INTEGER NOT NULL REFERENCES cars(id),
  datum       TEXT NOT NULL,
  bedrag      REAL NOT NULL,
  omschrijving TEXT             -- e.g. "Verkeersbelasting", "Autokeuring"
);
```

### reservations (calendar bookings)
```sql
CREATE TABLE reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id  INTEGER NOT NULL REFERENCES people(id),
  car_id     INTEGER NOT NULL REFERENCES cars(id),
  start_date TEXT NOT NULL,   -- ISO date
  end_date   TEXT NOT NULL    -- ISO date
);
```

### betaald (settlement payments)
```sql
CREATE TABLE betaald (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id  INTEGER NOT NULL REFERENCES people(id),
  datum      TEXT NOT NULL,
  bedrag     REAL NOT NULL,
  opmerking  TEXT,            -- e.g. "Vereffening 2024"
  year       INTEGER NOT NULL -- datum year − 1 (payment settles previous year)
);
```

---

## Dashboard Balance Formula

Per person, per year:

```
saldo = SUM(ritten.bedrag)      -- negative (cost charged for trips)
      + SUM(tankbeurten.bedrag) -- positive (fuel they paid for)
      + SUM(kosten.bedrag)      -- positive (extra costs they paid)
      + SUM(betaald.bedrag)     -- settlement payments (attributed to betaald.year)
```

Display: green = credit (saldo > 0), red = owes (saldo < 0), grey = €0.00.  
Message: "Je krijgt €X" / "vereffend" / "Je bent €X verschuldigd".

Dashboard also shows per-person stats: `rit_aantal`, `rit_km`, `tank_aantal`, `tank_liter`.

---

## App Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Balance per person per year, yearly selector |
| `/ritten` | Kilometers | List grouped by year-month with totals, add/edit/delete |
| `/tanken` | Tanken | List grouped by year-month, add/edit with receipt photo |
| `/calendar` | Calendar | Day/Week/Month reservation view, add/edit reservations |
| `/people` | People | Member list, korting rates, trip/fuel counts |
| `/cars` | Cars | Car list, prijs/km, merk, kleur |
| `/kosten` | Extra Kosten | Maintenance/tax costs grouped by year-month |
| `/betaald` | Betalingen | Settlement payments list, add payment |

Navigation: slide-out drawer (hamburger) matching AppSheet's menu style.

---

## Key UI Patterns

- **Car selector**: toggle button group (ETH / JF / LEW) — not a dropdown
- **Person selector**: dropdown (Naam)
- **Odometer fields**: ± increment/decrement buttons
- **KM & Bedrag**: read-only, auto-computed as user enters start/eind
- **prijs_liter**: read-only, auto-computed from bedrag ÷ liter
- **GPS location (ritten)**: Leaflet map with current-position capture button
- **Receipt photo (tankbeurten)**: camera capture or file upload
- **Lists**: grouped by `YYYY-M` with month total shown in badge
- **Floating + button**: fixed bottom-right FAB to add new entry

---

## PWA / Offline

- Service worker (via `next-pwa`) caches app shell and API responses
- New entries made offline are queued in IndexedDB
- On reconnect, TanStack Query background sync flushes the queue
- Installable on Android/iOS home screen

---

## Authentication

Phase 1: single shared user, no login required (local network access).  
Phase 2: per-user login (NextAuth or similar) — designed to add without schema changes (add `user_id` to session, map to `people.id`).

---

## Docker Deployment

```
cloud-infra/stacks/autodelen/
  docker-compose.yml    # Next.js container + Traefik labels
  Dockerfile            # Node 20 alpine, next build + start
  data/
    autodelen.db        # SQLite file (volume mount)
    uploads/            # Receipt photos (volume mount)
```

Traefik handles HTTPS termination and routing. The container runs `next start` on port 3000.

---

## Data Migration

Existing AppSheet/Google Sheets data can be exported to CSV and imported via a one-off migration script (`scripts/migrate.ts`) that reads each sheet and inserts into SQLite preserving all historical records.
