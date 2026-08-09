process.env.SESSION_PASSWORD =
  process.env.SESSION_PASSWORD || "dev-session-password-placeholder-32-chars";

import { createTenantRecord, getPlatformDb } from "../lib/platform-db.js";

console.log("Seeding platform database with demo cooperatives...");
const db = getPlatformDb();

const demoTenants = [
  { slug: "coop-a", name: "Cooperative A (Gent)", email: "admin@coop-a.local" },
  { slug: "coop-b", name: "Cooperative B (Antwerpen)", email: "admin@coop-b.local" },
];

for (const t of demoTenants) {
  createTenantRecord(t.slug, t.name, t.email);
}

console.log(`✅ Platform database seeded with ${demoTenants.length} demo cooperatives.`);
