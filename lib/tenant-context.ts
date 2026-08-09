import { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Extracts the tenant slug from an incoming HTTP request.
 * Strategy:
 * 1. Read `x-tenant-slug` header if present (e.g. injected by reverse proxy).
 * 2. Parse subdomain from `Host` header (e.g. `coop-a.localhost` or `coop-a.carsharing.app` -> `coop-a`).
 * 3. Fallback to `env.DEFAULT_TENANT_SLUG` ("primary").
 */
export function extractTenantSlug(req: NextRequest | Request): string {
  const defaultSlug = env.DEFAULT_TENANT_SLUG ?? "primary";

  // 1. Explicit header
  const customHeader = req.headers.get("x-tenant-slug");
  if (customHeader) return customHeader.trim().toLowerCase();

  // 2. Subdomain check from host header
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  // Exclude empty host, plain "localhost", or IP addresses
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
