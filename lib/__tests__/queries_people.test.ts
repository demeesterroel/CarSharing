// lib/__tests__/queries_people.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import {
  createInviteToken,
  deleteInviteToken,
  getActivePeople,
  getInviteToken,
  getPeople,
  getPersonById,
  getPersonByUsername,
  insertPerson,
  isOwner,
  setPasswordHash,
  updatePerson,
} from "../queries/people";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = {
  first_name: "",
  last_name: "",
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
  bank_account: "",
  email: null,
  theme_preference: "paper" as const,
};

describe("getPeople", () => {
  it("returns empty array when no people exist", () => {
    const db = makeDb();
    expect(getPeople(db)).toEqual([]);
  });

  it("returns all people ordered by name", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, first_name: "Zara" });
    insertPerson(db, { ...basePerson, first_name: "Alice" });
    insertPerson(db, { ...basePerson, first_name: "Bob" });
    const people = getPeople(db);
    expect(people.map((p) => p.first_name)).toEqual(["Alice", "Bob", "Zara"]);
  });

  it("strips password_hash from results", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("hashed!", id);
    const people = getPeople(db);
    expect((people[0] as any).password_hash).toBeUndefined();
  });
});

describe("getActivePeople", () => {
  it("returns only active people", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, first_name: "Active", active: 1 });
    insertPerson(db, { ...basePerson, first_name: "Inactive", active: 0 });
    const people = getActivePeople(db);
    expect(people).toHaveLength(1);
    expect(people[0].first_name).toBe("Active");
  });

  it("returns empty array when no active people", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, first_name: "Inactive", active: 0 });
    expect(getActivePeople(db)).toHaveLength(0);
  });
});

describe("getPersonById", () => {
  it("returns the correct person by id", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const person = getPersonById(db, id);
    expect(person?.first_name).toBe("Alice");
    expect(person?.id).toBe(id);
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    expect(getPersonById(db, 9999)).toBeNull();
  });

  it("strips password_hash", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("secret", id);
    const person = getPersonById(db, id);
    expect((person as any)?.password_hash).toBeUndefined();
  });
});

describe("getPersonByUsername", () => {
  it("returns person matching username", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, first_name: "Alice", username: "alice_user" });
    const person = getPersonByUsername(db, "alice_user");
    expect(person?.first_name).toBe("Alice");
  });

  it("returns null for unknown username", () => {
    const db = makeDb();
    expect(getPersonByUsername(db, "nobody")).toBeNull();
  });

  it("returns password_hash (used for auth)", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice", username: "alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("hashed_pw", id);
    const person = getPersonByUsername(db, "alice");
    expect((person as any)?.password_hash).toBe("hashed_pw");
  });
});

describe("insertPerson", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("stores is_admin flag correctly", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Admin", is_admin: 1 });
    const row = db.prepare("SELECT is_admin FROM people WHERE id=?").get(id) as any;
    expect(row.is_admin).toBe(1);
  });

  it("stores discount values", () => {
    const db = makeDb();
    const id = insertPerson(db, {
      ...basePerson,
      first_name: "Discounted",
      discount: 10,
      discount_long: 20,
    });
    const row = db.prepare("SELECT discount, discount_long FROM people WHERE id=?").get(id) as any;
    expect(row.discount).toBe(10);
    expect(row.discount_long).toBe(20);
  });
});

describe("theme_preference default", () => {
  it("new person without explicit theme gets mono", () => {
    const db = makeDb();
    const id = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      theme_preference: undefined as unknown as "mono",
    });
    const row = db.prepare("SELECT theme_preference FROM people WHERE id=?").get(id) as any;
    expect(row.theme_preference).toBe("mono");
  });

  it("migration 0019 converts existing paper rows to mono", () => {
    // Run only migrations up to 0018 so we can insert a 'paper' row before 0019 runs
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    const { readdirSync, readFileSync } = require("fs");
    const path = require("path");
    const migrationsDir = path.join(process.cwd(), "migrations");
    db.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`
    );
    const files = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql") && f <= "0018_people_theme_preference.sql")
      .sort();
    for (const f of files) {
      db.pragma("foreign_keys = OFF");
      db.exec(readFileSync(path.join(migrationsDir, f), "utf-8"));
      db.pragma("foreign_keys = ON");
      db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(f);
    }
    // Insert legacy 'paper' row before migration 0019
    db.prepare(
      "INSERT INTO people (first_name, last_name, discount, discount_long, active, bank_account, theme_preference) VALUES ('Legacy','User',0,0,1,'','paper')"
    ).run();
    // Apply remaining migrations (0019)
    runMigrations(db);
    const row = db
      .prepare("SELECT theme_preference FROM people WHERE first_name='Legacy'")
      .get() as any;
    expect(row.theme_preference).toBe("mono");
  });
});

describe("updatePerson", () => {
  it("updates person fields", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Old", last_name: "Name" });
    updatePerson(db, id, { ...basePerson, first_name: "New", last_name: "Name", active: 0 });
    const person = getPersonById(db, id);
    expect(person?.first_name).toBe("New");
    expect(person?.last_name).toBe("Name");
    expect(person?.active).toBe(0);
  });

  it("updates username", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    updatePerson(db, id, { ...basePerson, first_name: "Alice", username: "alice_updated" });
    const person = getPersonByUsername(db, "alice_updated");
    expect(person?.id).toBe(id);
  });

  it("does nothing for non-existent id", () => {
    const db = makeDb();
    // should not throw
    updatePerson(db, 9999, { ...basePerson, first_name: "Ghost" });
    expect(getPeople(db)).toHaveLength(0);
  });
});

describe("setPasswordHash", () => {
  it("sets the password_hash on the person row", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    setPasswordHash(db, id, "bcrypt_hash_here");
    const row = db.prepare("SELECT password_hash FROM people WHERE id=?").get(id) as any;
    expect(row.password_hash).toBe("bcrypt_hash_here");
  });
});

describe("isOwner", () => {
  it("returns false when person owns no cars", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    expect(isOwner(db, aliceId)).toBe(false);
  });

  it("returns true when person owns an active car", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    db.exec(
      `INSERT INTO cars (short,name,price_per_km,owner_person_id,owner_from,active) VALUES ('CA','Car A',0.2,${aliceId},'2020-01-01',1)`
    );
    expect(isOwner(db, aliceId)).toBe(true);
  });

  it("returns true when person only owns inactive cars (owner retains API access after deactivation)", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    db.exec(
      `INSERT INTO cars (short,name,price_per_km,owner_person_id,owner_from,active) VALUES ('CA','Car A',0.2,${aliceId},'2020-01-01',0)`
    );
    expect(isOwner(db, aliceId)).toBe(true);
  });
});

describe("theme_preference", () => {
  it("defaults to 'paper' on insert", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const p = getPersonById(db, id)!;
    expect(p.theme_preference).toBe("paper");
  });

  it("updatePerson persists theme_preference", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const p = getPersonById(db, id)!;
    updatePerson(db, id, { ...p, theme_preference: "mono" });
    expect(getPersonById(db, id)!.theme_preference).toBe("mono");
  });
});

describe("invite tokens", () => {
  it("creates and retrieves an invite token", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    createInviteToken(db, id, "tok123", "2030-01-01T00:00:00");
    const row = getInviteToken(db, "tok123");
    expect(row?.person_id).toBe(id);
    expect(row?.expires_at).toBe("2030-01-01T00:00:00");
  });

  it("returns null for unknown token", () => {
    const db = makeDb();
    expect(getInviteToken(db, "unknown")).toBeNull();
  });

  it("deletes an invite token", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    createInviteToken(db, id, "tok456", "2030-01-01T00:00:00");
    deleteInviteToken(db, "tok456");
    expect(getInviteToken(db, "tok456")).toBeNull();
  });

  it("upserts on duplicate token (INSERT OR REPLACE)", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, first_name: "Alice" });
    createInviteToken(db, id, "duptoken", "2030-01-01T00:00:00");
    createInviteToken(db, id, "duptoken", "2031-06-01T00:00:00");
    const row = getInviteToken(db, "duptoken");
    expect(row?.expires_at).toBe("2031-06-01T00:00:00");
  });
});
