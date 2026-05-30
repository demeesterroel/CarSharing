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
        // .env.local: a known session password (matches admin-skeleton's
        // sealed cookie) and a base URL for absolute redirects.
        env: {
          ...process.env,
          SESSION_PASSWORD: E2E_SESSION_PASSWORD,
          NEXT_PUBLIC_BASE_URL: baseURL,
        },
      },
});
