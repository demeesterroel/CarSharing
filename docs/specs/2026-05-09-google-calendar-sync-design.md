# Google Calendar Sync Design

**Issue:** #115 — Two-way sync with shared Google Calendar (RSVP-based confirmation)

---

## Goal

Push all reservations to a shared Google Calendar. Car owners confirm/decline reservations by responding to a calendar invite — no app login required. The app watches for RSVP changes and updates reservation status automatically.

Feature is opt-in: disabled until `google_calendar_id` and `google_oauth_refresh_token` are both set in admin settings.

---

## Data model changes

### 4 new migrations

**`0011_people_email.sql`**

```sql
ALTER TABLE people ADD COLUMN email TEXT;
```

**`0012_cars_owner_person_id.sql`**

```sql
ALTER TABLE cars ADD COLUMN owner_person_id INTEGER REFERENCES people(id);
```

**`0013_reservation_calendar_columns.sql`**

```sql
ALTER TABLE reservations ADD COLUMN google_event_id TEXT;
ALTER TABLE reservations ADD COLUMN last_synced_etag TEXT;
ALTER TABLE reservations ADD COLUMN last_app_write_nonce TEXT;
ALTER TABLE reservations ADD COLUMN last_known_response_status TEXT;
```

**`0014_calendar_sync_state.sql`**

```sql
CREATE TABLE IF NOT EXISTS calendar_sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id    TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  expiration_at TEXT NOT NULL,
  sync_token    TEXT NOT NULL
);
```

Singleton row (id = 1 constraint enforces one row only).

---

## Settings

Two new keys added to the existing KV settings table:

| Key                          | Default | Description                                            |
| ---------------------------- | ------- | ------------------------------------------------------ |
| `google_calendar_id`         | `''`    | Shared calendar (e.g. `abc@group.calendar.google.com`) |
| `google_oauth_refresh_token` | `''`    | Long-lived OAuth2 refresh token for the Gmail account  |

Added to `Admin → Instellingen` alongside `coop_bank_account`. Refresh token field renders as `type="password"` (masked).

Feature gate: both must be non-empty for any calendar operation to run.

---

## UI changes

### `app/user/[id]/edit/page.tsx`

Add **Email** field (below IBAN):

- Editable by the user themselves or admin
- Saved via existing `PATCH /api/people/[id]/profile`
- `profileSchema` extended with optional `email: z.string().email().optional()`
- Used by calendar sync to invite the owner as attendee

### Admin cars edit

Add **Owner** dropdown: select a person from `people` table → stores `owner_person_id`.

Car admin page (`app/admin/cars/`) gains a person picker. `updateCar` query updated to include `owner_person_id`.

---

## New environment variable

| Var           | Purpose                                             |
| ------------- | --------------------------------------------------- |
| `CRON_SECRET` | Bearer token protecting `/api/admin/calendar-renew` |

Added to `.env.local` and docker-compose env block.

---

## Components

### `lib/google-calendar.ts`

Thin wrapper around the Google Calendar API. All methods accept an `OAuth2Client` (produced internally from the stored refresh token).

```typescript
getOAuthClient(refreshToken: string): OAuth2Client

createEvent(client, calendarId, reservation, nonce: string, ownerEmail?: string): Promise<{ id: string; etag: string }>
updateEvent(client, calendarId, eventId, reservation, nonce: string, ownerEmail?: string): Promise<{ etag: string }>
deleteEvent(client, calendarId, eventId): Promise<void>

watchEvents(client, calendarId, webhookUrl, channelId): Promise<{
  channelId: string; resourceId: string; expiration: string
}>
stopChannel(client, channelId, resourceId): Promise<void>
listEventsDelta(client, calendarId, syncToken?: string): Promise<{
  items: CalendarEvent[]; nextSyncToken: string
}>
```

Event shape written to calendar:

- `summary`: `[CAR] Firstname Lastname`
- `description`: reservation note (if any)
- `start` / `end`: all-day events (date only, no timezone)
- `status`: `tentative` (pending), `confirmed` (confirmed), `cancelled` (declined/deleted)
- `attendees`: `[{ email: ownerEmail }]` — only when owner has email set
- `extendedProperties.private.appWriteNonce`: UUID written on every app-originated write

### `lib/process-calendar-delta.ts`

Handles incoming webhook delta processing: echo check, time-edit guard, RSVP processing. Called by both `/api/calendar-webhook` and `/api/admin/calendar-renew` (catch-up delta).

### `lib/reservation-sync.ts`

Called after every reservation write. Gates on settings. Handles create/update/delete.

```typescript
syncReservationCreate(db, reservationId): Promise<void>
syncReservationUpdate(db, reservationId): Promise<void>
syncReservationDelete(db, reservationId): Promise<void>
```

All three:

1. Load settings — if either key empty, return.
2. Load reservation + car + owner person (via `owner_person_id`).
3. Call appropriate Calendar API method.
4. Generate `nonce = crypto.randomUUID()`.
5. Write returned `google_event_id`, `etag`, `nonce` back to reservation row.

On delete: call `deleteEvent` then clear all four calendar columns.

### `app/api/calendar-webhook/route.ts`

Receives Google push notifications. Google does **not** send event data — just a "something changed" ping.

```
POST /api/calendar-webhook
Headers: X-Goog-Channel-Id, X-Goog-Resource-State, X-Goog-Resource-Id
```

Handler logic:

```
1. If X-Goog-Resource-State == 'sync': return 200 (initial handshake, no-op)

2. Load calendarId + refreshToken from settings; if either empty → 200 (disabled)

3. Load sync_token from calendar_sync_state

4. Call listEventsDelta(calendarId, syncToken)
   - On 410 Gone (invalid syncToken): full re-sync (listEventsDelta with no token), rebuild state
   - Save nextSyncToken to calendar_sync_state

5. For each event in delta items:
   a. Find reservation by google_event_id; if not found → skip

   b. Echo check:
      - If event.etag == reservation.last_synced_etag → skip
      - If event.extendedProperties.private.appWriteNonce == reservation.last_app_write_nonce → skip

   c. Time-edit guard (app is authoritative for times):
      Note: Google Calendar all-day events use exclusive end dates. App stores inclusive
      end_date, so the expected Google end = addDays(reservation.end_date, 1).
      - If event.start.date != reservation.start_date OR event.end.date != addDays(reservation.end_date, 1):
        → call updateEvent to overwrite from DB
        → save new etag + nonce
        → continue (don't process RSVP on this delta)

   d. RSVP check:
      - ownerEmail = car.owner.email
      - ownerAttendee = event.attendees.find(a => a.email == ownerEmail)
      - newStatus = ownerAttendee?.responseStatus ?? 'needsAction'
      - If event.status == 'cancelled': newStatus = 'declined' (owner deleted invite)
      - If newStatus != reservation.last_known_response_status:
        → 'accepted'  → reservation.status = 'confirmed'
        → 'declined'  → reservation.status = 'declined'
        → save new etag + last_known_response_status

6. Return 200
```

No authentication on this endpoint (Google does not send a secret). Rate-limit risk is low — only Google's IPs post here, and the handler is idempotent.

### `app/api/admin/calendar-renew/route.ts`

```
GET /api/admin/calendar-renew
Authorization: Bearer <CRON_SECRET>
```

Logic:

```
1. Verify Authorization header matches CRON_SECRET; else 401

2. Load settings; if disabled → return { ok: true, skipped: 'disabled' }

3. Load calendar_sync_state row
   If no row: go to step 5 (initial setup)

4. If expiration_at > now + 5 days: return { ok: true, skipped: 'not_due' }

5. If existing channel: stopChannel(channel_id, resource_id)

6. channelId = crypto.randomUUID()
   webhookUrl = `${NEXT_PUBLIC_BASE_URL}/api/calendar-webhook`
   newChannel = watchEvents(calendarId, webhookUrl, channelId)

7. Upsert calendar_sync_state (id=1) with new channel_id, resource_id, expiration_at

8. Catch up on missed events:
   delta = listEventsDelta(calendarId, existing sync_token or undefined)
   Process delta same as webhook handler (steps 5a–5d above)
   Save nextSyncToken

9. Return { ok: true, renewed: true, expiresAt: newChannel.expiration }
```

---

## Data flow summary

```
Reservation CRUD routes
  → lib/reservation-sync.ts
  → lib/google-calendar.ts → Google Calendar API
  ← store google_event_id, last_synced_etag, last_app_write_nonce

Google Calendar change
  → POST /api/calendar-webhook
  → listEventsDelta (sync pull)
  → echo check → time-edit guard → RSVP check
  → update reservation.status + last_known_response_status

VPS crontab (daily at 04:00)
  → GET /api/admin/calendar-renew
  → renew watch channel if <5d remaining
  → catch-up delta pull
```

---

## Deployment

### New env vars

Add to `.env.local` and `docker-compose.yml` env block:

```
CRON_SECRET=<random 32-char string>
```

### VPS crontab

```bash
# /etc/cron.d/autodelen  (or added to root crontab)
0 4 * * * root curl -sf \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://autodelen.bluette.be/api/admin/calendar-renew \
  >> /var/log/autodelen-calendar-renew.log 2>&1
```

### Initial setup (one-time, admin)

1. Generate OAuth2 refresh token for the shared Gmail account (Google OAuth playground or gcloud CLI).
2. Fill in `google_calendar_id` + `google_oauth_refresh_token` in `Admin → Instellingen`.
3. Call `/api/admin/calendar-renew` once manually to create the initial watch channel.
4. Fill in `email` on each car owner's profile (`/user/[id]/edit`).
5. Link each car to its owner in the cars admin page.

---

## Error handling

| Scenario                               | Handling                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Calendar API down on reservation write | Log error, continue — reservation saved in DB; sync will not retry automatically (acceptable: manual re-sync is low-risk) |
| syncToken 410 Gone                     | Full re-list, rebuild sync state                                                                                          |
| Watch channel expires before renewal   | Daily cron at 5-day threshold provides 2-day buffer; on-renewal delta pull catches missed events                          |
| No owner email on car                  | Event created without attendee (read-only sync, no RSVP)                                                                  |
| No owner_person_id on car              | Same as above                                                                                                             |

---

## Out of scope

- WhatsApp notification on reservation change (same sync hook, separate sink — tracked in separate issue)
- Per-user calendar feeds (ICS)
- OAuth flow in the app UI (refresh token generated out-of-band, pasted into settings)
- Retry queue for failed calendar writes
