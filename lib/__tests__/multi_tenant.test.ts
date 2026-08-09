import { closeAllTenantDbs, getDb, getTenantDbPath } from "@/lib/db";
import {
  createTenantRecord,
  formatTenantName,
  getPlatformDb,
  getTenantBySlug,
  getTenantSlugByCalendarChannel,
  registerCalendarChannel,
  resetPlatformDbInstanceForTesting,
  setTenantStatus,
} from "@/lib/platform-db";
import { extractTenantSlug } from "@/lib/tenant-context";
import { resetTenantsConfigCache } from "@/lib/tenants-config";
import fs from "fs";
import { NextRequest } from "next/server";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Multi-Tenant Architecture", () => {
  const testTenantSlugs = ["tenant-a", "tenant-b", "zonnedael", "custom-coop"];

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
          .prepare("DELETE FROM tenants WHERE slug IN (?, ?, ?, ?)")
          .run(...testTenantSlugs);
        platformDb
          .prepare("DELETE FROM calendar_channels WHERE tenant_slug IN (?, ?, ?, ?)")
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

    it("formats generic tenant names cleanly from slugs", () => {
      // These slugs are NOT in tenants.example.json so fall through to generic formatting
      expect(formatTenantName("groene-buurt")).toBe("Groene Buurt");
      expect(formatTenantName("my-car-share")).toBe("My Car Share");
      // coop-a IS in tenants.example.json, so name comes from config
      expect(formatTenantName("coop-a")).toBe("Cooperative A (Gent)");
    });

    it("dynamically auto-registers unknown tenant slugs with formatted generic names", () => {
      const tenant = getTenantBySlug("custom-coop");
      expect(tenant).toBeDefined();
      expect(tenant.slug).toBe("custom-coop");
      expect(tenant.name).toBe("Custom Coop");
      expect(tenant.status).toBe("active");
    });

    it("provisions new tenant records and updates status", () => {
      const tenant = createTenantRecord("zonnedael", "Zonnedael Autodeel", "admin@zonnedael.be");
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
      const tablesA = dbA.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string;
      }[];
      const tableNamesA = tablesA.map((t) => t.name);
      expect(tableNamesA).toContain("people");
      expect(tableNamesA).toContain("cars");
      expect(tableNamesA).toContain("trips");

      // Verify tenant data isolation
      dbA
        .prepare(
          "INSERT INTO people (first_name, last_name, discount) VALUES ('Alice', 'Smith', 0)"
        )
        .run();
      dbB
        .prepare("INSERT INTO people (first_name, last_name, discount) VALUES ('Bob', 'Jones', 0)")
        .run();

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

    it("extracts tenant slug from subdomain.domain.tld", () => {
      const req = new NextRequest("http://groenebuurt.carsharing.app/trips", {
        headers: { host: "groenebuurt.carsharing.app" },
      });
      expect(extractTenantSlug(req)).toBe("groenebuurt");
    });

    it("extracts tenant slug from *.localhost development subdomains", () => {
      const reqA = new NextRequest("http://coop-a.localhost:3000/login", {
        headers: { host: "coop-a.localhost:3000" },
      });
      expect(extractTenantSlug(reqA)).toBe("coop-a");

      // 4-part host resolved via tenants.json mapping to slug "antwerp"
      const reqB = new NextRequest("http://antwerp.coop.localhost:3000/login", {
        headers: { host: "antwerp.coop.localhost:3000" },
      });
      expect(extractTenantSlug(reqB)).toBe("antwerp");

      // wilrijk.coop.localhost is an alias — same slug "antwerp", same DB
      const reqC = new NextRequest("http://wilrijk.coop.localhost:3000/login", {
        headers: { host: "wilrijk.coop.localhost:3000" },
      });
      expect(extractTenantSlug(reqC)).toBe("antwerp");
    });

    it("falls back to default tenant for main domain or plain localhost", () => {
      const reqLocal = new NextRequest("http://localhost:3000/", {
        headers: { host: "localhost:3000" },
      });
      expect(extractTenantSlug(reqLocal)).toBe("primary");

      const reqApp = new NextRequest("http://app.carsharing.app/", {
        headers: { host: "app.carsharing.app" },
      });
      expect(extractTenantSlug(reqApp)).toBe("primary");

      const reqTenant = new NextRequest("http://subdomain.carsharing.app/", {
        headers: { host: "subdomain.carsharing.app" },
      });
      expect(extractTenantSlug(reqTenant)).toBe("subdomain");
    });
  });

  describe("Drupal-Style Site Mapping (tenants.json)", () => {
    const testJsonPath = path.join(process.cwd(), "tenants.test.json");

    beforeEach(() => {
      process.env.TENANTS_CONFIG_PATH = "tenants.test.json";
      resetTenantsConfigCache();
      fs.writeFileSync(
        testJsonPath,
        JSON.stringify({
          default: "main-coop",
          sites: {
            "demo.carsharing.app": { slug: "demo-site", name: "Demo Site" },
            "custom.cooperative.org": { slug: "custom-org", name: "Custom Org" },
            "*.mycoop.org": { name: "MyCoop Branch" },
          },
        })
      );
    });

    afterEach(() => {
      delete process.env.TENANTS_CONFIG_PATH;
      resetTenantsConfigCache();
      if (fs.existsSync(testJsonPath)) {
        try {
          fs.unlinkSync(testJsonPath);
        } catch {
          // ignore
        }
      }
    });

    it("matches exact domains from tenants.json", () => {
      const reqDemo = new NextRequest("http://demo.carsharing.app/login", {
        headers: { host: "demo.carsharing.app" },
      });
      expect(extractTenantSlug(reqDemo)).toBe("demo-site");

      const reqCustom = new NextRequest("http://custom.cooperative.org/trips", {
        headers: { host: "custom.cooperative.org:3000" },
      });
      expect(extractTenantSlug(reqCustom)).toBe("custom-org");
      expect(formatTenantName("custom-org")).toBe("Custom Org");
    });

    it("supports wildcard domain matching in tenants.json", () => {
      const reqBranch = new NextRequest("http://gent.mycoop.org/login", {
        headers: { host: "gent.mycoop.org" },
      });
      expect(extractTenantSlug(reqBranch)).toBe("gent");
      expect(formatTenantName("gent")).toBe("MyCoop Branch");
    });
  });
});
