// SQL injection audit (issue #30): all queries use ? placeholders — no interpolation found.

import Database from "better-sqlite3";
import { runMigrations } from "./db/migrate";
import { env } from "./env";

let _db: Database.Database | null = null;

/**
 * Returns the singleton SQLite database connection, initialising it on first call.
 * Enables WAL mode, foreign keys, and runs pending migrations automatically.
 * @returns The shared `better-sqlite3` database instance.
 */
export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(env.DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    runMigrations(_db);

    if (process.env.DEBUG_SQL === "1") {
      const originalPrepare = _db.prepare.bind(_db);
      (_db as any).prepare = (sql: string) => {
        console.log("[sql]", sql.trim().replace(/\s+/g, " "));
        return originalPrepare(sql);
      };
    }
  }
  return _db;
}
