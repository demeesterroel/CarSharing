import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Scroll to the bottom of the page repeatedly until no new content loads.
 * This triggers IntersectionObserver-based lazy loading (GroupedList sentinel).
 */
export async function scrollToLoadAll(page: Page): Promise<void> {
  let prevHeight = -1;
  for (let i = 0; i < 15; i++) {
    const height: number = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
}

/**
 * Log in via the /api/auth/login endpoint and return the CSRF token
 * that the server sets in the csrf-token cookie.
 *
 * After calling this, the Playwright page/context will hold both the
 * iron-session cookie and the csrf-token cookie, so subsequent page
 * navigations are fully authenticated.
 */
export async function loginAndGetCsrf(
  request: APIRequestContext,
  email = process.env.TEST_EMAIL ?? "alice",
  password = process.env.TEST_PASSWORD ?? "alice"
): Promise<string> {
  return (await loginAndGetSession(request, email, password)).csrf;
}

export async function loginAndGetSession(
  request: APIRequestContext,
  email = process.env.TEST_EMAIL ?? "alice",
  password = process.env.TEST_PASSWORD ?? "alice"
): Promise<{ csrf: string; personId: number | null }> {
  const res = await request.post("/api/auth/login", {
    data: { username: email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }

  const meRes = await request.get("/api/me");
  const meBody = await meRes.json() as { personId?: number | null };
  const cookies = await meRes.headersArray();
  for (const h of cookies) {
    if (h.name.toLowerCase() === "set-cookie") {
      const m = h.value.match(/csrf-token=([^;]+)/);
      if (m) return { csrf: decodeURIComponent(m[1]), personId: meBody.personId ?? null };
    }
  }

  throw new Error("csrf-token cookie not found after login + /api/me");
}

/**
 * Build a helper that issues authenticated API calls with the CSRF token.
 */
export function makeApi(request: APIRequestContext, csrf: string) {
  return {
    async post<T>(path: string, body: unknown): Promise<T> {
      const res = await request.post(path, {
        data: body,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
      });
      if (!res.ok()) {
        throw new Error(`POST ${path} failed: ${res.status()} ${await res.text()}`);
      }
      return res.json() as Promise<T>;
    },

    async delete(path: string): Promise<void> {
      const res = await request.delete(path, {
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok()) {
        throw new Error(`DELETE ${path} failed: ${res.status()} ${await res.text()}`);
      }
    },

    async patch<T>(path: string, body: unknown): Promise<T> {
      const res = await request.patch(path, {
        data: body,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf,
        },
      });
      if (!res.ok()) {
        throw new Error(`PATCH ${path} failed: ${res.status()} ${await res.text()}`);
      }
      return res.json() as Promise<T>;
    },

    async get<T>(path: string): Promise<T> {
      const res = await request.get(path);
      if (!res.ok()) {
        throw new Error(`GET ${path} failed: ${res.status()} ${await res.text()}`);
      }
      return res.json() as Promise<T>;
    },
  };
}

/**
 * Fetch the first active person and first active car from the API.
 * These are used as required foreign keys when creating test records.
 */
export async function getTestEntities(api: ReturnType<typeof makeApi>) {
  const [people, cars] = await Promise.all([
    api.get<Array<{ id: number; name: string; active: number }>>("/api/people"),
    api.get<Array<{ id: number; short: string; active: number }>>("/api/vehicles"),
  ]);

  const person = people.find((p) => p.active === 1) ?? people[0];
  const car = cars.find((c) => c.active === 1) ?? cars[0];

  if (!person || !car) {
    throw new Error("No people or cars found in DB — seed data missing");
  }

  return { personId: person.id, carId: car.id, carShort: (car as any).short };
}
