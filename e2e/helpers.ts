import type { APIRequestContext } from "@playwright/test";

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
  email = process.env.TEST_EMAIL ?? "test@example.com",
  password = process.env.TEST_PASSWORD ?? "changeme"
): Promise<string> {
  const res = await request.post("/api/auth/login", {
    data: { username: email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }

  // Read the csrf-token cookie that is set by /api/me (GET) — the login
  // response itself doesn't write it, but the GET call after login does.
  // Trigger it now so the cookie is present.
  const meRes = await request.get("/api/me");
  const cookies = await meRes.headersArray();
  // The csrf-token is set as a cookie — extract it from Set-Cookie
  for (const h of cookies) {
    if (h.name.toLowerCase() === "set-cookie") {
      const m = h.value.match(/csrf-token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
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
