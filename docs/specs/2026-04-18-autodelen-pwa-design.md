# Autodelen PWA — Design Spec

**Date:** 2026-04-18 (last updated 2026-05-09)
**Project:** Self-hosted PWA for a car-sharing cooperative

---

## Overview

Autodelen is a car-sharing cooperative app used by ~15 members with a small fleet of shared cars. It tracks mileage trips, fuel fill-ups, extra costs, car reservations, and settlement payments, with a per-person balance dashboard.

The app replaced a legacy Google AppSheet + Google Sheets setup. It is self-hosted as a Docker container with SQLite, deployed behind Traefik for HTTPS.

---

## Stack

| Layer          | Technology                                                      |
| -------------- | --------------------------------------------------------------- |
| Frontend       | Next.js (App Router) + React + TypeScript                       |
| Styling        | Paper/ink design system (custom), inline styles + Tailwind v4   |
| Forms          | React Hook Form + Zod                                           |
| Data fetching  | TanStack Query                                                  |
| Database       | SQLite via `better-sqlite3` (Next.js API routes, WAL mode)      |
| Auth           | `iron-session` (cookie-based, per-person login)                 |
| PWA            | `next-pwa` (service worker, offline queue)                      |
| Maps           | Leaflet (open-source, no API key)                               |
| Calendar UI    | FullCalendar (day/week/month)                                   |
| Calendar sync  | Google Calendar API via `googleapis`                            |
| Toasts         | Sonner                                                          |
| Deployment     | Docker + Traefik (cloud-infra stacks)                           |

SQLite is intentional: low-volume, single-server, no connection pooling needed. WAL mode is enabled for concurrent reads during API route handling.

---

## Database Schema

### people

```sql
CREATE TABLE people (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  discount      REAL    NOT NULL DEFAULT 0,     -- short-trip discount rate (e.g. 0.25)
  discount_long REAL    NOT NULL DEFAULT 0,     -- long-trip discount rate (e.g. 0.50)
  active        INTEGER NOT NULL DEFAULT 1,
  username      TEXT    UNIQUE,
  password_hash TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  email         TEXT                            -- used for Google Calendar invites
);
```

### cars

```sql
CREATE TABLE cars (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  short            TEXT    NOT NULL UNIQUE,     -- e.g. AA, BB, CC
  name             TEXT    NOT NULL,
  price_per_km     REAL    NOT NULL,
  brand            TEXT,
  color            TEXT,
  owner_name       TEXT,                        -- display name (legacy)
  owner_person_id  INTEGER REFERENCES people(id), -- FK for calendar invite
  long_threshold   INTEGER NOT NULL DEFAULT 500,
  active           INTEGER NOT NULL DEFAULT 1,
  expected_km      INTEGER
);
```

### trips

```sql
CREATE TABLE trips (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id      INTEGER NOT NULL REFERENCES people(id),
  car_id         INTEGER NOT NULL REFERENCES cars(id),
  date           TEXT    NOT NULL,
  start_odometer INTEGER NOT NULL,
  end_odometer   INTEGER NOT NULL,
  km             INTEGER NOT NULL,   -- computed: end - start (stored)
  amount         REAL    NOT NULL,   -- computed (stored, see formula)
  location       TEXT,
  parking        TEXT,
  gps_coords     TEXT
);
```

**Amount formula:**

```
amount = price_per_km
       × ( min(km, long_threshold) × (1 − discount)
         + max(km − long_threshold, 0) × (1 − discount_long) )
```

### fuel_fillups

```sql
CREATE TABLE fuel_fillups (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id       INTEGER NOT NULL REFERENCES people(id),
  car_id          INTEGER NOT NULL REFERENCES cars(id),
  date            TEXT    NOT NULL,
  amount          REAL    NOT NULL,
  liters          REAL    NOT NULL,
  price_per_liter REAL    NOT NULL,  -- computed: amount / liters (stored)
  odometer        INTEGER,
  receipt         TEXT,              -- path to receipt photo
  location        TEXT,
  gps_coords      TEXT,
  full_tank       INTEGER NOT NULL DEFAULT 0
);
```

### expenses

```sql
CREATE TABLE expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   INTEGER NOT NULL REFERENCES people(id),
  car_id      INTEGER NOT NULL REFERENCES cars(id),
  date        TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  description TEXT,
  category    TEXT
);
```

### reservations

```sql
CREATE TABLE reservations (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id                 INTEGER NOT NULL REFERENCES people(id),
  car_id                    INTEGER NOT NULL REFERENCES cars(id),
  start_date                TEXT    NOT NULL,
  end_date                  TEXT    NOT NULL,
  status                    TEXT    NOT NULL DEFAULT 'pending',
  note                      TEXT,
  updated_at                TEXT,
  -- Google Calendar sync columns
  google_event_id           TEXT,
  last_synced_etag          TEXT,
  last_app_write_nonce      TEXT,
  last_known_response_status TEXT
);
```

Reservation statuses: `pending`, `confirmed`, `rejected`.

### payments

```sql
CREATE TABLE payments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id),
  date      TEXT    NOT NULL,
  amount    REAL    NOT NULL,
  note      TEXT,
  year      INTEGER NOT NULL  -- settles this year's balance
);
```

### settlements

```sql
CREATE TABLE settlements (
  year        INTEGER PRIMARY KEY,
  settled_at  TEXT NOT NULL,
  settled_by  TEXT NOT NULL
);
```

### car_price_history

```sql
CREATE TABLE car_price_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id         INTEGER NOT NULL REFERENCES cars(id),
  price_per_km   REAL    NOT NULL,
  effective_from TEXT    NOT NULL
);
```

### settings

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
```

Keys in use: `coop_bank_account`, `google_calendar_id`, `google_oauth_refresh_token`.

### calendar_sync_state

Singleton table (id always 1) tracking the active Google Calendar push channel:

```sql
CREATE TABLE calendar_sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id    TEXT NOT NULL DEFAULT '',
  resource_id   TEXT NOT NULL DEFAULT '',
  expiration_at TEXT NOT NULL DEFAULT '',
  sync_token    TEXT NOT NULL DEFAULT ''
);
```

### invite_tokens

```sql
CREATE TABLE invite_tokens (
  token      TEXT    PRIMARY KEY,
  person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL
);
```

---

## Dashboard Balance Formula

Per person, per year:

```
balance = − SUM(trips.amount)        -- cost charged for trips (negative)
          + SUM(fuel_fillups.amount)  -- fuel they paid for (positive)
          + SUM(expenses.amount)      -- extra costs they paid (positive)
          + SUM(payments.amount)      -- settlement payments (for payments.year)
```

Display: green = credit (balance > 0), red = owes (balance < 0), grey = €0.00.

See `lib/queries/settlement.ts` for the full multi-car settlement implementation.

---

## App Pages

### Member pages

| Route             | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `/`               | Dashboard — per-person annual balance, year selector |
| `/trips`          | Trips — list by month, add/edit/delete               |
| `/fuel`           | Fuel fill-ups — list by month, receipt photo         |
| `/calendar`       | Reservation calendar — timeline + upcoming list      |
| `/expenses`       | Extra expenses — list by month                       |
| `/payments`       | Settlement payments list                             |
| `/people`         | Members list                                         |
| `/cars`           | Fleet overview                                       |
| `/user/[id]`      | Member profile view                                  |
| `/user/[id]/edit` | Edit own profile (name, discount rates, email)       |

### Admin pages

| Route                   | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `/admin`                | Admin dashboard — activity feed, stats                |
| `/admin/cars`           | Fleet management — add/edit/delete cars               |
| `/admin/people`         | Member management                                     |
| `/admin/trips`          | All trips across members                              |
| `/admin/reservations`   | All reservations                                      |
| `/admin/settlement`     | Annual settlement management                          |
| `/admin/settings`       | Cooperative settings (bank account, Google Calendar)  |

### API routes

| Route                              | Method | Description                         |
| ---------------------------------- | ------ | ----------------------------------- |
| `/api/me`                          | GET    | Current session info                |
| `/api/trips`                       | GET/POST | Trips CRUD                        |
| `/api/trips/[id]`                  | PUT/DELETE | -                               |
| `/api/fuel`                        | GET/POST | Fuel fill-ups CRUD                |
| `/api/fuel/[id]`                   | PUT/DELETE | -                               |
| `/api/expenses`                    | GET/POST | Expenses CRUD                     |
| `/api/expenses/[id]`               | PUT/DELETE | -                               |
| `/api/payments`                    | GET/POST | Payments CRUD                     |
| `/api/payments/[id]`               | PUT/DELETE | -                               |
| `/api/reservations`                | GET/POST | Reservations CRUD                 |
| `/api/reservations/[id]`           | GET/PUT/DELETE | -                           |
| `/api/reservations/[id]/status`    | PATCH  | Update status only                  |
| `/api/cars`                        | GET/POST | Cars CRUD                         |
| `/api/cars/[id]`                   | GET/PUT/DELETE | -                           |
| `/api/people`                      | GET/POST | People CRUD                       |
| `/api/people/[id]/profile`         | PUT    | Update own profile                  |
| `/api/dashboard`                   | GET    | Per-person annual balance data      |
| `/api/settlement`                  | GET    | Annual settlement computation       |
| `/api/admin/settings`              | GET/PUT | Cooperative settings               |
| `/api/admin/calendar-renew`        | GET    | Register/renew Google push channel  |
| `/api/calendar-webhook`            | POST   | Receive Google Calendar push events |
| `/api/auth/login`                  | POST   | Login                               |
| `/api/auth/logout`                 | POST   | Logout                              |

---

## Authentication

`iron-session` cookie-based, **shared credentials** from environment variables (`AUTH_USERNAME` + `AUTH_PASSWORD_HASH`). Auth is enforced **client-side**: the app boots, checks `/api/me`, and redirects to `/login` if unauthenticated. No server-side middleware.

The `people` table has `username`, `password_hash`, and `is_admin` columns (added via migration) for a future per-user auth phase, but per-user login is not yet deployed.

- All authenticated users can view data, log trips/fuel/expenses, make reservations, edit own profile.
- Admins (`is_admin = 1`) can manage cars, people, settlements, and settings.

---

## Google Calendar Integration

When configured, reservations are pushed to a shared Google Calendar as all-day events. Car owners receive an invite and confirm/decline by RSVPing — the app updates reservation status automatically.

### Outbound sync (app → Calendar)

- **Create reservation** → `createEvent` (status: tentative, attendee: owner email)
- **Update reservation** → `updateEvent`
- **Delete reservation** → `deleteEvent`, then delete DB row

Sync calls are fire-and-forget (`.catch(() => {})`), except DELETE which awaits the calendar delete before removing the DB row.

### Inbound sync (Calendar → app)

Google pushes webhook events to `/api/calendar-webhook` when calendar data changes.

**Echo prevention:** each app write embeds a UUID nonce in `extendedProperties.private.appWriteNonce` and stores the returned etag as `last_synced_etag`. Incoming deltas are skipped if the etag matches (primary guard) or if the etag is absent and the nonce matches (fallback).

**App is authoritative for dates:** if an incoming delta has different start/end dates, the app immediately overwrites the calendar event.

**RSVP processing:** the owner's attendee `responseStatus` maps to reservation status: `accepted → confirmed`, `declined → rejected`. A cancelled event (owner deleted it) is treated as declined.

### Channel renewal

Google push channels expire every 7 days. `/api/admin/calendar-renew` (protected by `CRON_SECRET`) stops the old channel, registers a new one, and runs a delta catch-up. Should be called daily via cron.

---

## Key UI Patterns

- **Car selector**: toggle button group — not a dropdown
- **Person selector**: dropdown
- **Odometer fields**: ± increment/decrement buttons
- **KM & Amount**: read-only, auto-computed from odometer
- **price_per_liter**: read-only, auto-computed from amount ÷ litres
- **GPS location**: Leaflet map with current-position button
- **Receipt photo**: camera capture or file upload
- **Lists**: grouped by `YYYY-MM` with month totals
- **Floating + button**: fixed bottom-right FAB

---

## PWA / Offline

- Service worker (via `next-pwa`) caches app shell and API responses
- Installable on Android/iOS home screen
- Offline queue for entries made without connectivity

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

Environment variables required:

| Variable                    | Required | Description                            |
| --------------------------- | -------- | -------------------------------------- |
| `SESSION_PASSWORD`          | yes      | 32+ char secret for iron-session       |
| `AUTH_USERNAME`             | yes      | Shared login username                  |
| `AUTH_PASSWORD_HASH`        | yes      | bcrypt hash of shared password         |
| `NEXT_PUBLIC_BASE_URL`      | yes      | Public HTTPS URL (also for webhooks)   |
| `GOOGLE_CLIENT_ID`          | no       | OAuth client ID (Calendar integration) |
| `GOOGLE_CLIENT_SECRET`      | no       | OAuth client secret                    |
| `CRON_SECRET`               | no       | Bearer token for calendar-renew route  |
