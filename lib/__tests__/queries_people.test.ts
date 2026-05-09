// lib/__tests__/queries_people.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import {
  getPeople,
  getActivePeople,
  getPersonById,
  getPersonByUsername,
  insertPerson,
  updatePerson,
  setPasswordHash,
  isOwner,
  createInviteToken,
  getInviteToken,
  deleteInviteToken,
} from "../queries/people";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = {
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
  bank_account: "",
};

describe("getPeople", () => {
  it("returns empty array when no people exist", () => {
    const db = makeDb();
    expect(getPeople(db)).toEqual([]);
  });

  it("returns all people ordered by name", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Zara" });
    insertPerson(db, { ...basePerson, name: "Alice" });
    insertPerson(db, { ...basePerson, name: "Bob" });
    const people = getPeople(db);
    expect(people.map((p) => p.name)).toEqual(["Alice", "Bob", "Zara"]);
  });

  it("strips password_hash from results", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("hashed!", id);
    const people = getPeople(db);
    expect((people[0] as any).password_hash).toBeUndefined();
  });
});

describe("getActivePeople", () => {
  it("returns only active people", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Active", active: 1 });
    insertPerson(db, { ...basePerson, name: "Inactive", active: 0 });
    const people = getActivePeople(db);
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe("Active");
  });

  it("returns empty array when no active people", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Inactive", active: 0 });
    expect(getActivePeople(db)).toHaveLength(0);
  });
});

describe("getPersonById", () => {
  it("returns the correct person by id", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    const person = getPersonById(db, id);
    expect(person?.name).toBe("Alice");
    expect(person?.id).toBe(id);
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    expect(getPersonById(db, 9999)).toBeNull();
  });

  it("strips password_hash", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("secret", id);
    const person = getPersonById(db, id);
    expect((person as any)?.password_hash).toBeUndefined();
  });
});

describe("getPersonByUsername", () => {
  it("returns person matching username", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Alice", username: "alice_user" });
    const person = getPersonByUsername(db, "alice_user");
    expect(person?.name).toBe("Alice");
  });

  it("returns null for unknown username", () => {
    const db = makeDb();
    expect(getPersonByUsername(db, "nobody")).toBeNull();
  });

  it("returns password_hash (used for auth)", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice", username: "alice" });
    db.prepare("UPDATE people SET password_hash=? WHERE id=?").run("hashed_pw", id);
    const person = getPersonByUsername(db, "alice");
    expect((person as any)?.password_hash).toBe("hashed_pw");
  });
});

describe("insertPerson", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("stores is_admin flag correctly", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Admin", is_admin: 1 });
    const row = db.prepare("SELECT is_admin FROM people WHERE id=?").get(id) as any;
    expect(row.is_admin).toBe(1);
  });

  it("stores discount values", () => {
    const db = makeDb();
    const id = insertPerson(db, {
      ...basePerson,
      name: "Discounted",
      discount: 10,
      discount_long: 20,
    });
    const row = db.prepare("SELECT discount, discount_long FROM people WHERE id=?").get(id) as any;
    expect(row.discount).toBe(10);
    expect(row.discount_long).toBe(20);
  });
});

describe("updatePerson", () => {
  it("updates person fields", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Old Name" });
    updatePerson(db, id, { ...basePerson, name: "New Name", active: 0 });
    const person = getPersonById(db, id);
    expect(person?.name).toBe("New Name");
    expect(person?.active).toBe(0);
  });

  it("updates username", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    updatePerson(db, id, { ...basePerson, name: "Alice", username: "alice_updated" });
    const person = getPersonByUsername(db, "alice_updated");
    expect(person?.id).toBe(id);
  });

  it("does nothing for non-existent id", () => {
    const db = makeDb();
    // should not throw
    updatePerson(db, 9999, { ...basePerson, name: "Ghost" });
    expect(getPeople(db)).toHaveLength(0);
  });
});

describe("setPasswordHash", () => {
  it("sets the password_hash on the person row", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    setPasswordHash(db, id, "bcrypt_hash_here");
    const row = db.prepare("SELECT password_hash FROM people WHERE id=?").get(id) as any;
    expect(row.password_hash).toBe("bcrypt_hash_here");
  });
});

describe("isOwner", () => {
  it("returns false when person owns no active cars", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Alice" });
    expect(isOwner(db, "Alice")).toBe(false);
  });

  it("returns true when person owns an active car", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Alice" });
    db.exec(
      `INSERT INTO cars (short,name,price_per_km,owner_name,owner_from,active) VALUES ('CA','Car A',0.2,'Alice','2020-01-01',1)`
    );
    expect(isOwner(db, "Alice")).toBe(true);
  });

  it("returns true when person only owns inactive cars (owner retains API access after deactivation)", () => {
    const db = makeDb();
    insertPerson(db, { ...basePerson, name: "Alice" });
    db.exec(
      `INSERT INTO cars (short,name,price_per_km,owner_name,owner_from,active) VALUES ('CA','Car A',0.2,'Alice','2020-01-01',0)`
    );
    expect(isOwner(db, "Alice")).toBe(true);
  });
});

describe("invite tokens", () => {
  it("creates and retrieves an invite token", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
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
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    createInviteToken(db, id, "tok456", "2030-01-01T00:00:00");
    deleteInviteToken(db, "tok456");
    expect(getInviteToken(db, "tok456")).toBeNull();
  });

  it("upserts on duplicate token (INSERT OR REPLACE)", () => {
    const db = makeDb();
    const id = insertPerson(db, { ...basePerson, name: "Alice" });
    createInviteToken(db, id, "duptoken", "2030-01-01T00:00:00");
    createInviteToken(db, id, "duptoken", "2031-06-01T00:00:00");
    const row = getInviteToken(db, "duptoken");
    expect(row?.expires_at).toBe("2031-06-01T00:00:00");
  });
});
