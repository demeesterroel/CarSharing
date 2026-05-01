// lib/__tests__/uuid.test.ts
import { describe, it, expect } from "vitest";
import { newUuid } from "../offline/uuid";

describe("newUuid", () => {
  it("returns a string", () => {
    expect(typeof newUuid()).toBe("string");
  });

  it("returns a valid UUID v4 format (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)", () => {
    const uuid = newUuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns unique values on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newUuid()));
    expect(ids.size).toBe(100);
  });

  it("uses the fallback path when crypto.randomUUID is not available", () => {
    // Temporarily override randomUUID to undefined on the crypto object
    const originalRandomUUID = (globalThis as any).crypto?.randomUUID;
    Object.defineProperty((globalThis as any).crypto, "randomUUID", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const uuid = newUuid();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty((globalThis as any).crypto, "randomUUID", {
        value: originalRandomUUID,
        configurable: true,
        writable: true,
      });
    }
  });
});
