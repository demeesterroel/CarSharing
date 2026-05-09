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
