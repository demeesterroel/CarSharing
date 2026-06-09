/**
 * Playwright globalSetup — runs once before all tests in a run.
 *
 * Seeds a dedicated e2e DB (data/e2e.db) from scratch on every invocation.
 * This guarantees a clean, reproducible baseline:
 *   - No residue from previous runs (E2E* members, trips, etc.)
 *   - No dependency on a pre-existing demo.db
 *   - Idempotent: running twice gives the same result
 *
 * The webServer block in playwright.config.ts boots the app with
 * DB_PATH=data/e2e.db so it reads from this fresh database.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default async function globalSetup(): Promise<void> {
  // Skip when reusing an already-seeded server (e.g. running specs one file at a
  // time against a persistent prod server to exercise a randomized file order).
  // Wiping data/e2e.db here would pull the rug out from under that server's open
  // (cached) SQLite connection.
  if (process.env.E2E_REUSE_DB === "1") {
    console.log("[e2e globalSetup] E2E_REUSE_DB=1 — skipping reseed.");
    return;
  }

  const root = path.resolve(__dirname, "..");
  const e2eDb = path.join(root, "data", "e2e.db");

  // Remove stale e2e DB files so the seed always starts from scratch.
  for (const suffix of ["", "-shm", "-wal"]) {
    const f = e2eDb + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // Ensure the data/ directory exists (it may not if the worktree has no symlink).
  fs.mkdirSync(path.join(root, "data"), { recursive: true });

  console.log("[e2e globalSetup] Seeding data/e2e.db …");

  execSync("npx tsx scripts/seed-demo.ts", {
    cwd: root,
    env: { ...process.env, DB_PATH: e2eDb },
    stdio: "inherit",
  });

  console.log("[e2e globalSetup] data/e2e.db ready.");
}
