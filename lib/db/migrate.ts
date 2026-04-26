import type Database from "better-sqlite3";
import { readdirSync, readFileSync } from "fs";
import path from "path";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.prepare("SELECT filename FROM _migrations").pluck().all() as string[]
  );

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(path.join(migrationsDir, filename), "utf-8");
    // Disable FK enforcement during migration so data migrations (INSERT/UPDATE
    // referencing real IDs) don't fail against an empty test DB or partial state.
    const fkWasOn = (db.pragma("foreign_keys", { simple: true }) as number) === 1;
    if (fkWasOn) db.pragma("foreign_keys = OFF");
    try {
      db.exec(sql);
    } finally {
      if (fkWasOn) db.pragma("foreign_keys = ON");
    }
    db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(filename);
    console.log(`[db] migration applied: ${filename}`);
  }
}
