/**
 * Generates all documentation screenshots.
 *
 * Usage:
 *   DB_PATH=data/demo.db npx tsx scripts/screenshot-docs.ts
 *
 * Partial run (START_FROM/END_AT skip entire code blocks, not just the screenshot):
 *   START_FROM=18 END_AT=18 DB_PATH=data/demo.db npx tsx scripts/screenshot-docs.ts
 *
 * Prerequisites:
 *   1. DB_PATH=data/demo.db npx tsx scripts/seed-demo.ts
 *   2. DB_PATH=data/demo.db npm start -- --port 4000
 *
 * Output: docs/screenshots/*.png
 */

import { chromium, type Page, type Browser } from "playwright";
import { mkdirSync } from "fs";
import path from "path";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const START_FROM = parseInt(process.env.START_FROM ?? "0", 10);
const END_AT = parseInt(process.env.END_AT ?? "9999", 10);
const OUT_DIR = path.join(process.cwd(), "docs", "screenshots");
mkdirSync(OUT_DIR, { recursive: true });

function shouldRun(num: number): boolean {
  return num >= START_FROM && num <= END_AT;
}

async function shot(page: Page, filename: string) {
  await page.waitForTimeout(300);
  const num = parseInt(filename.replace(/^0+/, "").match(/^\d+/)?.[0] ?? "0", 10);
  if (!shouldRun(num)) {
    console.log(`  ↷ ${filename} (skipped)`);
    return;
  }
  await Promise.race([
    page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`screenshot timeout: ${filename}`)), 10_000)
    ),
  ]);
  console.log(`  ✓ ${filename}`);
}

let localeSet = false;

async function ensureEnglish(page: Page) {
  if (localeSet) return;
  const enBtn = page.locator("button", { hasText: /^EN$/ });
  if ((await enBtn.count()) > 0) {
    await enBtn.click();
    await page.waitForTimeout(300);
  }
  localeSet = true;
}

async function login(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ensureEnglish(page);
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
  const fab = page
    .locator(
      'button[aria-label*="menu" i], button[aria-label*="add" i], button[aria-label*="toe" i]'
    )
    .last();
  const expanded = await fab.getAttribute("aria-expanded").catch(() => null);
  if (expanded !== "true") {
    await fab.click();
    await page.waitForTimeout(500);
  }
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
  await context.addInitScript(() => {
    localStorage.setItem("carsharing_locale", "en");
  });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());

  // ── Warmup: compile all routes before screenshots (skipped for partial runs) ─
  const skipWarmup = START_FROM > 0 || process.env.SKIP_WARMUP === "1";
  if (skipWarmup) {
    console.log("[warmup] skipped (partial run)\n");
    // Still need a valid session — quick login without visiting all routes
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
  } else {
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
      "/",
      "/trips",
      "/fuel",
      "/expenses",
      "/admin",
      "/admin/members",
      "/admin/vehicles",
      "/admin/settlement",
      `/user/3/edit`,
    ];
    for (const route of WARMUP_ROUTES) {
      process.stdout.write(`  warming ${route} ...`);
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle", timeout: 60000 });
      console.log(" done");
    }
    console.log("[warmup] complete\n");
  }

  console.log("\n[user guide]");

  // ── 02. Invite page — set-password screen seen by new members ────────────
  if (shouldRun(2)) {
    // Generate a real invite token for alice so the page renders correctly
    await login(page, "admin", "admin");
    const inviteUrl = await page.evaluate(async () => {
      const csrf =
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("csrf-token="))
          ?.split("=")?.[1] ?? "";
      const people: { id: number; username: string }[] = await fetch("/api/people").then((r) =>
        r.json()
      );
      const alice = people.find((p) => p.username === "alice");
      if (!alice) return null;
      const res = await fetch(`/api/people/${alice.id}/invite`, {
        method: "POST",
        headers: { "x-csrf-token": csrf },
      });
      const data = (await res.json()) as { url: string };
      return data.url;
    });
    if (!inviteUrl) throw new Error("Could not generate invite URL for alice");
    const invitePath = new URL(inviteUrl).pathname;
    // Keep admin session so the EN locale set during login persists on this page
    await page.goto(`${BASE_URL}${invitePath}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.textContent?.includes("Welcome to Autodelen"), {
      timeout: 10000,
      polling: 200,
    });
    await shot(page, "member-02-invite-page.png");
  }

  // ── 01. Invite link — expand first member card ─────────────────────────────
  if (shouldRun(1)) {
    await login(page, "admin", "admin");
    await page.goto(`${BASE_URL}/admin/members`);
    await idle(page);
    const firstMemberRow = page.locator('div[role="button"]').first();
    await firstMemberRow.click();
    await page.waitForTimeout(800);
    await shot(page, "admin-01-invite-link.png");
  }

  // Switch to alice for shots 03-22
  if (START_FROM <= 22 && END_AT >= 3) {
    await login(page, "alice", "alice");
  }

  // ── 03. Profile — hover "Hello Alice" heading ──────────────────────────────
  if (shouldRun(3)) {
    await page.goto(`${BASE_URL}/`);
    await idle(page);
    const helloLink = page.locator('a[href*="/user/"]').first();
    await helloLink.hover().catch(() => {});
    const pencilSpan = helloLink.locator("span").last();
    await pencilSpan.waitFor({ state: "visible" }).catch(() => page.waitForTimeout(500));
    await page.waitForTimeout(200);
    await shot(page, "member-03-profile-menu.png");
  }

  // ── 04. Profile edit form ──────────────────────────────────────────────────
  if (shouldRun(4)) {
    await page.goto(`${BASE_URL}/user/3/edit`);
    await idle(page);
    await shot(page, "member-04-profile-edit.png");
  }

  // ── 05. Dashboard ──────────────────────────────────────────────────────────
  if (shouldRun(5)) {
    await page.goto(`${BASE_URL}/`);
    await idle(page);
    await shot(page, "member-05-dashboard.png");
  }

  // ── 06. Dashboard scrolled to year summary ─────────────────────────────────
  if (shouldRun(6)) {
    if (!shouldRun(5)) {
      await page.goto(`${BASE_URL}/`);
      await idle(page);
    }
    await page.evaluate(() => window.scrollTo(0, 180));
    await page.waitForTimeout(200);
    await shot(page, "member-06-dashboard-filters.png");
  }

  // ── 07. Trips page ─────────────────────────────────────────────────────────
  if (shouldRun(7)) {
    await page.goto(`${BASE_URL}/trips`);
    await idle(page);
    await shot(page, "member-07-trips.png");
  }

  // ── 08. Trips filters — click AA car filter ────────────────────────────────
  if (shouldRun(8)) {
    if (!shouldRun(7)) {
      await page.goto(`${BASE_URL}/trips`);
      await idle(page);
    }
    const tripFilterAA = page.locator("button").filter({ hasText: /^AA$/ }).first();
    if ((await tripFilterAA.count()) > 0) {
      await tripFilterAA.click();
      await page.waitForTimeout(500);
    }
    await shot(page, "member-08-trips-filters.png");
  }

  // ── 09. Single trip card ───────────────────────────────────────────────────
  if (shouldRun(9)) {
    if (!shouldRun(7) && !shouldRun(8)) {
      await page.goto(`${BASE_URL}/trips`);
      await idle(page);
    }
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(300);
    await shot(page, "member-09-trip-card.png");
  }

  // ── 10. Fuel page ──────────────────────────────────────────────────────────
  if (shouldRun(10)) {
    await page.goto(`${BASE_URL}/fuel`);
    await idle(page);
    await shot(page, "member-10-fuel.png");
  }

  // ── 11. Fuel filters — click AA car filter ─────────────────────────────────
  if (shouldRun(11)) {
    if (!shouldRun(10)) {
      await page.goto(`${BASE_URL}/fuel`);
      await idle(page);
    }
    const fuelFilterAA = page.locator("button").filter({ hasText: /^AA$/ }).first();
    if ((await fuelFilterAA.count()) > 0) {
      await fuelFilterAA.click();
      await page.waitForTimeout(500);
    }
    await shot(page, "member-11-fuel-filters.png");
  }

  // ── 12. Single fuel card ───────────────────────────────────────────────────
  if (shouldRun(12)) {
    if (!shouldRun(10) && !shouldRun(11)) {
      await page.goto(`${BASE_URL}/fuel`);
      await idle(page);
    }
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(300);
    await shot(page, "member-12-fuel-card.png");
  }

  // ── 13. Expenses/cost page ─────────────────────────────────────────────────
  if (shouldRun(13)) {
    await page.goto(`${BASE_URL}/expenses`);
    await idle(page);
    await shot(page, "member-13-cost.png");
  }

  // ── 14. Expense filters — click MINE filter ────────────────────────────────
  if (shouldRun(14)) {
    if (!shouldRun(13)) {
      await page.goto(`${BASE_URL}/expenses`);
      await idle(page);
    }
    const expFilterMine = page
      .locator("button")
      .filter({ hasText: /^MINE$|^MIJN$/i })
      .first();
    if ((await expFilterMine.count()) > 0) {
      await expFilterMine.click();
      await page.waitForTimeout(500);
    }
    await shot(page, "member-14-cost-filters.png");
  }

  // ── 15. FAB closed ─────────────────────────────────────────────────────────
  if (shouldRun(15)) {
    await page.goto(`${BASE_URL}/`);
    await idle(page);
    await shot(page, "member-15-fab-closed.png");
  }

  // ── 16. FAB expanded ───────────────────────────────────────────────────────
  if (shouldRun(16)) {
    if (!shouldRun(15)) {
      await page.goto(`${BASE_URL}/`);
      await idle(page);
    }
    await openFab(page);
    await shot(page, "member-16-fab-expanded.png");
  }

  // ── 17. FAB → trip option highlighted ─────────────────────────────────────
  if (shouldRun(17)) {
    if (!shouldRun(16)) {
      await page.goto(`${BASE_URL}/`);
      await idle(page);
      await openFab(page);
    }
    // FAB chit buttons have className="animate-pop-in" — use it to avoid matching nav/trip-card buttons
    const tripOption = page
      .locator("button.animate-pop-in")
      .filter({ hasText: /\btrip\b|\brit\b/i })
      .first();
    if ((await tripOption.count()) > 0) {
      // React onMouseEnter won't fire from Playwright — force hover style via inline style injection
      await tripOption.evaluate((el: HTMLElement) => {
        el.style.background = "#1a1a1a";
        el.style.color = "#f5f0e8";
      });
      await page.waitForTimeout(300);
    }
    await shot(page, "member-17-fab-add-trip.png");
  }

  // ── 18. New trip form ──────────────────────────────────────────────────────
  if (shouldRun(18)) {
    // Pre-cleanup: delete any leftover test trips from previous runs before adding a fresh one
    await page.goto(`${BASE_URL}/trips`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const csrf =
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("csrf-token="))
          ?.split("=")?.[1] ?? "";
      const trips: { id: number; date: string; start_odometer: number; end_odometer: number }[] =
        await fetch("/api/trips")
          .then((r) => r.json())
          .catch(() => []);
      for (const t of trips.filter(
        (t) =>
          (t.date === "2026-12-31" && t.end_odometer - t.start_odometer === 100) ||
          (t.start_odometer === 0 && t.end_odometer === 100)
      )) {
        await fetch(`/api/trips/${t.id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf },
        }).catch(() => {});
      }
    });
    // Navigate fresh — avoids any FAB state leftover from previous shots
    await page.goto(`${BASE_URL}/trips?action=add`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // "Car AA" only appears in the car tab button — trip cards show destination, not car name
    const aaCarTab = page.locator("button").filter({ hasText: "Car AA" }).first();
    await aaCarTab.waitFor({ state: "visible" });
    // Set date first so the last-odometer API uses Dec 2026 as reference (seed trips are Dec 2026)
    await page.locator('input[type="date"]').fill("2026-12-31");
    await page.waitForTimeout(300);
    // Use native el.click() — force:true bypasses React synthetic events
    await aaCarTab.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(3000); // trip form invalidates & re-fetches car state — needs extra time
    const numInputs = page.locator('input[type="number"]');
    const startVal = await numInputs
      .nth(0)
      .inputValue()
      .catch(() => "0");
    const endVal = (parseInt(startVal || "0") + 100).toString();
    await numInputs.nth(1).click({ clickCount: 3 });
    await numInputs.nth(1).fill(endVal);
    const tripMapEl = page.locator(".leaflet-container").first();
    if ((await tripMapEl.count()) > 0) {
      const box = await tripMapEl.boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(2000);
    }
    await shot(page, "member-18-trip-form.png");
    const saveTripBtn = page
      .locator("button")
      .filter({ hasText: /save trip|sla rit op/i })
      .first();
    await saveTripBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto(`${BASE_URL}/trips`);
    await idle(page);
  }

  // ── 19. Trips list — new trip visible at top ──────────────────────────────
  if (shouldRun(19)) {
    if (!shouldRun(18)) {
      await page.goto(`${BASE_URL}/trips`);
      await idle(page);
    }
    await shot(page, "member-19-trips-after-add.png");
    // Clean up trips added by this script: date 2026-12-31 with +100km delta, or legacy start=0/end=100
    await page.evaluate(async () => {
      const csrf =
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("csrf-token="))
          ?.split("=")?.[1] ?? "";
      const trips: { id: number; date: string; start_odometer: number; end_odometer: number }[] =
        await fetch("/api/trips")
          .then((r) => r.json())
          .catch(() => []);
      for (const t of trips.filter(
        (t) =>
          (t.date === "2026-12-31" && t.end_odometer - t.start_odometer === 100) ||
          (t.start_odometer === 0 && t.end_odometer === 100)
      )) {
        await fetch(`/api/trips/${t.id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf },
        }).catch(() => {});
      }
    });
  }

  // ── 20. FAB → fill-up option highlighted ──────────────────────────────────
  if (shouldRun(20)) {
    await page.goto(`${BASE_URL}/`);
    await idle(page);
    await openFab(page);
    const fillupOption = page
      .locator("button.animate-pop-in")
      .filter({ hasText: /fill.up|tanken/i })
      .first();
    if ((await fillupOption.count()) > 0) {
      await fillupOption.evaluate((el: HTMLElement) => {
        el.style.background = "#1a1a1a";
        el.style.color = "#f5f0e8";
      });
    }
    await shot(page, "member-20-fab-add-fuel.png");
  }

  // ── 21. New fuel form ──────────────────────────────────────────────────────
  if (shouldRun(21)) {
    // Pre-cleanup: remove leftover test fill-ups from previous runs
    await page.goto(`${BASE_URL}/fuel`, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const csrf =
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("csrf-token="))
          ?.split("=")?.[1] ?? "";
      const fuel: { id: number; date: string; liters: number; amount: number }[] = await fetch(
        "/api/fuel"
      )
        .then((r) => r.json())
        .catch(() => []);
      for (const f of fuel.filter(
        (f) => f.date === "2026-12-31" && f.liters === 30 && f.amount === 50
      )) {
        await fetch(`/api/fuel/${f.id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf },
        }).catch(() => {});
      }
    });
    // Navigate fresh — avoids any FAB state leftover
    await page.goto(`${BASE_URL}/fuel?action=add`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const aaFuelTab = page.locator("button").filter({ hasText: "Car AA" }).first();
    await aaFuelTab.waitFor({ state: "visible" });
    // Set date first so fill-up appears at top of dec 2026 in shot 22
    await page.locator('input[type="date"]').fill("2026-12-31");
    await page.waitForTimeout(300);
    await aaFuelTab.evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(1500); // wait for last-odometer API
    const fuelNumInputs = page.locator('input[type="number"]');
    await fuelNumInputs.nth(0).click({ clickCount: 3 });
    await fuelNumInputs.nth(0).fill("50"); // amount €50
    await fuelNumInputs.nth(1).click({ clickCount: 3 });
    await fuelNumInputs.nth(1).fill("30"); // liters 30L → €1.67/L
    const fuelMapEl = page.locator(".leaflet-container").first();
    if ((await fuelMapEl.count()) > 0) {
      const box = await fuelMapEl.boundingBox();
      if (box) await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.35);
      await page.waitForTimeout(2000);
    }
    await shot(page, "member-21-fuel-form.png");
    const saveFuelBtn = page
      .locator("button")
      .filter({ hasText: /save|sla op|opslaan|fill.up/i })
      .first();
    await saveFuelBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto(`${BASE_URL}/fuel`);
    await idle(page);
  }

  // ── 22. Fuel list — new fill-up visible at top ────────────────────────────
  if (shouldRun(22)) {
    await page.goto(`${BASE_URL}/fuel`);
    await idle(page);
    await shot(page, "member-22-fuel-after-add.png");
    // Clean up fill-ups added by this script (30L / €50)
    await page.evaluate(async () => {
      const csrf =
        document.cookie
          .split(";")
          .find((c) => c.trim().startsWith("csrf-token="))
          ?.split("=")?.[1] ?? "";
      const fuel: { id: number; date: string; liters: number; amount: number }[] = await fetch(
        "/api/fuel"
      )
        .then((r) => r.json())
        .catch(() => []);
      for (const f of fuel.filter(
        (f) => f.date === "2026-12-31" && f.liters === 30 && f.amount === 50
      )) {
        await fetch(`/api/fuel/${f.id}`, {
          method: "DELETE",
          headers: { "x-csrf-token": csrf },
        }).catch(() => {});
      }
    });
  }

  // ── Owner guide ─────────────────────────────────────────────────────────────
  console.log("\n[owner guide]");

  if (START_FROM <= 112 && END_AT >= 100) {
    await login(page, "admin", "admin");
  }

  // ── 100. Inbox — pending reservations ─────────────────────────────────────
  if (shouldRun(100)) {
    await page.goto(`${BASE_URL}/admin`);
    await idle(page);
    await shot(page, "owner-100-inbox.png");
  }

  // ── 101. Single inbox item ─────────────────────────────────────────────────
  if (shouldRun(101)) {
    if (!shouldRun(100)) {
      await page.goto(`${BASE_URL}/admin`);
      await idle(page);
    }
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(300);
    await shot(page, "owner-101-inbox-item.png");
  }

  // ── 102. Cars list ─────────────────────────────────────────────────────────
  if (shouldRun(102)) {
    await page.goto(`${BASE_URL}/admin/vehicles`);
    await idle(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await shot(page, "owner-102-cars-list.png");
  }

  // ── 103. Add car form — filled with example data ──────────────────────────
  if (shouldRun(103)) {
    if (!shouldRun(102)) {
      await page.goto(`${BASE_URL}/admin/vehicles`);
      await idle(page);
    }
    const addCarFab = page
      .locator(
        'button[aria-label*="car" i], button[aria-label*="wagen" i], button[aria-label*="new" i], button[aria-label*="add" i]'
      )
      .last();
    if ((await addCarFab.count()) > 0) await addCarFab.click();
    const shortInput = page.locator('input[placeholder="ETH"]');
    await shortInput.waitFor({ state: "visible" });
    const carNameInput = page.locator("input:not([placeholder]):not([type])").first();
    await carNameInput.fill("Car EE");
    await shortInput.fill("EE");
    const priceInput = page.locator('input[type="number"]').first();
    await priceInput.click({ clickCount: 3 });
    await priceInput.fill("0.28");
    await page.waitForTimeout(300);
    await shot(page, "owner-103-car-add-form.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // ── 104. Car edit form ─────────────────────────────────────────────────────
  if (shouldRun(104)) {
    if (!shouldRun(102) && !shouldRun(103)) {
      await page.goto(`${BASE_URL}/admin/vehicles`);
      await idle(page);
    }
    const firstCarToggle = page.locator('div[role="button"]').first();
    await firstCarToggle.click();
    await page.waitForTimeout(800);
    await shot(page, "owner-104-car-edit-form.png");
  }

  // ── 105. Car detail view — cost/coverage stats ────────────────────────────
  if (shouldRun(105)) {
    await page.goto(`${BASE_URL}/admin/vehicles?view=detail&car=1`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    // Poll until CostCoverageScreen renders (useAdminSummary is async; shows "geen data" until loaded)
    // Use textContent not innerText — CSS text-transform:uppercase changes innerText case
    await page.waitForFunction(
      () => document.body.textContent?.includes("Cost coverage") === true,
      { timeout: 20000, polling: 300 }
    );
    await page.waitForTimeout(300);
    await shot(page, "owner-105-car-overview.png");
  }

  // ── 107. Members page ──────────────────────────────────────────────────────
  if (shouldRun(107)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.goto(`${BASE_URL}/admin/members`);
    await idle(page);
    await shot(page, "admin-107-car-overview-members.png");
  }

  // ── 108. Settlements page ──────────────────────────────────────────────────
  if (shouldRun(108)) {
    await page.goto(`${BASE_URL}/admin/settlement?year=2025`);
    await idle(page);
    await page.waitForTimeout(2000);
    await shot(page, "owner-108-settlements.png");
  }

  // ── 109. Settlement table — finalized year ────────────────────────────────
  if (shouldRun(109)) {
    // Always navigate to a finalized year so FINALIZED badge + REOPEN button are visible
    await page.goto(`${BASE_URL}/admin/settlement?year=2024`, { waitUntil: "domcontentloaded" });
    await idle(page);
    await page.waitForTimeout(2000);
    await shot(page, "owner-109-settlement-table.png");
  }

  // ── 110. Open settlement — ready to lock ──────────────────────────────────
  if (shouldRun(110)) {
    // Navigate to the open (not yet finalized) year to show LOCK SETTLEMENT button
    await page.goto(`${BASE_URL}/admin/settlement?year=2025`, { waitUntil: "domcontentloaded" });
    await idle(page);
    await page.waitForTimeout(2000);
    await shot(page, "owner-110-settlement-transfers.png");
  }

  // ── 111. Settlement message dialog ────────────────────────────────────────
  if (shouldRun(111)) {
    if (!shouldRun(110)) {
      await page.goto(`${BASE_URL}/admin/settlement?year=2025`);
      await idle(page);
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const msgBtn = page
      .locator("button")
      .filter({ hasText: /bericht|message|send/i })
      .first();
    if ((await msgBtn.count()) > 0) {
      await msgBtn.click();
      await page.waitForTimeout(500);
      await shot(page, "owner-111-settlement-message.png");
      await page.keyboard.press("Escape");
    } else {
      await shot(page, "owner-111-settlement-message.png");
    }
  }

  // ── 112. Lock settlement ───────────────────────────────────────────────────
  if (shouldRun(112)) {
    if (!shouldRun(108) && !shouldRun(109) && !shouldRun(110) && !shouldRun(111)) {
      await page.goto(`${BASE_URL}/admin/settlement?year=2025`);
      await idle(page);
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "owner-112-settlement-lock.png");
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  await browser.close();
  console.log(`\n✅ Screenshots saved to docs/screenshots/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
