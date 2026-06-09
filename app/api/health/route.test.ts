import { version } from "@/package.json";
import { describe, expect, it } from "vitest";
import { GET, HEAD } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with { ok: true, version }", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version });
  });

  it("does not set any auth cookie", async () => {
    const res = GET();
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("HEAD /api/health", () => {
  it("returns 200 with empty body", () => {
    const res = HEAD();
    expect(res.status).toBe(200);
  });
});
