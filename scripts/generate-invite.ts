import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "carsharing.db");
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://autodelen.bluette.be";
const DAYS = 7;

const nameArg = process.argv[2];
if (!nameArg) {
  console.error("Usage: npx tsx scripts/generate-invite.ts <person-name>");
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: false });

const person = db
  .prepare(
    "SELECT id, first_name, last_name FROM people WHERE active=1 AND (first_name LIKE ? COLLATE NOCASE OR last_name LIKE ? COLLATE NOCASE)"
  )
  .get(`%${nameArg}%`, `%${nameArg}%`) as
  | { id: number; first_name: string; last_name: string }
  | undefined;

if (!person) {
  console.error(`No active person found matching "${nameArg}"`);
  process.exit(1);
}

const fullName = person.last_name ? `${person.first_name} ${person.last_name}` : person.first_name;
const token = randomBytes(24).toString("hex");
const expiresAt = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toISOString();

db.prepare("INSERT INTO invite_tokens (token, person_id, expires_at) VALUES (?, ?, ?)").run(
  token,
  person.id,
  expiresAt
);

console.log(`Invite for ${fullName} (valid ${DAYS} days):`);
console.log(`${BASE_URL}/invite/${token}`);
