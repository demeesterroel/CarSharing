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
  use: {
    baseURL,
    screenshot: "only-on-failure",
    launchOptions: { slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0 },
  },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        // Pin the env the suite depends on so it doesn't rely on a local
        // .env.local. Kept identical across the e2e branches so the file never
        // conflicts on merge:
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
          SESSION_PASSWORD: E2E_SESSION_PASSWORD,
          NEXT_PUBLIC_BASE_URL: baseURL,
          DISABLE_RATE_LIMIT: "1",
          MAIL_WEBHOOK_URL: "http://127.0.0.1:9/e2e-mail-stub",
        },
      },
});
