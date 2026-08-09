process.env.SESSION_PASSWORD =
  process.env.SESSION_PASSWORD || "dev-session-password-placeholder-32-chars";

import fs from "fs";
import path from "path";
import { createTenantRecord } from "../lib/platform-db.js";

console.log("Seeding platform database from tenants.json...");

// Resolve tenants config file: TENANTS_CONFIG_PATH env > tenants.json > tenants.example.json
function resolveTenantsConfigPath(): string {
  const candidates = [
    process.env.TENANTS_CONFIG_PATH,
    path.join(process.cwd(), "tenants.json"),
    path.join(process.cwd(), "tenants.example.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (fs.existsSync(resolved)) return resolved;
  }
  throw new Error("No tenants config file found (tenants.json or tenants.example.json)");
}

const configPath = resolveTenantsConfigPath();
console.log(`  Using config: ${path.relative(process.cwd(), configPath)}`);

const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  default?: string;
  sites?: Record<string, { slug?: string; name?: string; adminEmail?: string }>;
};

const sites = config.sites || {};
const seeded: string[] = [];

for (const [host, site] of Object.entries(sites)) {
  // Skip wildcard entries (*.domain.tld) — no fixed slug to register
  if (host.startsWith("*.")) continue;

  const slug = site.slug || host.split(".")[0];
  const name = site.name || slug;
  const email = site.adminEmail;

  createTenantRecord(slug, name, email);
  seeded.push(slug);
  console.log(`  ✓ Tenant registered: ${slug} (${name})`);
}

console.log(
  `\n✅ Platform database seeded with ${seeded.length} tenant(s) from ${path.basename(configPath)}.`
);
