import type { Person } from "@/types";
import type Database from "better-sqlite3";
export { fullNameOf, shortNameOf } from "@/lib/person-utils";

// Strip internal-only columns (password hash, session epoch) from public-facing
// person objects.
function strip(p: Person): Person {
  const {
    password_hash: _ph,
    session_epoch: _se,
    ...rest
  } = p as Person & {
    password_hash: string | null;
    session_epoch?: number;
  };
  return rest as unknown as Person;
}

export function getPeople(db: Database.Database): Person[] {
  return (db.prepare("SELECT * FROM people ORDER BY first_name, last_name").all() as Person[]).map(
    strip
  );
}

export function getActivePeople(db: Database.Database): Person[] {
  return (
    db
      .prepare("SELECT * FROM people WHERE active=1 ORDER BY first_name, last_name")
      .all() as Person[]
  ).map(strip);
}

export function getPersonById(db: Database.Database, id: number): Person | null {
  const row = (db.prepare("SELECT * FROM people WHERE id=?").get(id) as Person) ?? null;
  return row ? strip(row) : null;
}

export function isActivePerson(db: Database.Database, id: number): boolean {
  return !!db.prepare("SELECT 1 FROM people WHERE id = ? AND active = 1").get(id);
}

export function getPersonByUsername(db: Database.Database, username: string): Person | null {
  return (db.prepare("SELECT * FROM people WHERE username=?").get(username) as Person) ?? null;
}

/**
 * Looks up an active person by email (case-insensitive). Returns the raw row
 * (server-internal use only, e.g. the password-reset flow).
 */
export function getPersonByEmail(db: Database.Database, email: string): Person | null {
  return (
    (db
      .prepare(
        "SELECT * FROM people WHERE email IS NOT NULL AND lower(email)=lower(?) AND active=1"
      )
      .get(email) as Person) ?? null
  );
}

export type PersonWriteData = Omit<
  Person,
  | "id"
  | "updated_at"
  | "notify_new_reservations"
  | "notify_reservation_updates"
  | "notify_new_trips"
  | "notify_my_car_reservations"
  | "notify_my_car_trips"
> & {
  password_hash?: string | null;
  notify_new_reservations?: Person["notify_new_reservations"];
  notify_reservation_updates?: Person["notify_reservation_updates"];
  notify_new_trips?: Person["notify_new_trips"];
  notify_my_car_reservations?: Person["notify_my_car_reservations"];
  notify_my_car_trips?: Person["notify_my_car_trips"];
};

export function insertPerson(db: Database.Database, data: PersonWriteData): number {
  const result = db
    .prepare(
      `INSERT INTO people
         (first_name,last_name,discount,discount_long,active,username,is_admin,bank_account,
          email,theme_preference,notify_new_reservations,notify_reservation_updates,notify_new_trips,
          notify_my_car_reservations,notify_my_car_trips)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      data.first_name,
      data.last_name,
      data.discount,
      data.discount_long,
      data.active,
      data.username ?? null,
      data.is_admin ?? 0,
      data.bank_account ?? "",
      data.email ?? null,
      data.theme_preference ?? "mono",
      data.notify_new_reservations ?? "off",
      data.notify_reservation_updates ?? "mine",
      data.notify_new_trips ?? "off",
      data.notify_my_car_reservations ?? "off",
      data.notify_my_car_trips ?? "off"
    );
  return result.lastInsertRowid as number;
}

export function updatePerson(db: Database.Database, id: number, data: PersonWriteData): void {
  db.prepare(
    `UPDATE people
     SET first_name=?,last_name=?,discount=?,discount_long=?,active=?,username=?,is_admin=?,
         bank_account=?,email=?,theme_preference=?,
         notify_new_reservations=?,notify_reservation_updates=?,notify_new_trips=?,
         notify_my_car_reservations=?,notify_my_car_trips=?,
         updated_at=datetime('now')
     WHERE id=?`
  ).run(
    data.first_name,
    data.last_name,
    data.discount,
    data.discount_long,
    data.active,
    data.username ?? null,
    data.is_admin ?? 0,
    data.bank_account ?? "",
    data.email ?? null,
    data.theme_preference ?? "mono",
    data.notify_new_reservations ?? "off",
    data.notify_reservation_updates ?? "mine",
    data.notify_new_trips ?? "off",
    data.notify_my_car_reservations ?? "off",
    data.notify_my_car_trips ?? "off",
    id
  );
}

export function setPasswordHash(db: Database.Database, id: number, passwordHash: string): void {
  db.prepare("UPDATE people SET password_hash=? WHERE id=?").run(passwordHash, id);
}

/** Returns the person's current session epoch (0 if the person does not exist). */
export function getSessionEpoch(db: Database.Database, id: number): number {
  const row = db.prepare("SELECT session_epoch AS e FROM people WHERE id=?").get(id) as
    | { e: number }
    | undefined;
  return row?.e ?? 0;
}

/**
 * Increments the person's session epoch, invalidating every session cookie
 * previously issued to them. Used by "log out everywhere" and password reset.
 */
export function bumpSessionEpoch(db: Database.Database, id: number): void {
  db.prepare("UPDATE people SET session_epoch = session_epoch + 1 WHERE id=?").run(id);
}

export function isOwner(db: Database.Database, personId: number): boolean {
  const row = db
    .prepare("SELECT COUNT(*) as n FROM cars WHERE owner_person_id=?")
    .get(personId) as { n: number };
  return row.n > 0;
}

/**
 * Returns the email addresses of all active admin users.
 * Used to resolve notification recipients for admin-change emails.
 */
export function getAdminEmails(db: Database.Database): string[] {
  const rows = db
    .prepare(
      "SELECT email FROM people WHERE is_admin=1 AND active=1 AND email IS NOT NULL AND email != ''"
    )
    .all() as { email: string }[];
  return rows.map((r) => r.email);
}

// Auth token helpers (invite, password reset, magic-link — all share one table)
export type TokenPurpose = "invite" | "reset" | "magic";

/** Stores an auth token with a purpose and expiry. */
export function createAuthToken(
  db: Database.Database,
  personId: number,
  token: string,
  expiresAt: string,
  purpose: TokenPurpose = "invite"
): void {
  db.prepare(
    "INSERT OR REPLACE INTO invite_tokens (token,person_id,expires_at,purpose) VALUES (?,?,?,?)"
  ).run(token, personId, expiresAt, purpose);
}

/** Fetches a stored auth token along with its purpose. */
export function getAuthToken(
  db: Database.Database,
  token: string
): { person_id: number; expires_at: string; purpose: TokenPurpose } | null {
  return (
    (db
      .prepare("SELECT person_id,expires_at,purpose FROM invite_tokens WHERE token=?")
      .get(token) as
      | { person_id: number; expires_at: string; purpose: TokenPurpose }
      | undefined) ?? null
  );
}

export function deleteAuthToken(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM invite_tokens WHERE token=?").run(token);
}

// ── Back-compat invite-specific wrappers (used by the existing invite flow) ──
export function createInviteToken(
  db: Database.Database,
  personId: number,
  token: string,
  expiresAt: string
): void {
  createAuthToken(db, personId, token, expiresAt, "invite");
}

export function getInviteToken(
  db: Database.Database,
  token: string
): { person_id: number; expires_at: string } | null {
  const row = getAuthToken(db, token);
  if (!row || row.purpose !== "invite") return null;
  return { person_id: row.person_id, expires_at: row.expires_at };
}

export function deleteInviteToken(db: Database.Database, token: string): void {
  deleteAuthToken(db, token);
}
