import type Database from "better-sqlite3";
import type { Person } from "@/types";
export { shortNameOf, fullNameOf } from "@/lib/person-utils";

// Strip password_hash from public-facing person objects
function strip(p: Person): Person {
  const { password_hash: _ph, ...rest } = p as Person & { password_hash: string | null };
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

export function getPersonByUsername(db: Database.Database, username: string): Person | null {
  return (db.prepare("SELECT * FROM people WHERE username=?").get(username) as Person) ?? null;
}

export function insertPerson(
  db: Database.Database,
  data: Omit<Person, "id" | "updated_at"> & { password_hash?: string | null }
): number {
  const result = db
    .prepare(
      "INSERT INTO people (first_name,last_name,discount,discount_long,active,username,is_admin,bank_account,email,theme_preference) VALUES (?,?,?,?,?,?,?,?,?,?)"
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
      data.theme_preference ?? "mono"
    );
  return result.lastInsertRowid as number;
}

export function updatePerson(
  db: Database.Database,
  id: number,
  data: Omit<Person, "id" | "updated_at"> & { password_hash?: string | null }
): void {
  db.prepare(
    "UPDATE people SET first_name=?,last_name=?,discount=?,discount_long=?,active=?,username=?,is_admin=?,bank_account=?,email=?,theme_preference=?,updated_at=datetime('now') WHERE id=?"
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
    id
  );
}

export function setPasswordHash(db: Database.Database, id: number, passwordHash: string): void {
  db.prepare("UPDATE people SET password_hash=? WHERE id=?").run(passwordHash, id);
}

export function isOwner(db: Database.Database, personId: number): boolean {
  const row = db
    .prepare("SELECT COUNT(*) as n FROM cars WHERE owner_person_id=?")
    .get(personId) as { n: number };
  return row.n > 0;
}

// Invite token helpers
export function createInviteToken(
  db: Database.Database,
  personId: number,
  token: string,
  expiresAt: string
): void {
  db.prepare(
    "INSERT OR REPLACE INTO invite_tokens (token,person_id,expires_at) VALUES (?,?,?)"
  ).run(token, personId, expiresAt);
}

export function getInviteToken(
  db: Database.Database,
  token: string
): { person_id: number; expires_at: string } | null {
  return (
    (db.prepare("SELECT person_id,expires_at FROM invite_tokens WHERE token=?").get(token) as
      | { person_id: number; expires_at: string }
      | undefined) ?? null
  );
}

export function deleteInviteToken(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM invite_tokens WHERE token=?").run(token);
}
