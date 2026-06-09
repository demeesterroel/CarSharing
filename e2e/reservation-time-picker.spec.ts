import { expect, test } from "@playwright/test";

/**
 * Regression for #191: the optional reservation time picker (clock-timepicker).
 *
 * Bug: tabbing (keyboard) into a fresh time field selected the hour part, then
 * the component wrote its default value, moving the caret to the end and
 * clobbering the hour highlight. Clicking worked; tabbing did not. The wrapper
 * (components/time-picker.tsx) re-applies the hour selection after focus.
 *
 * This test asserts the "blue selection": when you Tab from the start field into
 * the end field, the end input's hour part ("HH") is selected (selectionStart=0,
 * selectionEnd=2). Without the fix, selectionStart===selectionEnd (no highlight).
 */
test.describe("reservation time picker (#191)", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate the page's own context via the login UI.
    await page.goto("/login");
    await page.fill("#login-username", process.env.TEST_EMAIL ?? "alice");
    await page.fill("#login-password", process.env.TEST_PASSWORD ?? "alice");
    await page.press("#login-password", "Enter");
    await page.waitForURL(/trips|dashboard|calendar|\/$/);
  });

  test("Tab into the end-time field highlights the hour part", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // Open the add-reservation sheet (FAB; aria-label is localized — nl default).
    await page.locator('[aria-label*="eserver"], button:has-text("eserver")').first().click();

    // Uncheck "all day" to reveal the start/end time pickers.
    await page.locator('input[type="checkbox"]').first().uncheck();

    const inputs = page.locator("clock-timepicker input");
    await expect(inputs).toHaveCount(2);

    // Open START by clicking (defaults to 00:00, hour selected), Tab to its
    // minute part, then Tab again to move focus into the END field.
    await inputs.nth(0).click();
    await page.keyboard.press("Tab"); // start hour -> start minute
    await page.keyboard.press("Tab"); // start minute (last) -> end field
    await page.waitForTimeout(150); // let the re-select microtask run

    const sel = await page.evaluate(() => {
      const el = document.querySelectorAll("clock-timepicker")[1]!.querySelector("input")!;
      return {
        focused: document.activeElement === el,
        value: el.value,
        start: el.selectionStart,
        len: (el.selectionEnd ?? 0) - (el.selectionStart ?? 0),
      };
    });

    expect(sel.focused).toBe(true);
    expect(sel.value).not.toBe(""); // picker populated (e.g. "00:00")
    expect(sel.start).toBe(0); // selection begins at the hour
    expect(sel.len).toBe(2); // the two hour digits are highlighted
  });
});
