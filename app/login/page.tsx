import { isMailEnabled } from "@/lib/mailer";
import { getTenantBySlug } from "@/lib/platform-db";
import { headers } from "next/headers";
import LoginForm from "./login-form";

// Read mail config and tenant context at request time
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const reqHeaders = await headers();
  const tenantSlug = reqHeaders.get("x-tenant-slug") ?? "primary";
  const tenant = getTenantBySlug(tenantSlug);

  // x-tenant-name is set by the proxy from per-host tenants.json config,
  // allowing URL aliases (e.g. wilrijk.coop.localhost) to show their own name
  // even when they share a slug/DB with another host.
  const tenantName = reqHeaders.get("x-tenant-name") ?? tenant?.name ?? `Cooperative ${tenantSlug}`;

  return (
    <LoginForm mailEnabled={isMailEnabled()} tenantName={tenantName} tenantSlug={tenantSlug} />
  );
}
