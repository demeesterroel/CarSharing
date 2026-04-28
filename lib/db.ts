import Database from "better-sqlite3";
import { runMigrations } from "./db/migrate";
import { env } from "./env";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(env.DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    runMigrations(_db);
  }
  return _db;
}
