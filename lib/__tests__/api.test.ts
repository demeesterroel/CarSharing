import { describe, it, expect } from "vitest";
import { z } from "zod";
import { json, readBody, badRequest, HttpError } from "../api";

describe("json wrapper", () => {
  it("returns data as JSON on success", async () => {
    const handler = json(async () => ({ ok: true }));
    const res = await handler(new Request("http://x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps HttpError to matching status", async () => {
    const handler = json(async () => { throw new HttpError(404, "gone"); });
    const res = await handler(new Request("http://x"), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "gone" });
  });

  it("maps ZodError to 400 with issues", async () => {
    const schema = z.object({ n: z.number() });
    const handler = json(async (req) => {
      const body = await readBody(req, schema);
      return body;
    });
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ n: "not-a-number" }), headers: { "Content-Type": "application/json" } });
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
  });
});
