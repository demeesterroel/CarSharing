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
      },
});
