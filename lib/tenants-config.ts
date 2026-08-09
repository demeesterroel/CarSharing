import fs from "fs";
import path from "path";
import { env } from "./env";

export interface TenantConfig {
  slug: string;
  name?: string;
  adminEmail?: string;
  customDomain?: string;
}

export interface TenantsConfigFile {
  default?: string;
  sites?: Record<string, TenantConfig>;
}

let cachedConfig: TenantsConfigFile | null = null;
let lastMtime = 0;

/**
 * Loads the Drupal-style `tenants.json` configuration file.
 * Resolution order (same as seed scripts):
 *   1. TENANTS_CONFIG_PATH env var
 *   2. tenants.json  (production / local override)
 *   3. tenants.example.json  (dev fallback — committed example)
 * Caches the config in-memory and reloads automatically if the file mtime changes.
 */
export function getTenantsConfig(): TenantsConfigFile {
  try {
    const candidates = [
      process.env.TENANTS_CONFIG_PATH || env.TENANTS_CONFIG_PATH,
      "tenants.json",
      "tenants.example.json",
    ].filter(Boolean) as string[];

    let configPath: string | null = null;
    for (const candidate of candidates) {
      const resolved = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate);
      if (fs.existsSync(resolved)) {
        configPath = resolved;
        break;
      }
    }

    if (!configPath) {
      return { default: env.DEFAULT_TENANT_SLUG, sites: {} };
    }

    const stat = fs.statSync(configPath);
    if (cachedConfig && stat.mtimeMs === lastMtime) {
      return cachedConfig;
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as TenantsConfigFile;

    cachedConfig = {
      default: parsed.default || env.DEFAULT_TENANT_SLUG,
      sites: parsed.sites || {},
    };
    lastMtime = stat.mtimeMs;
    return cachedConfig;
  } catch (e) {
    console.warn("[tenants-config] Could not parse tenants config:", (e as Error).message);
    return { default: env.DEFAULT_TENANT_SLUG, sites: {} };
  }
}

/** Resets the in-memory config cache (useful for testing) */
export function resetTenantsConfigCache(): void {
  cachedConfig = null;
  lastMtime = 0;
}

/**
 * Looks up a tenant configuration matching an incoming HTTP host (Drupal sites.php style).
 * Matching precedence:
 * 1. Exact host match (e.g. "wim.autodelen.bluette.be")
 * 2. Host without port (e.g. "wim.autodelen.bluette.be:3000" -> "wim.autodelen.bluette.be")
 * 3. Wildcard domain match (e.g. "*.autodelen.bluette.be")
 */
export function getTenantConfigForHost(host: string): TenantConfig | null {
  if (!host) return null;
  const cleanHost = host.split(":")[0].toLowerCase();
  const config = getTenantsConfig();
  const sites = config.sites || {};

  // 1. Direct host match
  if (sites[cleanHost]) {
    return sites[cleanHost];
  }

  // 2. Wildcard domain match (e.g. *.autodelen.bluette.be -> match wim.autodelen.bluette.be)
  const hostParts = cleanHost.split(".");
  if (hostParts.length > 2) {
    const parentDomain = "*." + hostParts.slice(1).join(".");
    if (sites[parentDomain]) {
      const parent = sites[parentDomain];
      // Inherit parent config with dynamic subdomain slug
      return {
        slug: hostParts[0],
        name: parent.name,
        adminEmail: parent.adminEmail,
      };
    }
  }

  return null;
}

/** Looks up tenant metadata by slug from tenants.json */
export function getTenantConfigBySlug(slug: string): TenantConfig | null {
  if (!slug) return null;
  const config = getTenantsConfig();
  const sites = config.sites || {};

  for (const [key, item] of Object.entries(sites)) {
    if (item.slug && item.slug.toLowerCase() === slug.toLowerCase()) {
      return item;
    }
  }

  for (const [key, item] of Object.entries(sites)) {
    if (key.startsWith("*.") && item.name) {
      return { slug, name: item.name, adminEmail: item.adminEmail };
    }
  }

  return null;
}
