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

  const tenantName = tenant?.name ?? `Cooperative ${tenantSlug}`;

  return (
    <LoginForm
      mailEnabled={isMailEnabled()}
      tenantName={tenantName}
      tenantSlug={tenantSlug}
    />
  );
}
