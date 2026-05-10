/**
 * Generates all documentation screenshots.
 *
 * Usage:
 *   DB_PATH=data/demo.db npx tsx scripts/screenshot-docs.ts
 *
 * Prerequisites:
 *   1. DB_PATH=data/demo.db npx tsx scripts/seed-demo.ts
 *   2. DB_PATH=data/demo.db npm run dev -- --port 4000
 *
 * Output: docs/screenshots/*.png
 */

import { chromium, type Page, type Browser } from "playwright";
import { mkdirSync } from "fs";
import path from "path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const OUT_DIR = path.join(process.cwd(), "docs", "screenshots");
mkdirSync(OUT_DIR, { recursive: true });

async function shot(page: Page, filename: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
  console.log(`  ✓ ${filename}`);
}

let localeSet = false;

async function ensureEnglish(page: Page) {
  if (localeSet) return;
  // Click EN button if present and NL is currently active
  const enBtn = page.locator('button', { hasText: /^EN$/ });
  if (await enBtn.count() > 0) {
    await enBtn.click();
    await page.waitForTimeout(300);
  }
  localeSet = true;
}

async function login(page: Page, username: string, password: string) {
  // Go to login page first so the cookie is set on the right origin
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ensureEnglish(page);
  // Call API directly — React-controlled form doesn't respond to page.fill()
  const ok = await page.evaluate(
    async ([u, p]) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      return r.ok;
    },
    [username, password] as [string, string]
  );
  if (!ok) throw new Error(`Login failed for ${username}`);
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 60000 });
}

async function idle(page: Page) {
  await page.waitForLoadState("load", { timeout: 30000 });
  await page.waitForTimeout(600);
}

async function openFab(page: Page) {
  // FAB open button has aria-label matching "open_menu" translation or is the last fixed button
  const fab = page.locator('button[aria-label*="menu" i], button[aria-label*="add" i], button[aria-label*="toe" i]').last();
  await fab.click();
  await page.waitForTimeout(500);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const browser: Browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({
    viewport: { width: 430, height: 844 },
    deviceScaleFactor: 1,
  });
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(60000);
  // Inject before every page script so locale-provider reads "en" on mount
  await context.addInitScript(() => {
    localStorage.setItem("carsharing_locale", "en");
  });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());

  // ── Warmup: compile all routes before screenshots ─────────────────────────
  console.log("\n[warmup] logging in...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ensureEnglish(page);
  await page.evaluate(
    async ([u, p]) => {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
    },
    ["admin", "admin"] as [string, string]
  );
  const WARMUP_ROUTES = [
    "/", "/trips", "/fuel", "/expenses",
    "/admin", "/admin/members", "/admin/vehicles", "/admin/settlement",
    `/user/3/edit`,
  ];
  for (const route of WARMUP_ROUTES) {
    process.stdout.write(`  warming ${route} ...`);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 60000 });
    console.log(" done");
  }
  console.log("[warmup] complete\n");

  console.log("\n[user guide]");

  // ── 2. First login page (unauthenticated) ───────────────────────────────────
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await ensureEnglish(page);
  await shot(page, "02-first-login.png");

  // ── 1. Invite link — needs admin session ────────────────────────────────────
  await login(page, "admin", "admin");
  await page.goto(`${BASE_URL}/admin/members`);
  await idle(page);
  await shot(page, "01-invite-link.png");

  // Switch to alice for member screens
  await login(page, "alice", "alice");

  // ── 3. Profile — hover "Hello Alice" heading which links to profile edit ─────
  await page.goto(`${BASE_URL}/`);
  await idle(page);
  const helloLink = page.locator('a[href*="/user/"]').first();
  await helloLink.hover().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, "03-profile-menu.png");

  // ── 4. Profile edit form ────────────────────────────────────────────────────
  const aliceId = 3;
  await page.goto(`${BASE_URL}/user/${aliceId}/edit`);
  await idle(page);
  await shot(page, "04-profile-edit.png");

  // ── 5. Dashboard ────────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/`);
  await idle(page);
  await shot(page, "05-dashboard.png");

  // ── 6. Dashboard scrolled to show year summary ────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 180));
  await page.waitForTimeout(200);
  await shot(page, "06-dashboard-filters.png");

  // ── 7. Trips page ───────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/trips`);
  await idle(page);
  await shot(page, "07-trips.png");

  // ── 8. Trips filters — click AA car filter to show active state ──────────────
  const tripFilterAA = page.locator('button').filter({ hasText: /^AA$/ }).first();
  if (await tripFilterAA.count() > 0) {
    await tripFilterAA.click();
    await page.waitForTimeout(500);
  }
  await shot(page, "08-trips-filters.png");

  // ── 9. Single trip card ─────────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 100));
  await page.waitForTimeout(300);
  await shot(page, "09-trip-card.png");

  // ── 10. Fuel page ───────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/fuel`);
  await idle(page);
  await shot(page, "10-fuel.png");

  // ── 11. Fuel filters — click AA car filter ───────────────────────────────────
  const fuelFilterAA = page.locator('button').filter({ hasText: /^AA$/ }).first();
  if (await fuelFilterAA.count() > 0) {
    await fuelFilterAA.click();
    await page.waitForTimeout(500);
  }
  await shot(page, "11-fuel-filters.png");

  // ── 12. Single fuel card ────────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 100));
  await page.waitForTimeout(300);
  await shot(page, "12-fuel-card.png");

  // ── 13. Expenses/cost page ──────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/expenses`);
  await idle(page);
  await shot(page, "13-cost.png");

  // ── 14. Expense filters — click MINE filter ──────────────────────────────────
  const expFilterMine = page.locator('button').filter({ hasText: /^MINE$|^MIJN$/i }).first();
  if (await expFilterMine.count() > 0) {
    await expFilterMine.click();
    await page.waitForTimeout(500);
  }
  await shot(page, "14-cost-filters.png");

  // ── 15. FAB closed ──────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/`);
  await idle(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "15-fab-closed.png");

  // ── 16. FAB expanded ────────────────────────────────────────────────────────
  await openFab(page);
  await shot(page, "16-fab-expanded.png");

  // ── 17. FAB → trip option highlighted ──────────────────────────────────────
  // Re-open FAB (may have closed during shot 16 wait), then hover trip button
  await openFab(page);
  const tripOption = page.locator('button').filter({ hasText: /^trip$|^rit$/i }).first();
  if (await tripOption.count() > 0) {
    await tripOption.hover({ force: true }).catch(() => {});
  }
  await shot(page, "17-fab-add-trip.png");

  // ── 18. New trip form — fill in data and save ────────────────────────────────
  await page.goto(`${BASE_URL}/trips?action=add`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  // Select Car AA tab
  const aaCarTab = page.locator('button').filter({ hasText: /^AA$/ }).first();
  await aaCarTab.click().catch(() => {});
  await page.waitForTimeout(300);
  // Fill odometer: AA current max = 89083, add 100 km
  const numInputs = page.locator('input[type="number"]');
  await numInputs.nth(0).fill("89083").catch(() => {});
  await numInputs.nth(1).fill("89183").catch(() => {});
  // Click map center to set Antwerp location
  const tripMapEl = page.locator('.leaflet-container').first();
  if (await tripMapEl.count() > 0) {
    const box = await tripMapEl.boundingBox();
    if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(600);
  }
  await shot(page, "18-trip-form.png");
  // Save
  const saveTripBtn = page.locator('button').filter({ hasText: /save trip|sla rit op/i }).first();
  await saveTripBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);

  // ── 19. Trips list — new trip visible at top ─────────────────────────────────
  await page.goto(`${BASE_URL}/trips`);
  await idle(page);
  await shot(page, "19-trips-after-add.png");

  // ── 20. FAB → fuel option highlighted ──────────────────────────────────────
  await page.goto(`${BASE_URL}/fuel`);
  await idle(page);
  await openFab(page);
  const fuelOption = page.locator('button[aria-label*="tank" i], button[aria-label*="fuel" i], button:has-text("tank"), button:has-text("fuel")').first();
  await fuelOption.hover({ force: true });
  await shot(page, "20-fab-add-fuel.png");

  // ── 21. New fuel form — fill in data and save ────────────────────────────────
  await page.goto(`${BASE_URL}/fuel?action=add`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  // Select Car AA tab
  const aaFuelTab = page.locator('button').filter({ hasText: /^AA$/ }).first();
  await aaFuelTab.click().catch(() => {});
  await page.waitForTimeout(300);
  // Fill liters and total price
  const fuelNumInputs = page.locator('input[type="number"]');
  await fuelNumInputs.nth(0).fill("30").catch(() => {});
  await fuelNumInputs.nth(1).fill("50").catch(() => {});
  // Click map to set location (E19 area north of Antwerp)
  const fuelMapEl = page.locator('.leaflet-container').first();
  if (await fuelMapEl.count() > 0) {
    const box = await fuelMapEl.boundingBox();
    if (box) await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.35);
    await page.waitForTimeout(600);
  }
  await shot(page, "21-fuel-form.png");
  // Save
  const saveFuelBtn = page.locator('button').filter({ hasText: /save|sla op|opslaan|fill.up/i }).first();
  await saveFuelBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);

  // ── 22. Fuel list — new fill-up visible at top ───────────────────────────────
  await page.goto(`${BASE_URL}/fuel`);
  await idle(page);
  await shot(page, "22-fuel-after-add.png");

  // ── Owner guide ──────────────────────────────────────────────────────────────
  console.log("\n[owner guide]");
  await login(page, "admin", "admin");

  // ── 100. Inbox — pending reservations from Alice and Bob ─────────────────────
  await page.goto(`${BASE_URL}/admin`);
  await idle(page);
  await shot(page, "100-inbox.png");

  // ── 101. Single inbox item ──────────────────────────────────────────────────
  // Scroll down to show the first pending reservation card
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  await shot(page, "101-inbox-item.png");

  // ── 102. Cars list ──────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/admin/vehicles`);
  await idle(page);
  await shot(page, "102-cars-list.png");

  // ── 103. Add car form — filled with example data ─────────────────────────────
  const addCarFab = page.locator('button[aria-label*="car" i], button[aria-label*="wagen" i], button[aria-label*="new" i]').last();
  if (await addCarFab.count() > 0) {
    await addCarFab.click();
    await page.waitForTimeout(500);
  }
  // Fill in example data
  const carNameInput = page.locator('input[type="text"]').first();
  await carNameInput.fill("Car DD").catch(() => {});
  const shortCodeInput = page.locator('input').filter({ hasText: /ETH/i }).first();
  // Short code input — find by placeholder
  const shortInput = page.locator('input[placeholder*="ETH" i], input[placeholder*="short" i], input[placeholder*="code" i]').first();
  await shortInput.fill("DD").catch(() => {});
  const priceInput2 = page.locator('input[type="number"]').first();
  await priceInput2.fill("0.28").catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, "103-car-add-form.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // ── 104. Car edit form ──────────────────────────────────────────────────────
  const firstCar = page.locator('[style*="borderLeft"], [style*="border-left"]').first();
  if (await firstCar.count() > 0) {
    await firstCar.click();
    await page.waitForTimeout(500);
  }
  await shot(page, "104-car-edit-form.png");
  // Keep open for 105

  // ── 105. Car overview — top of edit form ────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await shot(page, "105-car-overview.png");

  // ── 106. Car overview — scrolled to show form fields ────────────────────────
  await page.evaluate(() => window.scrollTo(0, 250));
  await page.waitForTimeout(200);
  await shot(page, "106-car-overview-stats.png");

  // ── 107. Members page ───────────────────────────────────────────────────────
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.goto(`${BASE_URL}/admin/members`);
  await idle(page);
  await shot(page, "107-car-overview-members.png");

  // ── 108. Settlements page ───────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/admin/settlement?year=2025`);
  await idle(page);
  await shot(page, "108-settlements.png");

  // ── 109. Settlement table ───────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  await shot(page, "109-settlement-table.png");

  // ── 110. Transfers list ─────────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(200);
  await shot(page, "110-settlement-transfers.png");

  // ── 111. Settlement message dialog ─────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const msgBtn = page.locator('button').filter({ hasText: /bericht|message|send/i }).first();
  if (await msgBtn.count() > 0) {
    await msgBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "111-settlement-message.png");
    await page.keyboard.press("Escape");
  } else {
    await shot(page, "111-settlement-message.png");
  }

  // ── 112. Lock settlement ────────────────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "112-settlement-lock.png");

  // ── Done ──────────────────────────────────────────────────────────────────────
  await browser.close();
  console.log(`\n✅ 35 screenshots saved to docs/screenshots/`);
}

main().catch((err) => { console.error(err); process.exit(1); });
