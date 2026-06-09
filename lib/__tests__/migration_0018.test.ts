import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";

describe("migration 0018 – theme_preference", () => {
  it("adds theme_preference column with default 'paper'", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(people)").all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const col = cols.find((c) => c.name === "theme_preference");
    expect(col).toBeTruthy();
    expect(col!.dflt_value).toBe("'paper'");
  });

  it("existing rows default to paper", () => {
    const db = new Database(":memory:");
    runMigrations(db);
    db.exec(
      "INSERT INTO people (first_name,last_name,discount,discount_long,active) VALUES ('Alice','B',0,0,1)"
    );
    const row = db.prepare("SELECT theme_preference FROM people LIMIT 1").get() as {
      theme_preference: string;
    };
    expect(row.theme_preference).toBe("paper");
  });
});
