import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "./env";

export interface TenantRecord {
  id: number;
  slug: string;
  name: string;
  status: "active" | "suspended" | "pending_setup";
  admin_email: string | null;
  custom_domain: string | null;
  created_at: string;
  updated_at: string;
}

let _platformDb: Database.Database | null = null;

export function getPlatformDbPath(): string {
  const dataDir = path.dirname(env.DB_PATH);
  return path.join(dataDir, "platform.db");
}

export function getPlatformDb(): Database.Database {
  if (!_platformDb) {
    const dbPath = getPlatformDbPath();
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    _platformDb = new Database(dbPath);
    _platformDb.pragma("journal_mode = WAL");
    _platformDb.pragma("foreign_keys = ON");

    initPlatformSchema(_platformDb);
  }
  return _platformDb;
}

/** Initializes the DDL schema for the platform database and ensures default primary tenant exists. */
function initPlatformSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'active',
      admin_email   TEXT,
      custom_domain TEXT    UNIQUE,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_channels (
      channel_id  TEXT PRIMARY KEY,
      tenant_slug TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure default primary tenant exists in platform.db
  const defaultSlug = env.DEFAULT_TENANT_SLUG ?? "primary";
  const existingDefault = db
    .prepare("SELECT 1 FROM tenants WHERE slug = ?")
    .get(defaultSlug);

  if (!existingDefault) {
    db.prepare(
      "INSERT INTO tenants (slug, name, status) VALUES (?, 'Primary Cooperative', 'active')"
    ).run(defaultSlug);
  }
}

/** Formats a generic human-friendly tenant name from a slug (e.g. "coop-a" -> "Cooperative A", "groene-buurt" -> "Groene Buurt") */
export function formatTenantName(slug: string): string {
  if (!slug || slug === "primary") return "Primary Cooperative";
  const clean = slug
    .replace(/^coop[-_]?/i, "Cooperative ")
    .replace(/[-_]/g, " ");
  return clean
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function getTenantBySlug(slug: string): TenantRecord {
  const db = getPlatformDb();
  const tenant = db
    .prepare("SELECT * FROM tenants WHERE slug = ?")
    .get(slug) as TenantRecord | undefined;

  if (!tenant) {
    // If querying an unseeded slug, return a synthetic TenantRecord (pure read, no side-effect write)
    return {
      id: 0,
      slug,
      name: formatTenantName(slug),
      status: "active",
      admin_email: null,
      custom_domain: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return tenant;
}

export function getTenantByDomain(domain: string): TenantRecord | null {
  const db = getPlatformDb();
  return (
    (db.prepare("SELECT * FROM tenants WHERE custom_domain = ?").get(domain) as
      | TenantRecord
      | undefined) ?? null
  );
}

export function getAllTenants(): TenantRecord[] {
  const db = getPlatformDb();
  return db
    .prepare("SELECT * FROM tenants ORDER BY name ASC")
    .all() as TenantRecord[];
}

export function createTenantRecord(
  slug: string,
  name: string,
  adminEmail?: string,
  status: "active" | "suspended" | "pending_setup" = "active"
): TenantRecord {
  const db = getPlatformDb();
  db.prepare(
    `INSERT OR REPLACE INTO tenants (slug, name, admin_email, status, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(slug, name, adminEmail ?? null, status);

  return getTenantBySlug(slug);
}

export function setTenantStatus(
  slug: string,
  status: "active" | "suspended"
): void {
  const db = getPlatformDb();
  db.prepare(
    "UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE slug = ?"
  ).run(status, slug);
}

export function registerCalendarChannel(
  channelId: string,
  tenantSlug: string,
  resourceId: string
): void {
  const db = getPlatformDb();
  db.prepare(
    `INSERT OR REPLACE INTO calendar_channels (channel_id, tenant_slug, resource_id, updated_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(channelId, tenantSlug, resourceId);
}

export function getTenantSlugByCalendarChannel(
  channelId: string
): string | null {
  const db = getPlatformDb();
  const row = db
    .prepare("SELECT tenant_slug FROM calendar_channels WHERE channel_id = ?")
    .get(channelId) as { tenant_slug: string } | undefined;
  return row?.tenant_slug ?? null;
}

/** Reset platform db instance (for unit tests) */
export function resetPlatformDbInstanceForTesting(): void {
  if (_platformDb) {
    try {
      _platformDb.close();
    } catch {
      // ignore
    }
    _platformDb = null;
  }
}
