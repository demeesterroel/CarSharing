import { AsyncLocalStorage } from "async_hooks";
import { NextRequest } from "next/server";
import { env } from "./env";
import { getTenantConfigForHost, getTenantsConfig } from "./tenants-config";

/** AsyncLocalStorage store to track current tenant slug across async call stacks */
const tenantStorage = new AsyncLocalStorage<string>();

/** Runs a function within the context of a specified tenant slug. */
export function runWithTenant<T>(tenantSlug: string, fn: () => T): T {
  return tenantStorage.run(tenantSlug, fn);
}

/** Gets the current tenant slug from the active AsyncLocalStorage store context, if any. */
export function getCurrentTenantSlug(): string | undefined {
  return tenantStorage.getStore();
}

/**
 * Extracts the tenant slug from an incoming HTTP request.
 * Strategy (Drupal multisite style):
 * 1. Read `x-tenant-slug` header if present (e.g. injected by reverse proxy).
 * 2. Match host in `tenants.json` site-mapping config (e.g. "wim.autodelen.bluette.be" -> "wim").
 * 3. Parse subdomain from `Host` header (e.g. `coop-a.localhost` or `coop-a.carsharing.app` -> `coop-a`).
 * 4. Fallback to `default` tenant slug in `tenants.json` or `env.DEFAULT_TENANT_SLUG` ("primary").
 */
export function extractTenantSlug(req: NextRequest | Request): string {
  const config = getTenantsConfig();
  const defaultSlug = config.default || env.DEFAULT_TENANT_SLUG || "primary";

  // 1. Explicit header
  const customHeader = req.headers.get("x-tenant-slug");
  if (customHeader) return customHeader.trim().toLowerCase();

  // 2. Drupal-style site-mapping match from tenants.json
  const host = req.headers.get("host") || "";
  const siteConfig = getTenantConfigForHost(host);
  if (siteConfig && siteConfig.slug) {
    return siteConfig.slug.trim().toLowerCase();
  }

  // 3. Dynamic subdomain check from host header
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname || hostname === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return defaultSlug;
  }

  const parts = hostname.split(".");

  // Handle subdomain.localhost (e.g., coop-a.localhost -> parts: ['coop-a', 'localhost'])
  if (parts.length === 2 && parts[1] === "localhost") {
    const subdomain = parts[0];
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return subdomain;
    }
  }

  // Handle subdomain.domain.tld (e.g. coop-a.carsharing.app -> 3+ parts)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return subdomain;
    }
  }

  return defaultSlug;
}
