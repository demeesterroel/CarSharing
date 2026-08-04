// SQL injection audit (issue #30): all queries use ? placeholders — no interpolation found.

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { runMigrations } from "./db/migrate";
import { env } from "./env";

const _dbConnections = new Map<string, Database.Database>();

/** Resolves the database file path for a given tenant slug. */
export function getTenantDbPath(slug?: string): string {
  const defaultSlug = env.DEFAULT_TENANT_SLUG ?? "primary";
  const targetSlug = slug || defaultSlug;

  const tenantsDir = env.TENANTS_DIR ?? "data/tenants";
  const tenantPath = path.join(tenantsDir, `${targetSlug}.db`);

  // Legacy fallback: if target is default tenant and tenant DB file doesn't exist yet,
  // check if env.DB_PATH (data/carsharing.db) exists.
  if (targetSlug === defaultSlug && !fs.existsSync(tenantPath)) {
    if (fs.existsSync(env.DB_PATH)) {
      return env.DB_PATH;
    }
  }

  return tenantPath;
}

/**
 * Returns the SQLite database connection for the specified tenant slug (or default tenant).
 * Enables WAL mode, foreign keys, and runs pending migrations automatically.
 * @param tenantSlug - Optional tenant identifier slug. Defaults to env.DEFAULT_TENANT_SLUG ("primary").
 * @returns The tenant's `better-sqlite3` database instance.
 */
export function getDb(tenantSlug?: string): Database.Database {
  const defaultSlug = env.DEFAULT_TENANT_SLUG ?? "primary";
  const slug = tenantSlug || defaultSlug;

  let db = _dbConnections.get(slug);
  if (!db || !db.open) {
    const dbPath = getTenantDbPath(slug);
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    runMigrations(db);

    if (process.env.DEBUG_SQL === "1") {
      const originalPrepare = db.prepare.bind(db);
      (db as any).prepare = (sql: string) => {
        console.log(`[sql][tenant:${slug}]`, sql.trim().replace(/\s+/g, " "));
        return originalPrepare(sql);
      };
    }

    _dbConnections.set(slug, db);
  }

  return db;
}

/** Close all tenant database connections (useful for testing & shutdown). */
export function closeAllTenantDbs(): void {
  for (const [slug, db] of _dbConnections.entries()) {
    try {
      if (db.open) db.close();
    } catch {
      // ignore
    }
  }
  _dbConnections.clear();
}
