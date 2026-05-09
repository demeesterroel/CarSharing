import { describe, it, expect } from "vitest";
import { addDays } from "../google-calendar";

describe("addDays", () => {
  it("adds 1 day to a date string", () => {
    expect(addDays("2026-06-10", 1)).toBe("2026-06-11");
  });

  it("handles month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });

  it("handles year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap year", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
