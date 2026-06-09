// lib/__tests__/api_helpers.test.ts
// Tests for the pure/synchronous helpers in lib/api.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { badRequest, canEdit, forbidden, HttpError, notFound, readBody, readId } from "../api";

describe("HttpError", () => {
  it("creates an error with the given status and message", () => {
    const err = new HttpError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err instanceof Error).toBe(true);
  });
});

describe("notFound", () => {
  it("throws an HttpError with status 404", () => {
    expect(() => notFound()).toThrow(HttpError);
    try {
      notFound();
    } catch (err) {
      expect((err as HttpError).status).toBe(404);
    }
  });

  it("uses the provided message", () => {
    try {
      notFound("Custom not found");
    } catch (err) {
      expect((err as HttpError).message).toBe("Custom not found");
    }
  });
});

describe("badRequest", () => {
  it("throws an HttpError with status 400", () => {
    expect(() => badRequest()).toThrow(HttpError);
    try {
      badRequest();
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("uses the provided message", () => {
    try {
      badRequest("Missing field");
    } catch (err) {
      expect((err as HttpError).message).toBe("Missing field");
    }
  });
});

describe("forbidden", () => {
  it("throws an HttpError with status 403", () => {
    expect(() => forbidden()).toThrow(HttpError);
    try {
      forbidden();
    } catch (err) {
      expect((err as HttpError).status).toBe(403);
    }
  });
});

describe("readBody", () => {
  it("parses and validates a valid JSON body", async () => {
    const schema = z.object({ name: z.string(), amount: z.number() });
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", amount: 42 }),
    });
    const body = await readBody(req, schema);
    expect(body.name).toBe("Alice");
    expect(body.amount).toBe(42);
  });

  it("throws a ZodError for invalid body", async () => {
    const schema = z.object({ name: z.string(), amount: z.number() });
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice" }), // missing amount
    });
    await expect(readBody(req, schema)).rejects.toThrow();
  });

  it("calls badRequest for invalid JSON", async () => {
    const schema = z.object({ name: z.string() });
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    await expect(readBody(req, schema)).rejects.toThrow(HttpError);
  });
});

describe("readId", () => {
  it("parses a valid positive integer id", async () => {
    const ctx = { params: Promise.resolve({ id: "42" }) };
    expect(await readId(ctx)).toBe(42);
  });

  it("throws badRequest for non-numeric id", async () => {
    const ctx = { params: Promise.resolve({ id: "abc" }) };
    await expect(readId(ctx)).rejects.toThrow(HttpError);
  });

  it("throws badRequest for zero id", async () => {
    const ctx = { params: Promise.resolve({ id: "0" }) };
    await expect(readId(ctx)).rejects.toThrow(HttpError);
  });

  it("throws badRequest for negative id", async () => {
    const ctx = { params: Promise.resolve({ id: "-5" }) };
    await expect(readId(ctx)).rejects.toThrow(HttpError);
  });

  it("throws badRequest for float id", async () => {
    const ctx = { params: Promise.resolve({ id: "3.14" }) };
    await expect(readId(ctx)).rejects.toThrow(HttpError);
  });
});

describe("canEdit", () => {
  const record = { person_id: 2, car_id: 10 };
  const carOwner = 5;

  it("allows admin regardless of person_id", () => {
    expect(canEdit(99, true, record, carOwner)).toBe(true);
  });
  it("allows admin even when car has no owner", () => {
    expect(canEdit(99, true, record, null)).toBe(true);
  });
  it("allows the creator of the record", () => {
    expect(canEdit(2, false, record, carOwner)).toBe(true);
  });
  it("allows the car owner", () => {
    expect(canEdit(5, false, record, carOwner)).toBe(true);
  });
  it("rejects a third party", () => {
    expect(canEdit(99, false, record, carOwner)).toBe(false);
  });
  it("rejects third party when car has no owner", () => {
    expect(canEdit(99, false, record, null)).toBe(false);
  });
  it("still allows creator when car has no owner", () => {
    expect(canEdit(2, false, record, null)).toBe(true);
  });
});
