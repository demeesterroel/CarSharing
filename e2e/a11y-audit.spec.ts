import { test, expect, type Page } from "@playwright/test";
import path from "path";

/**
 * Accessibility audit using axe-core.
 *
 * Theme: ALL tests run in MONO theme.
 * All demo.db users (alice, bob, carol, owner, admin) have theme_preference='mono'.
 * Contrast thresholds must pass against the mono palette (paperDeep background,
 * inkDim minimum for body text — inkMute is intentionally excluded from small text).
 */

// axe-core loaded from local node_modules — no CDN dependency
const AXE_PATH = path.resolve(
  __dirname,
  "../node_modules/axe-core/axe.js"
);

type AxeViolation = {
  id: string;
  impact: string | null;
  description: string;
  nodes: number;
  selector: string;
};

async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: AXE_PATH });
  await page.waitForFunction(() => typeof (window as any).axe !== "undefined");
  return page.evaluate(async () => {
    const results = await (window as any).axe.run();
    return results.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      selector: v.nodes[0]?.target?.join(" ") ?? "",
    }));
  });
}

async function loginAs(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.request.post("/api/auth/login", {
    data: { username, password },
  });
}

function filterBlocking(violations: AxeViolation[]): AxeViolation[] {
  return violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `  [${v.impact}] ${v.id}: ${v.description}\n    → ${v.selector} (${v.nodes} node${v.nodes !== 1 ? "s" : ""})`
    )
    .join("\n");
}

async function auditRoute(
  page: Page,
  route: string,
  label: string
): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState("networkidle");

  const violations = await runAxe(page);
  const blocking = filterBlocking(violations);

  if (blocking.length > 0) {
    console.log(`\nFAIL ${label} (${route}):\n${formatViolations(blocking)}`);
  } else {
    const warn = violations.filter((v) => v.impact === "moderate");
    if (warn.length > 0) {
      console.log(
        `WARN ${label} (${route}): ${warn.length} moderate violation(s)`
      );
    }
  }

  expect(
    blocking,
    `${label} (${route}) has ${blocking.length} critical/serious a11y violation(s):\n${formatViolations(blocking)}`
  ).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Public (unauthenticated)
// ---------------------------------------------------------------------------
test.describe("a11y — public routes", () => {
  test("/login", async ({ page }) => {
    await auditRoute(page, "/login", "login page");
  });
});

// ---------------------------------------------------------------------------
// User role (alice)
// ---------------------------------------------------------------------------
test.describe("a11y — user routes (alice)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice", "alice");
  });

  for (const route of [
    "/trips",
    "/expenses",
    "/fuel",
    "/vehicles",
    "/calendar",
    "/payments",
    "/people",
  ]) {
    test(route, async ({ page }) => {
      await auditRoute(page, route, `user:${route}`);
    });
  }
});

// ---------------------------------------------------------------------------
// Owner role
// ---------------------------------------------------------------------------
test.describe("a11y — owner routes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "owner", "owner");
  });

  test("/owner", async ({ page }) => {
    await auditRoute(page, "/owner", "owner:/owner");
  });
});

// ---------------------------------------------------------------------------
// Admin role
// ---------------------------------------------------------------------------
test.describe("a11y — admin routes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin", "admin");
  });

  for (const route of [
    "/admin",
    "/admin/members",
    "/admin/payments",
    "/admin/payout",
    "/admin/settings",
    "/admin/settlement",
    "/admin/vehicles",
  ]) {
    test(route, async ({ page }) => {
      await auditRoute(page, route, `admin:${route}`);
    });
  }
});
