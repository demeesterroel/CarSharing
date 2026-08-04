import { closeAllTenantDbs, getDb, getTenantDbPath } from "@/lib/db";
import {
  createTenantRecord,
  getPlatformDb,
  getTenantBySlug,
  getTenantSlugByCalendarChannel,
  registerCalendarChannel,
  resetPlatformDbInstanceForTesting,
  setTenantStatus,
} from "@/lib/platform-db";
import { extractTenantSlug } from "@/lib/tenant-context";
import fs from "fs";
import { NextRequest } from "next/server";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Multi-Tenant Architecture", () => {
  const testTenantSlugs = ["tenant-a", "tenant-b", "zonnedael"];

  function cleanupTestArtifacts() {
    closeAllTenantDbs();
    resetPlatformDbInstanceForTesting();

    // Clean up test tenant database files
    for (const slug of testTenantSlugs) {
      const dbPath = path.join(process.cwd(), "data", "tenants", `${slug}.db`);
      for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch {
            // ignore
          }
        }
      }
    }

    // Clean up test tenant records from platform.db if platform.db exists
    const platformDbPath = path.join(process.cwd(), "data", "platform.db");
    if (fs.existsSync(platformDbPath)) {
      try {
        const platformDb = getPlatformDb();
        platformDb
          .prepare("DELETE FROM tenants WHERE slug IN (?, ?, ?)")
          .run(...testTenantSlugs);
        platformDb
          .prepare("DELETE FROM calendar_channels WHERE tenant_slug IN (?, ?, ?)")
          .run(...testTenantSlugs);
      } catch {
        // ignore
      }
      resetPlatformDbInstanceForTesting();
    }
  }

  beforeEach(() => {
    cleanupTestArtifacts();
  });

  afterEach(() => {
    cleanupTestArtifacts();
  });

  describe("Platform Database & Tenant Registry", () => {
    it("initializes platform database with default primary tenant", () => {
      const platformDb = getPlatformDb();
      expect(platformDb).toBeDefined();

      const defaultTenant = getTenantBySlug("primary");
      expect(defaultTenant).not.toBeNull();
      expect(defaultTenant?.name).toBe("Primary Cooperative");
      expect(defaultTenant?.status).toBe("active");
    });

    it("provisions new tenant records and updates status", () => {
      const tenant = createTenantRecord(
        "zonnedael",
        "Zonnedael Autodeel",
        "admin@zonnedael.be"
      );
      expect(tenant.slug).toBe("zonnedael");
      expect(tenant.name).toBe("Zonnedael Autodeel");
      expect(tenant.admin_email).toBe("admin@zonnedael.be");
      expect(tenant.status).toBe("active");

      setTenantStatus("zonnedael", "suspended");
      const updated = getTenantBySlug("zonnedael");
      expect(updated?.status).toBe("suspended");
    });

    it("registers and looks up google calendar webhook channels per tenant", () => {
      registerCalendarChannel("channel-xyz-123", "zonnedael", "resource-abc-789");

      const slug = getTenantSlugByCalendarChannel("channel-xyz-123");
      expect(slug).toBe("zonnedael");

      const unknown = getTenantSlugByCalendarChannel("non-existent-channel");
      expect(unknown).toBeNull();
    });
  });

  describe("Tenant Database Connection Resolver", () => {
    it("resolves default tenant DB path correctly", () => {
      const defaultPath = getTenantDbPath();
      expect(defaultPath).toContain("primary.db");
    });

    it("creates isolated DB connections and applies migrations for distinct tenants", () => {
      const dbA = getDb("tenant-a");
      const dbB = getDb("tenant-b");

      expect(dbA).not.toBe(dbB);

      // Verify schema was initialized on tenant-a
      const tablesA = dbA
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      const tableNamesA = tablesA.map((t) => t.name);
      expect(tableNamesA).toContain("people");
      expect(tableNamesA).toContain("cars");
      expect(tableNamesA).toContain("trips");

      // Verify tenant data isolation
      dbA.prepare(
        "INSERT INTO people (first_name, last_name, discount) VALUES ('Alice', 'Smith', 0)"
      ).run();
      dbB.prepare(
        "INSERT INTO people (first_name, last_name, discount) VALUES ('Bob', 'Jones', 0)"
      ).run();

      const peopleA = dbA
        .prepare("SELECT first_name FROM people WHERE first_name IN ('Alice', 'Bob')")
        .all() as { first_name: string }[];
      const peopleB = dbB
        .prepare("SELECT first_name FROM people WHERE first_name IN ('Alice', 'Bob')")
        .all() as { first_name: string }[];

      expect(peopleA.map((p) => p.first_name)).toEqual(["Alice"]);
      expect(peopleB.map((p) => p.first_name)).toEqual(["Bob"]);
    });
  });

  describe("Tenant Context Extraction", () => {
    it("extracts tenant slug from x-tenant-slug header", () => {
      const req = new NextRequest("http://localhost:3000/", {
        headers: { "x-tenant-slug": "groenebuurt" },
      });
      expect(extractTenantSlug(req)).toBe("groenebuurt");
    });

    it("extracts tenant slug from subdomain", () => {
      const req = new NextRequest("http://groenebuurt.carsharing.app/trips", {
        headers: { host: "groenebuurt.carsharing.app" },
      });
      expect(extractTenantSlug(req)).toBe("groenebuurt");
    });

    it("falls back to default tenant for main domain or localhost", () => {
      const reqLocal = new NextRequest("http://localhost:3000/", {
        headers: { host: "localhost:3000" },
      });
      expect(extractTenantSlug(reqLocal)).toBe("primary");

      const reqApp = new NextRequest("http://app.carsharing.app/", {
        headers: { host: "app.carsharing.app" },
      });
      expect(extractTenantSlug(reqApp)).toBe("primary");
    });
  });
});
