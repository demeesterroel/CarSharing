import { defineConfig } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Fixed session password for the e2e server. The admin-skeleton spec seals a
// session cookie with this exact value (see e2e/admin-skeleton.spec.ts), so the
// server MUST use the same password or the cookie can't be decrypted and the
// middleware redirects /admin → /login (which made the skeleton tests flaky).
// Keep this in sync with E2E_SESSION_PASSWORD in e2e/admin-skeleton.spec.ts.
export const E2E_SESSION_PASSWORD =
  process.env.SESSION_PASSWORD ?? "autodelen-dev-session-password-32-chars-xyz";

export default defineConfig({
  testDir: "./e2e",

  // ── Hermetic isolation ────────────────────────────────────────────────────
  // globalSetup seeds data/e2e.db fresh on every run so no residue (E2E* rows,
  // half-deleted records, etc.) carries over between runs.
  globalSetup: "./e2e/global-setup.ts",

  // SQLite is a single-file database shared by the one app-server process.
  // Parallel Playwright workers would all write through the same server to the
  // same WAL, causing lock contention and unpredictable test failures.
  // workers: 1 is the correct constraint for a shared-SQLite test server.
  workers: 1,
  fullyParallel: false,

  use: {
    baseURL,
    screenshot: "only-on-failure",
    launchOptions: { slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0 },
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        // Run e2e against a PRODUCTION build, not `next dev`. The dev server
        // compiles routes on demand, and the first browser request to an
        // uncompiled route can stall — which produced flaky `csrf-token cookie
        // not found` and `toBeVisible` timeouts (issue #360). A prebuilt server
        // has no on-demand compilation, so these disappear.
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        // Building can take a couple of minutes on a cold cache.
        timeout: 240_000,
        // Pin the env the suite depends on so it doesn't rely on a local
        // .env.local. Kept identical across the e2e branches so the file never
        // conflicts on merge:
        //   - DB_PATH           — dedicated e2e DB seeded fresh by globalSetup
        //   - SESSION_PASSWORD  — matches admin-skeleton's sealed cookie
        //   - NEXT_PUBLIC_BASE_URL — absolute redirects
        //   - DISABLE_RATE_LIMIT — the suite logs in many times from one host,
        //     so the login brute-force limiter must not 429 it (no-op unless the
        //     rate-limit code that reads it is present).
        //   - MAIL_WEBHOOK_URL — /forgot disables its buttons unless a mail
        //     transport is configured (#282); a stub URL keeps the recovery UI
        //     flow enabled (delivery fails silently, the route still returns ok).
        env: {
          ...process.env,
          DB_PATH: "data/e2e.db",
          SESSION_PASSWORD: E2E_SESSION_PASSWORD,
          NEXT_PUBLIC_BASE_URL: baseURL,
          DISABLE_RATE_LIMIT: "1",
          MAIL_WEBHOOK_URL: "http://127.0.0.1:9/e2e-mail-stub",
        },
      },
});
