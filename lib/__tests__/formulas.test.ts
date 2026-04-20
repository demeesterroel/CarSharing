import { describe, it, expect } from "vitest";
import { calcTripAmount, calcPricePerLiter, calcPaymentYear } from "../formulas";

describe("calcTripAmount", () => {
  it("charges full price when person has no discount", () => {
    // Roeland, LEW price_per_km=0.25, discount=0, discount_long=0, km=8029
    expect(calcTripAmount(8029, 0.25, 0, 0)).toBeCloseTo(2007.25);
  });

  it("applies short-trip discount for first 500km, long discount beyond", () => {
    // Tinne, JF price_per_km=0.20, discount=0.25, discount_long=0.50, km=2299
    // 500 * 0.20 * (1-0.25) + 1799 * 0.20 * (1-0.50) = 75 + 179.90 = 254.90
    expect(calcTripAmount(2299, 0.20, 0.25, 0.50)).toBeCloseTo(254.90);
  });

  it("applies only short-trip rate for trips <= 500km", () => {
    // 100km, price_per_km=0.20, discount=0.25
    // 100 * 0.20 * (1-0.25) = 15.00
    expect(calcTripAmount(100, 0.20, 0.25, 0.50)).toBeCloseTo(15.00);
  });

  it("handles exactly 500km", () => {
    // 500 * 0.20 * (1-0.25) = 75.00
    expect(calcTripAmount(500, 0.20, 0.25, 0.50)).toBeCloseTo(75.00);
  });
});

describe("calcPricePerLiter", () => {
  it("divides amount by liters", () => {
    expect(calcPricePerLiter(50, 22.8)).toBeCloseTo(2.19, 2);
  });

  it("returns 0 when liters is 0", () => {
    expect(calcPricePerLiter(50, 0)).toBe(0);
  });
});

describe("calcPaymentYear", () => {
  it("returns year minus 1", () => {
    expect(calcPaymentYear("2026-01-08")).toBe(2025);
    expect(calcPaymentYear("2019-01-04")).toBe(2018);
  });
});
