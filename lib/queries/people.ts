import type Database from "better-sqlite3";
import type { Person } from "@/types";

export function getPeople(db: Database.Database): Person[] {
  return db.prepare("SELECT * FROM people ORDER BY name").all() as Person[];
}

export function getActivePeople(db: Database.Database): Person[] {
  return db.prepare("SELECT * FROM people WHERE active=1 ORDER BY name").all() as Person[];
}

export function getPersonById(db: Database.Database, id: number): Person | null {
  return (db.prepare("SELECT * FROM people WHERE id=?").get(id) as Person) ?? null;
}

export function insertPerson(db: Database.Database, data: Omit<Person, "id">): number {
  const result = db
    .prepare("INSERT INTO people (name,discount,discount_long,active) VALUES (?,?,?,?)")
    .run(data.name, data.discount, data.discount_long, data.active);
  return result.lastInsertRowid as number;
}

export function updatePerson(db: Database.Database, id: number, data: Omit<Person, "id">): void {
  db.prepare("UPDATE people SET name=?,discount=?,discount_long=?,active=? WHERE id=?")
    .run(data.name, data.discount, data.discount_long, data.active, id);
}
