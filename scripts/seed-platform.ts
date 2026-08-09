import { getPlatformDb, seedPlatformDb } from "../lib/platform-db";

console.log("Seeding platform database...");
const db = getPlatformDb();
seedPlatformDb(db);
console.log("✅ Platform database seeded successfully.");
