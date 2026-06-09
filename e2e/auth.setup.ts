import { test as setup } from "@playwright/test";

/**
 * Shared login setup for E2E tests.
 *
 * The login form posts { username, password } to /api/auth/login.
 * Labels are rendered in Dutch by default:
 *   - "Naam *"   → username field
 *   - "Wachtwoord" → password field
 *   - "Inloggen"  → submit button
 */
setup("log in", async ({ page }) => {
  await page.goto("/login");

  // The label text comes from t("form.name") → "Naam *" (nl) / "Name *" (en)
  await page.getByLabel(/naam|name/i).fill(process.env.TEST_EMAIL ?? "alice");

  // t("form.password") → "Wachtwoord" (nl) / "Password" (en)
  await page.getByLabel(/wachtwoord|password/i).fill(process.env.TEST_PASSWORD ?? "alice");

  // t("action.login") → "Inloggen" (nl) / "Log in" (en)
  await page.getByRole("button", { name: /inloggen|log\s*in/i }).click();

  // After a successful login the app redirects to "/" which Next.js resolves to /trips
  await page.waitForURL(/trips|dashboard|\//);
});
