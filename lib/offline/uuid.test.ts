import { describe, expect, it } from "vitest";
import { newUuid } from "./uuid";

describe("newUuid", () => {
  it("returns RFC4122 v4 shape", () => {
    expect(newUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
  it("yields unique values across N calls", () => {
    const set = new Set(Array.from({ length: 1000 }, newUuid));
    expect(set.size).toBe(1000);
  });
});
