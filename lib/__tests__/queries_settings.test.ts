// lib/__tests__/queries_settings.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import { getSetting, setSetting } from "../queries/settings";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

describe("getSetting", () => {
  it("returns empty string when key does not exist", () => {
    const db = makeDb();
    expect(getSetting(db, "nonexistent_key")).toBe("");
  });

  it("returns the stored value for an existing key", () => {
    const db = makeDb();
    setSetting(db, "theme", "dark");
    expect(getSetting(db, "theme")).toBe("dark");
  });
});

describe("setSetting", () => {
  it("creates a new setting", () => {
    const db = makeDb();
    setSetting(db, "locale", "nl");
    expect(getSetting(db, "locale")).toBe("nl");
  });

  it("updates an existing setting (upsert)", () => {
    const db = makeDb();
    setSetting(db, "locale", "nl");
    setSetting(db, "locale", "en");
    expect(getSetting(db, "locale")).toBe("en");
  });

  it("stores multiple distinct keys", () => {
    const db = makeDb();
    setSetting(db, "key1", "val1");
    setSetting(db, "key2", "val2");
    expect(getSetting(db, "key1")).toBe("val1");
    expect(getSetting(db, "key2")).toBe("val2");
  });
});
