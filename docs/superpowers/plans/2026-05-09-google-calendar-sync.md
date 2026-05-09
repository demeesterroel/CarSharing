# Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync reservations to a shared Google Calendar with owner RSVP confirmation via calendar invite accept/decline.

**Architecture:** A feature-gated calendar layer wraps all reservation writes and pushes events to Google Calendar; a webhook endpoint receives change notifications and updates reservation status from RSVP responses; a protected renewal endpoint rotates the watch channel daily via VPS crontab.

**Tech Stack:** Next.js 15 API routes, `googleapis` npm package, better-sqlite3, Vitest for tests, iron-session, Zod.

**Spec:** `docs/superpowers/specs/2026-05-09-google-calendar-sync-design.md`

**Working directory:** `/home/roeland/Projects/CarSharing` (worktree for this branch)

---

## File Map

| Action | File                                               | Purpose                                                       |
| ------ | -------------------------------------------------- | ------------------------------------------------------------- |
| Create | `migrations/0011_people_email.sql`                 | Add email column to people                                    |
| Create | `migrations/0012_cars_owner_person_id.sql`         | Add owner FK to cars                                          |
| Create | `migrations/0013_reservation_calendar_columns.sql` | 4 Google Calendar tracking columns                            |
| Create | `migrations/0014_calendar_sync_state.sql`          | Singleton watch-channel state table                           |
| Modify | `types/index.ts`                                   | Add email/owner_person_id/calendar fields + CalendarSyncState |
| Modify | `lib/__tests__/migration_0004.test.ts`             | Add 0011-0014 to skip list                                    |
| Modify | `lib/__tests__/queries_people.test.ts`             | Add email to basePerson fixture                               |
| Modify | `lib/__tests__/queries_cars.test.ts`               | Add owner_person_id to baseCar fixture                        |
| Create | `lib/google-calendar.ts`                           | OAuth2 + Calendar API wrapper                                 |
| Create | `lib/__tests__/google_calendar.test.ts`            | Tests for addDays utility                                     |
| Create | `lib/reservation-sync.ts`                          | Sync functions called from reservation routes                 |
| Create | `lib/__tests__/reservation_sync.test.ts`           | Tests with mocked google-calendar                             |
| Modify | `lib/env.ts`                                       | Add CRON_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET       |
| Modify | `hooks/use-admin-settings.ts`                      | Add calendar settings fields to type                          |
| Modify | `app/api/admin/settings/route.ts`                  | Expose/persist calendar settings                              |
| Modify | `app/admin/settings/page.tsx`                      | Add 2 calendar setting fields                                 |
| Modify | `lib/queries/people.ts`                            | Include email in insert/update SQL                            |
| Modify | `app/api/people/[id]/profile/route.ts`             | Add email to profileSchema                                    |
| Modify | `app/user/[id]/edit/page.tsx`                      | Add email field to form                                       |
| Modify | `lib/queries/cars.ts`                              | Include owner_person_id in insert/update                      |
| Modify | `lib/schemas/car.ts`                               | Add owner_person_id to carSchema                              |
| Modify | `app/api/cars/[id]/route.ts`                       | Pass owner_person_id in PUT (admin only)                      |
| Modify | `app/admin/cars/page.tsx`                          | Add owner person dropdown in CarRow                           |
| Modify | `app/api/reservations/route.ts`                    | Call syncReservationCreate after POST                         |
| Modify | `app/api/reservations/[id]/route.ts`               | Call sync on PUT / DELETE                                     |
| Modify | `app/api/reservations/[id]/status/route.ts`        | Call sync on PATCH                                            |
| Create | `lib/process-calendar-delta.ts`                    | Testable delta-processing logic                               |
| Create | `lib/__tests__/process_calendar_delta.test.ts`     | Webhook logic tests                                           |
| Create | `app/api/calendar-webhook/route.ts`                | Receives Google push notifications                            |
| Create | `app/api/admin/calendar-renew/route.ts`            | Channel renewal (called by crontab)                           |
| Create | `lib/__tests__/calendar_renew.test.ts`             | Tests for renewal logic                                       |

---

## Task 1: DB Migrations + Type Updates

**Files:**

- Create: `migrations/0011_people_email.sql`
- Create: `migrations/0012_cars_owner_person_id.sql`
- Create: `migrations/0013_reservation_calendar_columns.sql`
- Create: `migrations/0014_calendar_sync_state.sql`
- Modify: `types/index.ts`
- Modify: `lib/__tests__/migration_0004.test.ts`

- [ ] **Step 1: Write migration test**

```typescript
// lib/__tests__/migration_0011_to_0014.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";

function makeDb() {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

describe("migration 0011 — people email", () => {
  it("adds email column to people", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(people)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain("email");
  });

  it("email is nullable", () => {
    const db = makeDb();
    db.prepare("INSERT INTO people (name, active) VALUES (?, 1)").run("Alice");
    const row = db.prepare("SELECT email FROM people WHERE name = 'Alice'").get() as {
      email: string | null;
    };
    expect(row.email).toBeNull();
  });
});

describe("migration 0012 — cars owner_person_id", () => {
  it("adds owner_person_id column to cars", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(cars)").all() as { name: string }[];
    expect(cols.map((c) => c.name)).toContain("owner_person_id");
  });
});

describe("migration 0013 — reservation calendar columns", () => {
  it("adds 4 calendar columns to reservations", () => {
    const db = makeDb();
    const cols = db.prepare("PRAGMA table_info(reservations)").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toContain("google_event_id");
    expect(names).toContain("last_synced_etag");
    expect(names).toContain("last_app_write_nonce");
    expect(names).toContain("last_known_response_status");
  });
});

describe("migration 0014 — calendar_sync_state table", () => {
  it("creates calendar_sync_state table", () => {
    const db = makeDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).toContain("calendar_sync_state");
  });

  it("id = 1 check constraint enforces singleton", () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (1, 'c', 'r', '2026-01-01', 't')"
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (2, 'c', 'r', '2026-01-01', 't')"
        )
        .run()
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/migration_0011_to_0014.test.ts
```

Expected: FAIL — columns/tables do not exist yet.

- [ ] **Step 3: Create migration files**

```sql
-- migrations/0011_people_email.sql
ALTER TABLE people ADD COLUMN email TEXT;
```

```sql
-- migrations/0012_cars_owner_person_id.sql
ALTER TABLE cars ADD COLUMN owner_person_id INTEGER REFERENCES people(id);
```

```sql
-- migrations/0013_reservation_calendar_columns.sql
ALTER TABLE reservations ADD COLUMN google_event_id TEXT;
ALTER TABLE reservations ADD COLUMN last_synced_etag TEXT;
ALTER TABLE reservations ADD COLUMN last_app_write_nonce TEXT;
ALTER TABLE reservations ADD COLUMN last_known_response_status TEXT;
```

```sql
-- migrations/0014_calendar_sync_state.sql
CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id    TEXT NOT NULL DEFAULT '',
  resource_id   TEXT NOT NULL DEFAULT '',
  expiration_at TEXT NOT NULL DEFAULT '',
  sync_token    TEXT NOT NULL DEFAULT ''
);
```

Note: `DEFAULT ''` on all columns allows the webhook to upsert only the sync_token without knowing channel info.

- [ ] **Step 4: Update types/index.ts**

Add `email: string | null;` to `Person` interface (after `bank_account`):

```typescript
export interface Person {
  id: number;
  name: string;
  discount: number;
  discount_long: number;
  active: 0 | 1;
  username: string | null;
  password_hash: string | null;
  is_admin: 0 | 1;
  bank_account: string;
  email: string | null;
  updated_at: string;
}
```

Add `owner_person_id: number | null;` to `Car` interface (after `owner_to`):

```typescript
export interface Car {
  id: number;
  short: string;
  name: string;
  price_per_km: number;
  brand: string | null;
  color: string | null;
  owner_name: string | null;
  owner_from: string | null;
  owner_to: string | null;
  owner_person_id: number | null;
  long_threshold: number;
  active: 0 | 1;
  expected_km: number | null;
  updated_at: string;
}
```

Add 4 calendar columns to `Reservation` interface (after `updated_at`):

```typescript
export interface Reservation {
  id: number;
  person_id: number;
  car_id: number;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  note: string | null;
  client_id: string | null;
  updated_at: string;
  google_event_id: string | null;
  last_synced_etag: string | null;
  last_app_write_nonce: string | null;
  last_known_response_status: string | null;
  // joined
  person_name?: string;
  car_short?: string;
}
```

Add `owner_person_id?: number | null;` to `CarInput` type:

```typescript
export type CarInput = Pick<Car, "short" | "name" | "price_per_km" | "brand" | "color"> & {
  owner_name?: string | null;
  owner_person_id?: number | null;
  long_threshold?: number;
  fixed_costs_json?: string | null;
  active?: number;
  expected_km?: number | null;
};
```

Add `CalendarSyncState` interface at the end of the file:

```typescript
export interface CalendarSyncState {
  id: 1;
  channel_id: string;
  resource_id: string;
  expiration_at: string;
  sync_token: string;
}
```

- [ ] **Step 5: Update migration_0004 skip list**

In `lib/__tests__/migration_0004.test.ts`, in the `db2.exec(...)` block, add 4 rows after the existing `0010_people_bank_account.sql` line:

```typescript
      INSERT INTO _migrations (filename) VALUES ('0011_people_email.sql');
      INSERT INTO _migrations (filename) VALUES ('0012_cars_owner_person_id.sql');
      INSERT INTO _migrations (filename) VALUES ('0013_reservation_calendar_columns.sql');
      INSERT INTO _migrations (filename) VALUES ('0014_calendar_sync_state.sql');
```

- [ ] **Step 6: Run migration tests**

```bash
npx vitest run lib/__tests__/migration_0011_to_0014.test.ts lib/__tests__/migration_0004.test.ts
```

Expected: all PASS.

- [ ] **Step 7: Run full test suite to verify no regressions**

```bash
npm test
```

Expected: all existing tests still PASS. If people/cars test fixtures fail due to new required fields, see next step.

- [ ] **Step 8: Fix people and cars test fixtures if needed**

If `queries_people.test.ts` fails because `email` is now part of `Omit<Person, 'id' | 'updated_at'>`:

In `lib/__tests__/queries_people.test.ts`, add `email: null` to the `basePerson` constant:

```typescript
const basePerson = {
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
  bank_account: "",
  email: null,
};
```

If `queries_cars.test.ts` fails similarly, `CarInput` uses optional `owner_person_id` so no fixture change needed.

- [ ] **Step 9: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add migrations/0011_people_email.sql migrations/0012_cars_owner_person_id.sql \
  migrations/0013_reservation_calendar_columns.sql migrations/0014_calendar_sync_state.sql \
  types/index.ts lib/__tests__/migration_0011_to_0014.test.ts \
  lib/__tests__/migration_0004.test.ts lib/__tests__/queries_people.test.ts
git commit -m "feat(calendar): add DB migrations 0011-0014 and type updates"
```

---

## Task 2: Install googleapis + lib/google-calendar.ts

**Files:**

- Install: `googleapis` npm package
- Create: `lib/google-calendar.ts`
- Create: `lib/__tests__/google_calendar.test.ts`

- [ ] **Step 1: Install googleapis**

```bash
npm install googleapis
```

Expected: `googleapis` added to dependencies in `package.json`.

- [ ] **Step 2: Write test for addDays utility**

```typescript
// lib/__tests__/google_calendar.test.ts
import { describe, it, expect } from "vitest";
import { addDays } from "../google-calendar";

describe("addDays", () => {
  it("adds 1 day to a date string", () => {
    expect(addDays("2026-06-10", 1)).toBe("2026-06-11");
  });

  it("handles month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("handles year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/google_calendar.test.ts
```

Expected: FAIL — `addDays` not exported.

- [ ] **Step 4: Implement lib/google-calendar.ts**

```typescript
// lib/google-calendar.ts
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type { OAuth2Client };

export interface CalendarEvent {
  id?: string | null;
  etag?: string | null;
  status?: string | null;
  start?: { date?: string | null };
  end?: { date?: string | null };
  attendees?: Array<{ email?: string | null; responseStatus?: string | null }>;
  extendedProperties?: { private?: { appWriteNonce?: string | null } };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getOAuthClient(refreshToken: string): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

interface ReservationShape {
  start_date: string;
  end_date: string;
  note?: string | null;
  status?: string;
  car_short?: string | null;
  person_name?: string | null;
}

function buildEventBody(r: ReservationShape, nonce: string, ownerEmail?: string): object {
  const calStatus =
    r.status === "confirmed" ? "confirmed" : r.status === "rejected" ? "cancelled" : "tentative";
  return {
    summary: r.car_short ? `[${r.car_short}] ${r.person_name ?? ""}` : "Reservering",
    description: r.note ?? undefined,
    start: { date: r.start_date },
    end: { date: addDays(r.end_date, 1) },
    status: calStatus,
    attendees: ownerEmail ? [{ email: ownerEmail }] : undefined,
    extendedProperties: { private: { appWriteNonce: nonce } },
  };
}

export async function createEvent(
  client: OAuth2Client,
  calendarId: string,
  r: ReservationShape,
  nonce: string,
  ownerEmail?: string
): Promise<{ id: string; etag: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.insert({
    calendarId,
    requestBody: buildEventBody(r, nonce, ownerEmail),
  });
  return { id: res.data.id!, etag: res.data.etag! };
}

export async function updateEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string,
  r: ReservationShape,
  nonce: string,
  ownerEmail?: string
): Promise<{ etag: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.update({
    calendarId,
    eventId,
    requestBody: buildEventBody(r, nonce, ownerEmail),
  });
  return { etag: res.data.etag! };
}

export async function deleteEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string
): Promise<void> {
  const cal = google.calendar({ version: "v3", auth: client });
  await cal.events.delete({ calendarId, eventId });
}

export async function watchEvents(
  client: OAuth2Client,
  calendarId: string,
  webhookUrl: string,
  channelId: string
): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.watch({
    calendarId,
    requestBody: { id: channelId, type: "web_hook", address: webhookUrl },
  });
  return {
    channelId: res.data.id!,
    resourceId: res.data.resourceId!,
    expiration: new Date(Number(res.data.expiration)).toISOString(),
  };
}

export async function stopChannel(
  client: OAuth2Client,
  channelId: string,
  resourceId: string
): Promise<void> {
  const cal = google.calendar({ version: "v3", auth: client });
  await cal.channels.stop({ requestBody: { id: channelId, resourceId } });
}

export async function listEventsDelta(
  client: OAuth2Client,
  calendarId: string,
  syncToken?: string
): Promise<{ items: CalendarEvent[]; nextSyncToken: string }> {
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.events.list({ calendarId, syncToken, showDeleted: true });
  return {
    items: (res.data.items ?? []) as CalendarEvent[],
    nextSyncToken: res.data.nextSyncToken!,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/google_calendar.test.ts
```

Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/google-calendar.ts lib/__tests__/google_calendar.test.ts package.json package-lock.json
git commit -m "feat(calendar): add googleapis wrapper lib/google-calendar.ts"
```

---

## Task 3: lib/reservation-sync.ts

**Files:**

- Create: `lib/reservation-sync.ts`
- Create: `lib/__tests__/reservation_sync.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// lib/__tests__/reservation_sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import {
  syncReservationCreate,
  syncReservationUpdate,
  syncReservationDelete,
} from "../reservation-sync";

// Mock the google-calendar module
vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  createEvent: vi.fn().mockResolvedValue({ id: "evt-123", etag: '"etag-abc"' }),
  updateEvent: vi.fn().mockResolvedValue({ etag: '"etag-xyz"' }),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedReservation(db: Database.Database): number {
  db.prepare("INSERT INTO people (id, name, active) VALUES (1, 'Alice', 1)").run();
  db.prepare(
    "INSERT INTO people (id, name, active, email) VALUES (2, 'Owner Bob', 1, 'bob@example.com')"
  ).run();
  db.prepare(
    "INSERT INTO cars (id, short, name, price_per_km, owner_person_id, active) VALUES (1, 'CA', 'Car A', 0.2, 2, 1)"
  ).run();
  const result = db
    .prepare(
      "INSERT INTO reservations (person_id, car_id, start_date, end_date, status, updated_at) VALUES (1, 1, '2026-06-01', '2026-06-03', 'pending', datetime('now'))"
    )
    .run();
  return result.lastInsertRowid as number;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncReservationCreate", () => {
  it("does nothing when calendar settings are empty", async () => {
    const db = makeDb();
    seedReservation(db);
    await syncReservationCreate(db, 1);
    expect(calMock.createEvent).not.toHaveBeenCalled();
  });

  it("calls createEvent and saves event_id + etag", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationCreate(db, id);

    expect(calMock.createEvent).toHaveBeenCalledOnce();
    const row = db
      .prepare(
        "SELECT google_event_id, last_synced_etag, last_app_write_nonce FROM reservations WHERE id = ?"
      )
      .get(id) as {
      google_event_id: string;
      last_synced_etag: string;
      last_app_write_nonce: string;
    };
    expect(row.google_event_id).toBe("evt-123");
    expect(row.last_synced_etag).toBe('"etag-abc"');
    expect(row.last_app_write_nonce).toBeTruthy();
  });

  it("passes owner email to createEvent when owner has email", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationCreate(db, id);

    const callArgs = vi.mocked(calMock.createEvent).mock.calls[0];
    expect(callArgs[4]).toBe("bob@example.com");
  });
});

describe("syncReservationUpdate", () => {
  it("does nothing if reservation has no google_event_id", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");

    await syncReservationUpdate(db, id);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("calls updateEvent and updates etag", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");
    db.prepare("UPDATE reservations SET google_event_id='evt-123' WHERE id=?").run(id);

    await syncReservationUpdate(db, id);

    expect(calMock.updateEvent).toHaveBeenCalledOnce();
    const row = db.prepare("SELECT last_synced_etag FROM reservations WHERE id = ?").get(id) as {
      last_synced_etag: string;
    };
    expect(row.last_synced_etag).toBe('"etag-xyz"');
  });
});

describe("syncReservationDelete", () => {
  it("calls deleteEvent and clears calendar columns", async () => {
    const db = makeDb();
    const id = seedReservation(db);
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "refresh-token");
    db.prepare(
      "UPDATE reservations SET google_event_id='evt-123', last_synced_etag='e', last_app_write_nonce='n' WHERE id=?"
    ).run(id);

    await syncReservationDelete(db, id);

    expect(calMock.deleteEvent).toHaveBeenCalledWith(expect.anything(), "cal-id", "evt-123");
    const row = db
      .prepare("SELECT google_event_id, last_synced_etag FROM reservations WHERE id = ?")
      .get(id) as { google_event_id: string | null; last_synced_etag: string | null };
    expect(row.google_event_id).toBeNull();
    expect(row.last_synced_etag).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/reservation_sync.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement lib/reservation-sync.ts**

```typescript
// lib/reservation-sync.ts
import type Database from "better-sqlite3";
import { getSetting } from "@/lib/queries/settings";
import * as cal from "@/lib/google-calendar";

interface ReservationRow {
  id: number;
  start_date: string;
  end_date: string;
  note: string | null;
  status: string;
  car_short: string;
  person_name: string | null;
  owner_email: string | null;
  google_event_id: string | null;
}

function getCalendarCtx(
  db: Database.Database
): { client: cal.OAuth2Client; calendarId: string } | null {
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return null;
  return { client: cal.getOAuthClient(refreshToken), calendarId };
}

function getReservationForSync(db: Database.Database, id: number): ReservationRow | undefined {
  return db
    .prepare(
      `SELECT r.id, r.start_date, r.end_date, r.note, r.status, r.google_event_id,
              c.short AS car_short, rq.name AS person_name, own.email AS owner_email
       FROM reservations r
       JOIN cars c ON c.id = r.car_id
       JOIN people rq ON rq.id = r.person_id
       LEFT JOIN people own ON own.id = c.owner_person_id
       WHERE r.id = ?`
    )
    .get(id) as ReservationRow | undefined;
}

export async function syncReservationCreate(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r) return;
  const nonce = crypto.randomUUID();
  try {
    const { id: eventId, etag } = await cal.createEvent(
      ctx.client,
      ctx.calendarId,
      r,
      nonce,
      r.owner_email ?? undefined
    );
    db.prepare(
      "UPDATE reservations SET google_event_id=?, last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
    ).run(eventId, etag, nonce, id);
  } catch (e) {
    console.error("[calendar-sync] createEvent failed", e);
  }
}

export async function syncReservationUpdate(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r || !r.google_event_id) return;
  const nonce = crypto.randomUUID();
  try {
    const { etag } = await cal.updateEvent(
      ctx.client,
      ctx.calendarId,
      r.google_event_id,
      r,
      nonce,
      r.owner_email ?? undefined
    );
    db.prepare("UPDATE reservations SET last_synced_etag=?, last_app_write_nonce=? WHERE id=?").run(
      etag,
      nonce,
      id
    );
  } catch (e) {
    console.error("[calendar-sync] updateEvent failed", e);
  }
}

export async function syncReservationDelete(db: Database.Database, id: number): Promise<void> {
  const ctx = getCalendarCtx(db);
  if (!ctx) return;
  const r = getReservationForSync(db, id);
  if (!r || !r.google_event_id) return;
  try {
    await cal.deleteEvent(ctx.client, ctx.calendarId, r.google_event_id);
    db.prepare(
      "UPDATE reservations SET google_event_id=NULL, last_synced_etag=NULL, last_app_write_nonce=NULL, last_known_response_status=NULL WHERE id=?"
    ).run(id);
  } catch (e) {
    console.error("[calendar-sync] deleteEvent failed", e);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run lib/__tests__/reservation_sync.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reservation-sync.ts lib/__tests__/reservation_sync.test.ts
git commit -m "feat(calendar): add reservation-sync.ts with create/update/delete"
```

---

## Task 4: Settings Extension

**Files:**

- Modify: `lib/env.ts`
- Modify: `hooks/use-admin-settings.ts`
- Modify: `app/api/admin/settings/route.ts`
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: Add CRON_SECRET + Google OAuth env vars to lib/env.ts**

Replace the `envSchema` definition with:

```typescript
const envSchema = z.object({
  SESSION_PASSWORD: isBuildPhase
    ? z.string().optional().default("build-placeholder")
    : z.string().min(1, "SESSION_PASSWORD is required"),
  DB_PATH: z
    .string()
    .optional()
    .transform((val) => val ?? "data/carsharing.db"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  AUTH_USERNAME: z.string().optional(),
  AUTH_PASSWORD_HASH: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});
```

- [ ] **Step 2: Update hooks/use-admin-settings.ts**

Replace the `AdminSettings` interface and hook:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

interface AdminSettings {
  coop_bank_account: string;
  google_calendar_id: string;
  google_oauth_refresh_token: string;
}

export function useAdminSettings() {
  return useQuery<AdminSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch<AdminSettings>("/api/admin/settings"),
  });
}

export function useSaveAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminSettings>) =>
      apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-settings"] }),
  });
}
```

- [ ] **Step 3: Update app/api/admin/settings/route.ts**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, readBody, requireAdmin, requireAdminOrOwner } from "@/lib/api";
import { getSetting, setSetting } from "@/lib/queries/settings";

const settingsSchema = z.object({
  coop_bank_account: z.string().max(200).optional(),
  google_calendar_id: z.string().max(200).optional(),
  google_oauth_refresh_token: z.string().max(500).optional(),
});

export const GET = json(async (req) => {
  await requireAdminOrOwner(req);
  const db = getDb();
  return NextResponse.json({
    coop_bank_account: getSetting(db, "coop_bank_account"),
    google_calendar_id: getSetting(db, "google_calendar_id"),
    google_oauth_refresh_token: getSetting(db, "google_oauth_refresh_token"),
  });
});

export const PUT = json(async (req) => {
  await requireAdmin(req);
  const data = await readBody(req, settingsSchema);
  const db = getDb();
  if (data.coop_bank_account !== undefined)
    setSetting(db, "coop_bank_account", data.coop_bank_account);
  if (data.google_calendar_id !== undefined)
    setSetting(db, "google_calendar_id", data.google_calendar_id);
  if (data.google_oauth_refresh_token !== undefined)
    setSetting(db, "google_oauth_refresh_token", data.google_oauth_refresh_token);
  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 4: Update app/admin/settings/page.tsx**

Add state vars and UI for the 2 new fields. Replace the full component:

```typescript
"use client";
import { useState, useEffect } from "react";
import { paper, fontMono, fontSerif } from "@/lib/paper-theme";
import { useAdminSettings, useSaveAdminSettings } from "@/hooks/use-admin-settings";
import { Card, Perf } from "../_shared";
import { useT } from "@/components/locale-provider";

export default function AdminSettingsPage() {
  const t = useT();
  const { data, isLoading } = useAdminSettings();
  const save = useSaveAdminSettings();
  const [bankAccount, setBankAccount] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  useEffect(() => {
    if (data) {
      setBankAccount(data.coop_bank_account);
      setCalendarId(data.google_calendar_id);
      setRefreshToken(data.google_oauth_refresh_token);
    }
  }, [data]);

  const inputStyle = (dirty: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "8px 10px",
    fontFamily: fontMono,
    fontSize: 12,
    background: paper.paperDark,
    color: paper.ink,
    border: `1.5px solid ${dirty ? paper.ink : paper.paperDark}`,
    outline: "none",
    boxSizing: "border-box",
    letterSpacing: 1,
    marginBottom: 8,
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: fontMono,
    fontSize: 9,
    color: paper.inkMute,
    letterSpacing: 1,
    marginBottom: 4,
  };

  const saveField = (key: string, value: string) =>
    save.mutate({ [key]: value } as any);

  return (
    <div style={{ padding: 16, maxWidth: 480 }}>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Instellingen
      </div>

      <Card>
        <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 700, color: paper.ink, marginBottom: 12 }}>
          Coöperatie bankrekening
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, marginBottom: 8 }}>
          Wordt vermeld in het betalingsbericht voor leden.
        </div>
        <Perf margin="0 0 12px" />
        {isLoading ? (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>…</div>
        ) : (
          <>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="BE12 3456 7890 1234"
              style={inputStyle(data ? bankAccount !== data.coop_bank_account : false)}
            />
            <button
              onClick={() => saveField("coop_bank_account", bankAccount)}
              disabled={!(data && bankAccount !== data.coop_bank_account) || save.isPending}
              style={{
                width: "100%",
                padding: "8px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background: data && bankAccount !== data.coop_bank_account ? paper.ink : paper.paperDark,
                color: data && bankAccount !== data.coop_bank_account ? paper.paper : paper.inkMute,
                border: "none",
                cursor: data && bankAccount !== data.coop_bank_account ? "pointer" : "default",
              }}
            >
              {t("action.save")}
            </button>
          </>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontFamily: fontSerif, fontSize: 14, fontWeight: 700, color: paper.ink, marginBottom: 12 }}>
          Google Calendar
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 9, color: paper.inkMute, letterSpacing: 1, marginBottom: 12 }}>
          Laat leeg om de integratie uit te schakelen.
        </div>
        {isLoading ? (
          <div style={{ fontFamily: fontMono, fontSize: 10, color: paper.inkMute }}>…</div>
        ) : (
          <>
            <label style={labelStyle}>Google Calendar ID</label>
            <input
              type="text"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="abc123@group.calendar.google.com"
              style={inputStyle(data ? calendarId !== data.google_calendar_id : false)}
            />
            <label style={labelStyle}>OAuth Refresh Token</label>
            <input
              type="password"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="••••••••"
              style={inputStyle(data ? refreshToken !== data.google_oauth_refresh_token : false)}
            />
            <button
              onClick={() =>
                save.mutate({
                  google_calendar_id: calendarId,
                  google_oauth_refresh_token: refreshToken,
                })
              }
              disabled={
                !(
                  data &&
                  (calendarId !== data.google_calendar_id ||
                    refreshToken !== data.google_oauth_refresh_token)
                ) || save.isPending
              }
              style={{
                marginTop: 4,
                width: "100%",
                padding: "8px",
                fontFamily: fontMono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                background:
                  data &&
                  (calendarId !== data.google_calendar_id ||
                    refreshToken !== data.google_oauth_refresh_token)
                    ? paper.ink
                    : paper.paperDark,
                color:
                  data &&
                  (calendarId !== data.google_calendar_id ||
                    refreshToken !== data.google_oauth_refresh_token)
                    ? paper.paper
                    : paper.inkMute,
                border: "none",
                cursor:
                  data &&
                  (calendarId !== data.google_calendar_id ||
                    refreshToken !== data.google_oauth_refresh_token)
                    ? "pointer"
                    : "default",
              }}
            >
              {t("action.save")}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
```

Note: `Card` may not accept a `style` prop — if it doesn't, wrap in a `<div style={{ marginTop: 16 }}>`.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/env.ts hooks/use-admin-settings.ts app/api/admin/settings/route.ts app/admin/settings/page.tsx
git commit -m "feat(calendar): extend admin settings with Google Calendar fields"
```

---

## Task 5: People Email Field

**Files:**

- Modify: `lib/queries/people.ts`
- Modify: `app/api/people/[id]/profile/route.ts`
- Modify: `app/user/[id]/edit/page.tsx`

- [ ] **Step 1: Update lib/queries/people.ts**

In `insertPerson`, add `email` to the SQL:

```typescript
export function insertPerson(
  db: Database.Database,
  data: Omit<Person, "id" | "updated_at">
): number {
  const result = db
    .prepare(
      "INSERT INTO people (name,discount,discount_long,active,username,is_admin,bank_account,email) VALUES (?,?,?,?,?,?,?,?)"
    )
    .run(
      data.name,
      data.discount,
      data.discount_long,
      data.active,
      data.username ?? null,
      data.is_admin ?? 0,
      data.bank_account ?? "",
      data.email ?? null
    );
  return result.lastInsertRowid as number;
}
```

In `updatePerson`, add `email` to the SQL:

```typescript
export function updatePerson(
  db: Database.Database,
  id: number,
  data: Omit<Person, "id" | "updated_at">
): void {
  db.prepare(
    "UPDATE people SET name=?,discount=?,discount_long=?,active=?,username=?,is_admin=?,bank_account=?,email=? WHERE id=?"
  ).run(
    data.name,
    data.discount,
    data.discount_long,
    data.active,
    data.username ?? null,
    data.is_admin ?? 0,
    data.bank_account ?? "",
    data.email ?? null,
    id
  );
}
```

- [ ] **Step 2: Update profileSchema in app/api/people/[id]/profile/route.ts**

```typescript
const profileSchema = z.object({
  name: z.string().min(1),
  bank_account: z.string().default(""),
  email: z
    .string()
    .email()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
```

- [ ] **Step 3: Add email field to app/user/[id]/edit/page.tsx**

Add `email` state after `bankAccount`:

```typescript
const [email, setEmail] = useState("");
```

In the `useEffect` that loads the person, add:

```typescript
setEmail(p.email ?? "");
```

Update the `dirty` check:

```typescript
const dirty =
  name !== person.name ||
  bankAccount !== (person.bank_account ?? "") ||
  email !== (person.email ?? "");
```

Update `handleSubmit` to include email:

```typescript
body: JSON.stringify({ name, bank_account: bankAccount, email: email || null }),
```

Add the email input field in the form (after the bank account field, before the submit button):

```tsx
<div style={{ marginBottom: 16 }}>
  <label
    htmlFor="edit-email"
    style={{
      display: "block",
      fontFamily: fontMono,
      fontSize: 9,
      color: paper.inkMute,
      letterSpacing: 1,
      marginBottom: 4,
    }}
  >
    {t("form.email")}
  </label>
  <input
    id="edit-email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="naam@voorbeeld.be"
    style={{
      width: "100%",
      padding: "8px 10px",
      fontFamily: fontMono,
      fontSize: 12,
      background: paper.paperDark,
      color: paper.ink,
      border: `1.5px solid ${email !== (person.email ?? "") ? paper.ink : paper.paperDark}`,
      outline: "none",
      boxSizing: "border-box",
      letterSpacing: 1,
    }}
  />
</div>
```

- [ ] **Step 4: Add i18n key**

In `lib/i18n/nl.ts`, add `"form.email": "E-mailadres"`.
In `lib/i18n/en.ts`, add `"form.email": "Email address"`.

Find the i18n files:

```bash
find /home/roeland/Projects/CarSharing -name "nl.ts" -path "*/i18n/*" | head -3
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS (the people test fixtures need `email: null` — already handled in Task 1 Step 8).

- [ ] **Step 6: Commit**

```bash
git add lib/queries/people.ts app/api/people/\[id\]/profile/route.ts app/user/\[id\]/edit/page.tsx
git commit -m "feat(calendar): add email field to people + user edit form"
```

---

## Task 6: Cars owner_person_id

**Files:**

- Modify: `lib/queries/cars.ts`
- Modify: `lib/schemas/car.ts`
- Modify: `app/api/cars/[id]/route.ts`
- Modify: `app/admin/cars/page.tsx`

- [ ] **Step 1: Update lib/queries/cars.ts**

In `insertCar`, add `owner_person_id`:

```typescript
export function insertCar(db: Database.Database, data: CarInput): number {
  return db.transaction((d: CarInput) => {
    const result = db
      .prepare(
        "INSERT INTO cars (short,name,price_per_km,brand,color,owner_name,long_threshold,owner_person_id) VALUES (?,?,?,?,?,?,?,?)"
      )
      .run(
        d.short,
        d.name,
        d.price_per_km,
        d.brand ?? null,
        d.color ?? null,
        d.owner_name ?? null,
        d.long_threshold ?? 500,
        d.owner_person_id ?? null
      );
    const newId = result.lastInsertRowid as number;
    recordPriceHistory(db, newId, d.price_per_km);
    return newId;
  })(data);
}
```

In `updateCar`, add `owner_person_id` to the UPDATE statement (inside the transaction):

```typescript
db.prepare(
  "UPDATE cars SET short=?,name=?,price_per_km=?,brand=?,color=?,owner_name=?,long_threshold=?,active=?,expected_km=?,owner_person_id=? WHERE id=?"
).run(
  args.data.short,
  args.data.name,
  args.data.price_per_km,
  args.data.brand ?? null,
  args.data.color ?? null,
  args.data.owner_name ?? null,
  args.data.long_threshold ?? 500,
  args.data.active ?? 1,
  args.data.expected_km ?? null,
  args.data.owner_person_id ?? null,
  args.id
);
```

- [ ] **Step 2: Update lib/schemas/car.ts**

Add `owner_person_id` to `carSchema`:

```typescript
export const carSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  color: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  owner_name: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  owner_person_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  long_threshold: z.number().int().positive().optional().default(500),
  active: z.number().int().min(0).max(1).optional().default(1),
  expected_km: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});
```

- [ ] **Step 3: Update app/api/cars/[id]/route.ts for admin PUT**

In the `if (!session.isAdmin)` branch, the existing owner patch stays unchanged (no `owner_person_id` in `ownerCarPatchSchema`). In the admin branch, `carSchema` already passes `owner_person_id` through via `readBody`. No code change needed in the route itself — the schema update in Step 2 is sufficient.

- [ ] **Step 4: Add owner person dropdown in app/admin/cars/page.tsx**

In the `CarRow` component, `usePeople` is already imported. Add `ownerPersonId` state alongside `owner`:

Find the line:

```typescript
const [owner, setOwner] = useState(car.owner_name ?? "");
```

After it, add:

```typescript
const [ownerPersonId, setOwnerPersonId] = useState<number | null>(car.owner_person_id ?? null);
```

Update the `dirty` check to include `ownerPersonId`:

```typescript
const dirty =
  name !== car.name ||
  price !== car.price_per_km ||
  owner !== (car.owner_name ?? "") ||
  ownerPersonId !== (car.owner_person_id ?? null);
```

Update the `reset` function:

```typescript
const reset = () => {
  setName(car.name);
  setPrice(car.price_per_km);
  setOwner(car.owner_name ?? "");
  setOwnerPersonId(car.owner_person_id ?? null);
};
```

Update the `prevId` sync block to include `ownerPersonId`:

```typescript
if (car.id !== prevId) {
  setPrevId(car.id);
  setName(car.name);
  setPrice(car.price_per_km);
  setOwner(car.owner_name ?? "");
  setOwnerPersonId(car.owner_person_id ?? null);
}
```

Add a person dropdown after the owner text input in the active car form. Find the owner_name input section and add after it:

```tsx
<div style={{ marginBottom: 12 }}>
  <label style={labelStyle}>Eigenaar (persoon)</label>
  <select
    value={ownerPersonId ?? ""}
    onChange={(e) => setOwnerPersonId(e.target.value ? Number(e.target.value) : null)}
    style={{
      ...inputStyle,
      background: paper.paperDeep,
    }}
  >
    <option value="">— geen —</option>
    {people.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    ))}
  </select>
</div>
```

Include `owner_person_id` in the `onSave` call. Find where `onSave` is called and include it:

```typescript
onSave({ name, price_per_km: price, owner_name: owner || null, owner_person_id: ownerPersonId });
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/cars.ts lib/schemas/car.ts app/api/cars/\[id\]/route.ts app/admin/cars/page.tsx
git commit -m "feat(calendar): add owner_person_id FK to cars"
```

---

## Task 7: Hook Reservation Routes into Sync

**Files:**

- Modify: `app/api/reservations/route.ts`
- Modify: `app/api/reservations/[id]/route.ts`
- Modify: `app/api/reservations/[id]/status/route.ts`

These are fire-and-forget async calls (no `await` — the route responds immediately, sync runs in background). If sync fails, it logs but the reservation operation succeeds.

- [ ] **Step 1: Update app/api/reservations/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationCreate } from "@/lib/reservation-sync";

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const raw = await req.json();
  const body = reservationSchema.parse(raw);
  const client_id = typeof raw.client_id === "string" ? raw.client_id : null;
  const db = getDb();
  const id = insertReservation(db, { ...body, client_id });
  syncReservationCreate(db, id).catch(() => {});
  return NextResponse.json({ id }, { status: 201 });
});
```

- [ ] **Step 2: Update app/api/reservations/[id]/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
  ConflictError,
} from "@/lib/queries/reservations";
import { json, readBody, readId, notFound } from "@/lib/api";
import { reservationSchema } from "@/lib/schemas/reservation";
import { syncReservationUpdate, syncReservationDelete } from "@/lib/reservation-sync";

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getReservationById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, reservationSchema);
  const expectedUpdatedAt = req.headers.get("X-Expected-Updated-At") ?? undefined;
  const db = getDb();
  try {
    updateReservation(db, id, body, { expectedUpdatedAt });
    syncReservationUpdate(db, id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const db = getDb();
  await syncReservationDelete(db, id).catch(() => {});
  const result = db.prepare("DELETE FROM reservations WHERE id = ?").run(id);
  return NextResponse.json({ deleted: result.changes > 0 });
});
```

Note: For DELETE, we `await` the sync so the Google event is deleted before the row disappears from DB (the sync reads the row to get `google_event_id`).

- [ ] **Step 3: Update app/api/reservations/[id]/status/route.ts**

```typescript
import { getDb } from "@/lib/db";
import { updateReservationStatus } from "@/lib/queries/reservations";
import { json, readBody, readId } from "@/lib/api";
import { reservationStatusSchema } from "@/lib/schemas/reservation";
import { syncReservationUpdate } from "@/lib/reservation-sync";

export const PATCH = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, reservationStatusSchema);
  const db = getDb();
  updateReservationStatus(db, id, body.status);
  syncReservationUpdate(db, id).catch(() => {});
  return { ok: true };
});
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/reservations/route.ts app/api/reservations/\[id\]/route.ts app/api/reservations/\[id\]/status/route.ts
git commit -m "feat(calendar): hook reservation routes into calendar sync"
```

---

## Task 8: Delta Processing + Webhook Handler

**Files:**

- Create: `lib/process-calendar-delta.ts`
- Create: `lib/__tests__/process_calendar_delta.test.ts`
- Create: `app/api/calendar-webhook/route.ts`

- [ ] **Step 1: Write tests for delta processor**

```typescript
// lib/__tests__/process_calendar_delta.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import { processCalendarDelta } from "../process-calendar-delta";
import type { CalendarEvent } from "../google-calendar";

vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  updateEvent: vi.fn().mockResolvedValue({ etag: '"new-etag"' }),
  addDays: (d: string, n: number) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  },
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seedWithEvent(db: Database.Database, overrides: Record<string, unknown> = {}) {
  db.prepare(
    "INSERT INTO people (id, name, active, email) VALUES (1, 'Alice', 1, null), (2, 'Owner Bob', 1, 'bob@example.com') ON CONFLICT DO NOTHING"
  ).run();
  db.prepare(
    "INSERT INTO cars (id, short, name, price_per_km, owner_person_id, active) VALUES (1, 'CA', 'Car A', 0.2, 2, 1) ON CONFLICT DO NOTHING"
  ).run();
  const defaults = {
    google_event_id: "evt-123",
    last_synced_etag: '"old-etag"',
    last_app_write_nonce: "nonce-abc",
    last_known_response_status: "needsAction",
    status: "pending",
  };
  const merged = { ...defaults, ...overrides };
  db.prepare(
    `INSERT INTO reservations (person_id, car_id, start_date, end_date, status, updated_at,
      google_event_id, last_synced_etag, last_app_write_nonce, last_known_response_status)
     VALUES (1, 1, '2026-06-01', '2026-06-03', ?, datetime('now'), ?, ?, ?, ?)`
  ).run(
    merged.status,
    merged.google_event_id,
    merged.last_synced_etag,
    merged.last_app_write_nonce,
    merged.last_known_response_status
  );
}

const fakeClient = {} as any;
const calendarId = "cal-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processCalendarDelta", () => {
  it("skips events not found in reservations", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [{ id: "unknown-evt", etag: '"new"' }];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("skips event if etag matches last_synced_etag (echo)", async () => {
    const db = makeDb();
    seedWithEvent(db, { last_synced_etag: '"same-etag"' });
    const events: CalendarEvent[] = [{ id: "evt-123", etag: '"same-etag"' }];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("skips event if appWriteNonce matches last_app_write_nonce (echo)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        extendedProperties: { private: { appWriteNonce: "nonce-abc" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).not.toHaveBeenCalled();
  });

  it("overwrites calendar when time is edited (app is authoritative)", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-07-01" }, // wrong date
        end: { date: "2026-07-04" },
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    expect(calMock.updateEvent).toHaveBeenCalledOnce();
  });

  it("updates reservation to confirmed when owner accepts", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" }, // end_date + 1 (exclusive)
        attendees: [{ email: "bob@example.com", responseStatus: "accepted" }],
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    const row = db
      .prepare(
        "SELECT status, last_known_response_status FROM reservations WHERE google_event_id = 'evt-123'"
      )
      .get() as { status: string; last_known_response_status: string };
    expect(row.status).toBe("confirmed");
    expect(row.last_known_response_status).toBe("accepted");
  });

  it("updates reservation to rejected when owner declines", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        attendees: [{ email: "bob@example.com", responseStatus: "declined" }],
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    const row = db
      .prepare("SELECT status FROM reservations WHERE google_event_id = 'evt-123'")
      .get() as { status: string };
    expect(row.status).toBe("rejected");
  });

  it("treats cancelled event (owner deleted invite) as declined", async () => {
    const db = makeDb();
    seedWithEvent(db);
    const events: CalendarEvent[] = [
      {
        id: "evt-123",
        etag: '"different-etag"',
        status: "cancelled",
        start: { date: "2026-06-01" },
        end: { date: "2026-06-04" },
        extendedProperties: { private: { appWriteNonce: "other-nonce" } },
      },
    ];
    await processCalendarDelta(db, fakeClient, calendarId, events);
    const row = db
      .prepare("SELECT status FROM reservations WHERE google_event_id = 'evt-123'")
      .get() as { status: string };
    expect(row.status).toBe("rejected");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/process_calendar_delta.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement lib/process-calendar-delta.ts**

```typescript
// lib/process-calendar-delta.ts
import type Database from "better-sqlite3";
import type { OAuth2Client } from "google-auth-library";
import { addDays, updateEvent } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/lib/google-calendar";

interface ReservationRowForDelta {
  id: number;
  start_date: string;
  end_date: string;
  note: string | null;
  status: string;
  car_short: string;
  last_synced_etag: string | null;
  last_app_write_nonce: string | null;
  last_known_response_status: string | null;
  owner_email: string | null;
}

export async function processCalendarDelta(
  db: Database.Database,
  client: OAuth2Client,
  calendarId: string,
  items: CalendarEvent[]
): Promise<void> {
  for (const event of items) {
    if (!event.id) continue;

    const row = db
      .prepare(
        `SELECT r.id, r.start_date, r.end_date, r.note, r.status, r.last_synced_etag,
                r.last_app_write_nonce, r.last_known_response_status,
                c.short AS car_short, own.email AS owner_email
         FROM reservations r
         JOIN cars c ON c.id = r.car_id
         LEFT JOIN people own ON own.id = c.owner_person_id
         WHERE r.google_event_id = ?`
      )
      .get(event.id) as ReservationRowForDelta | undefined;

    if (!row) continue;

    // Echo check — skip writes originating from the app itself
    if (event.etag != null && event.etag === row.last_synced_etag) continue;
    if (
      event.extendedProperties?.private?.appWriteNonce != null &&
      event.extendedProperties.private.appWriteNonce === row.last_app_write_nonce
    )
      continue;

    // Time-edit guard — app is authoritative for event times
    // Skip time check for cancelled events (start/end may be absent)
    const expectedEnd = addDays(row.end_date, 1);
    if (
      event.status !== "cancelled" &&
      (event.start?.date !== row.start_date || event.end?.date !== expectedEnd)
    ) {
      const nonce = crypto.randomUUID();
      try {
        const { etag } = await updateEvent(
          client,
          calendarId,
          event.id,
          {
            start_date: row.start_date,
            end_date: row.end_date,
            note: row.note,
            status: row.status,
            car_short: row.car_short,
          },
          nonce,
          row.owner_email ?? undefined
        );
        db.prepare(
          "UPDATE reservations SET last_synced_etag=?, last_app_write_nonce=? WHERE id=?"
        ).run(etag, nonce, row.id);
      } catch (e) {
        console.error("[calendar-delta] overwrite time edit failed", e);
      }
      continue;
    }

    // RSVP check
    let newResponseStatus: string;
    if (event.status === "cancelled") {
      newResponseStatus = "declined";
    } else {
      const ownerEmail = row.owner_email;
      const attendee = ownerEmail
        ? event.attendees?.find((a) => a.email === ownerEmail)
        : undefined;
      newResponseStatus = attendee?.responseStatus ?? "needsAction";
    }

    if (newResponseStatus !== row.last_known_response_status) {
      let newStatus: string | null = null;
      if (newResponseStatus === "accepted") newStatus = "confirmed";
      else if (newResponseStatus === "declined") newStatus = "rejected";

      if (newStatus) {
        db.prepare("UPDATE reservations SET status=? WHERE id=?").run(newStatus, row.id);
      }
      db.prepare(
        "UPDATE reservations SET last_known_response_status=?, last_synced_etag=? WHERE id=?"
      ).run(newResponseStatus, event.etag ?? null, row.id);
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run lib/__tests__/process_calendar_delta.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Create app/api/calendar-webhook/route.ts**

```typescript
// app/api/calendar-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSetting } from "@/lib/queries/settings";
import { getOAuthClient, listEventsDelta } from "@/lib/google-calendar";
import { processCalendarDelta } from "@/lib/process-calendar-delta";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Initial handshake from Google
  const resourceState = req.headers.get("x-goog-resource-state");
  if (resourceState === "sync") return NextResponse.json({ ok: true });

  const db = getDb();
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return NextResponse.json({ ok: true });

  const client = getOAuthClient(refreshToken);
  const stateRow = db.prepare("SELECT sync_token FROM calendar_sync_state WHERE id = 1").get() as
    | { sync_token: string }
    | undefined;

  let items: Awaited<ReturnType<typeof listEventsDelta>>["items"];
  let nextSyncToken: string;

  try {
    ({ items, nextSyncToken } = await listEventsDelta(
      client,
      calendarId,
      stateRow?.sync_token || undefined
    ));
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 410) {
      // syncToken invalidated — full re-sync
      ({ items, nextSyncToken } = await listEventsDelta(client, calendarId));
    } else {
      console.error("[calendar-webhook] listEventsDelta failed", e);
      return NextResponse.json({ ok: true });
    }
  }

  // Upsert sync_token (INSERT sets defaults for other columns if row doesn't exist yet)
  db.prepare(
    `INSERT INTO calendar_sync_state (id, sync_token) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET sync_token = excluded.sync_token`
  ).run(nextSyncToken);

  await processCalendarDelta(db, client, calendarId, items);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/process-calendar-delta.ts lib/__tests__/process_calendar_delta.test.ts app/api/calendar-webhook/route.ts
git commit -m "feat(calendar): add delta processor and webhook handler"
```

---

## Task 9: Channel Renewal Endpoint

**Files:**

- Create: `app/api/admin/calendar-renew/route.ts`
- Create: `lib/__tests__/calendar_renew.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// lib/__tests__/calendar_renew.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import { setSetting } from "../queries/settings";
import { handleCalendarRenew } from "../calendar-renew";

vi.mock("../google-calendar", () => ({
  getOAuthClient: vi.fn(() => ({})),
  stopChannel: vi.fn().mockResolvedValue(undefined),
  watchEvents: vi.fn().mockResolvedValue({
    channelId: "new-ch",
    resourceId: "new-res",
    expiration: "2026-05-16T04:00:00.000Z",
  }),
  listEventsDelta: vi.fn().mockResolvedValue({ items: [], nextSyncToken: "new-tok" }),
}));

import * as calMock from "../google-calendar";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleCalendarRenew", () => {
  it("returns skipped:disabled when settings are empty", async () => {
    const db = makeDb();
    const result = await handleCalendarRenew(db, "https://example.com");
    expect(result).toEqual({ ok: true, skipped: "disabled" });
    expect(calMock.watchEvents).not.toHaveBeenCalled();
  });

  it("returns skipped:not_due when channel expires in >5 days", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");
    const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (1, 'ch', 'res', ?, 'tok')"
    ).run(future);

    const result = await handleCalendarRenew(db, "https://example.com");
    expect(result).toEqual({ ok: true, skipped: "not_due" });
    expect(calMock.watchEvents).not.toHaveBeenCalled();
  });

  it("renews channel when it expires in <5 days", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token) VALUES (1, 'old-ch', 'old-res', ?, 'old-tok')"
    ).run(soon);

    const result = await handleCalendarRenew(db, "https://example.com");

    expect(calMock.stopChannel).toHaveBeenCalledWith(expect.anything(), "old-ch", "old-res");
    expect(calMock.watchEvents).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, renewed: true });

    const row = db
      .prepare("SELECT channel_id, sync_token FROM calendar_sync_state WHERE id = 1")
      .get() as { channel_id: string; sync_token: string };
    expect(row.channel_id).toBe("new-ch");
    expect(row.sync_token).toBe("new-tok");
  });

  it("does initial setup when no state row exists", async () => {
    const db = makeDb();
    setSetting(db, "google_calendar_id", "cal-id");
    setSetting(db, "google_oauth_refresh_token", "rt");

    const result = await handleCalendarRenew(db, "https://example.com");

    expect(calMock.stopChannel).not.toHaveBeenCalled();
    expect(calMock.watchEvents).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: true, renewed: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/calendar_renew.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create lib/calendar-renew.ts (shared logic, testable)**

```typescript
// lib/calendar-renew.ts
import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { getSetting } from "@/lib/queries/settings";
import { getOAuthClient, watchEvents, stopChannel, listEventsDelta } from "@/lib/google-calendar";
import { processCalendarDelta } from "@/lib/process-calendar-delta";

export interface RenewResult {
  ok: boolean;
  skipped?: string;
  renewed?: boolean;
  expiresAt?: string;
}

export async function handleCalendarRenew(
  db: Database.Database,
  baseUrl: string
): Promise<RenewResult> {
  const calendarId = getSetting(db, "google_calendar_id");
  const refreshToken = getSetting(db, "google_oauth_refresh_token");
  if (!calendarId || !refreshToken) return { ok: true, skipped: "disabled" };

  const client = getOAuthClient(refreshToken);

  const stateRow = db.prepare("SELECT * FROM calendar_sync_state WHERE id = 1").get() as
    | {
        channel_id: string;
        resource_id: string;
        expiration_at: string;
        sync_token: string;
      }
    | undefined;

  if (stateRow) {
    const expiresMs = new Date(stateRow.expiration_at).getTime();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    if (expiresMs - Date.now() > fiveDaysMs) {
      return { ok: true, skipped: "not_due" };
    }
    try {
      await stopChannel(client, stateRow.channel_id, stateRow.resource_id);
    } catch (e) {
      console.error("[calendar-renew] stopChannel failed (continuing)", e);
    }
  }

  const channelId = randomUUID();
  const webhookUrl = `${baseUrl}/api/calendar-webhook`;
  const newChannel = await watchEvents(client, calendarId, webhookUrl, channelId);

  // Catch up on missed events
  let nextSyncToken = stateRow?.sync_token;
  try {
    const delta = await listEventsDelta(client, calendarId, stateRow?.sync_token);
    nextSyncToken = delta.nextSyncToken;
    await processCalendarDelta(db, client, calendarId, delta.items);
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 410) {
      const delta = await listEventsDelta(client, calendarId);
      nextSyncToken = delta.nextSyncToken;
      await processCalendarDelta(db, client, calendarId, delta.items);
    } else {
      console.error("[calendar-renew] listEventsDelta failed", e);
    }
  }

  db.prepare(
    `INSERT INTO calendar_sync_state (id, channel_id, resource_id, expiration_at, sync_token)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       channel_id=excluded.channel_id,
       resource_id=excluded.resource_id,
       expiration_at=excluded.expiration_at,
       sync_token=excluded.sync_token`
  ).run(newChannel.channelId, newChannel.resourceId, newChannel.expiration, nextSyncToken ?? "");

  return { ok: true, renewed: true, expiresAt: newChannel.expiration };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run lib/__tests__/calendar_renew.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Create app/api/admin/calendar-renew/route.ts**

```typescript
// app/api/admin/calendar-renew/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { handleCalendarRenew } from "@/lib/calendar-renew";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const result = await handleCalendarRenew(getDb(), baseUrl);
  return NextResponse.json(result);
}
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/calendar-renew.ts lib/__tests__/calendar_renew.test.ts app/api/admin/calendar-renew/route.ts
git commit -m "feat(calendar): add channel renewal lib + /api/admin/calendar-renew route"
```

---

## Final Verification

- [ ] **Run complete test suite one last time**

```bash
npm test
```

Expected: all PASS, no regressions.

- [ ] **Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Deployment notes (do not commit — document for ops)**

Add to `.env.local`:

```
CRON_SECRET=<random 32-char string, e.g. openssl rand -hex 16>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Add to `docker-compose.yml` env block:

```yaml
- CRON_SECRET=${CRON_SECRET}
- GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
- GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
```

VPS crontab (run `crontab -e` as root):

```
0 4 * * * curl -sf -H "Authorization: Bearer $CRON_SECRET" https://autodelen.bluette.be/api/admin/calendar-renew >> /var/log/autodelen-calendar-renew.log 2>&1
```

One-time initial setup after deploy:

1. Go to Admin → Instellingen, fill in Google Calendar ID + OAuth Refresh Token.
2. Call `curl -H "Authorization: Bearer $CRON_SECRET" https://autodelen.bluette.be/api/admin/calendar-renew` to create the initial watch channel.
3. Go to Admin → Cars, link each car to its owner person.
4. Go to `/user/[id]/edit` for each car owner, fill in their email address.
