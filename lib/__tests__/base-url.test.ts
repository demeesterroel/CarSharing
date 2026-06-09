import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_BASE_URL: "https://canonical.example" } }));

import { resolveBaseUrl } from "../base-url";

afterEach(() => vi.unstubAllEnvs());

describe("resolveBaseUrl", () => {
  it("uses the actual request origin in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(resolveBaseUrl(new Request("http://localhost:3359/api/people/1/invite"))).toBe(
      "http://localhost:3359"
    );
  });

  it("uses the configured canonical URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveBaseUrl(new Request("http://internal-host:3000/api/x"))).toBe(
      "https://canonical.example"
    );
  });

  it("keeps the env-based URL under the test runner (so route tests are unaffected)", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(resolveBaseUrl(new Request("http://localhost/api/x"))).toBe("https://canonical.example");
  });
});
