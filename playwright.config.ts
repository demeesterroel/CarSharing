import { defineConfig } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

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
        // The suite authenticates many times from one host; disable the login
        // brute-force rate limit on the test server so logins aren't 429'd.
        env: { ...process.env, DISABLE_RATE_LIMIT: "1" },
      },
});
