import { describe, it, expect } from "vitest";
import { beMetrics } from "@/app/admin/_shared";
import type { CarPnL } from "@/lib/queries/admin";

function makeCar(overrides: Partial<CarPnL> = {}): CarPnL {
  return {
    car_id: 1,
    car_short: "ETH",
    car_name: "Ethel",
    car_price_per_km: 0.23,
    owner_name: "Malvina",
    long_threshold: 500,
    fixed_costs: [{ id: "1", category: "verzekeringen", description: "ins", amount: 2640 }],
    expected_km: null,
    trip_count: 100,
    trip_km: 6800,
    trip_revenue: 6800 * 0.23,
    owner_trip_amount: 0,
    fuel_count: 20,
    fuel_amount: 816, // 6800 km * €0.12
    expense_count: 5,
    expense_amount: 0,
    fixed_total: 2640,
    variable_total: 816,
    total_cost: 816 + 2640,
    net_to_owner: 6800 * 0.23 - (816 + 2640),
    cost_per_km: (816 + 2640) / 6800,
    prev_year_trip_km: 5940,
    ...overrides,
  };
}

describe("beMetrics", () => {
  it("computes variable cost per km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // variable_total = 816, trip_km = 6800 → 816/6800 ≈ 0.12
    expect(m.variablePerKm).toBeCloseTo(0.12, 2);
  });

  it("computes contribution per km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 0.23 − 0.12 = 0.11
    expect(m.contribPerKm).toBeCloseTo(0.11, 2);
  });

  it("computes fixed cost recovery correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // trip_revenue - variable_total = 6800*0.23 - 816 = 1564 - 816 = 748
    expect(m.fixedCovered).toBeCloseTo(748, 0);
  });

  it("computes remaining burden correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 2640 - 748 = 1892
    expect(m.remainingBurden).toBeCloseTo(1892, 0);
  });

  it("computes break-even km correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 2640 / 0.11 ≈ 24000
    expect(m.breakEvenKm).toBeCloseTo(24000, -2);
  });

  it("computes km gap correctly", () => {
    const car = makeCar();
    const m = beMetrics(car);
    // 24000 - 6800 ≈ 17200
    expect(m.kmGap).toBeCloseTo(17200, -2);
  });

  it("status is 'behind' when pctProjected < 0.85", () => {
    const car = makeCar();
    const m = beMetrics(car);
    expect(m.status).toBe("behind");
  });

  it("status is 'ahead' when fixedCovered >= fixed_total", () => {
    // Simulate a car that has fully covered its fixed costs
    const car = makeCar({
      trip_km: 30000,
      trip_revenue: 30000 * 0.23,
      variable_total: 30000 * 0.12,
      fuel_amount: 30000 * 0.12,
      expense_amount: 0,
    });
    const m = beMetrics(car);
    expect(m.status).toBe("ahead");
    expect(m.remainingBurden).toBe(0);
  });

  it("handles zero fixed costs gracefully", () => {
    const car = makeCar({ fixed_total: 0, fixed_costs: [] });
    const m = beMetrics(car);
    expect(m.remainingBurden).toBe(0);
    expect(m.pctCovered).toBe(1);
    // breakEvenKm = fixed_total / contribPerKm = 0 / anything = 0 (already at break-even)
    expect(m.breakEvenKm).toBe(0);
  });

  it("handles zero trip_km gracefully (no division by zero)", () => {
    const car = makeCar({ trip_km: 0, trip_revenue: 0, variable_total: 0, fuel_amount: 0 });
    const m = beMetrics(car);
    expect(m.variablePerKm).toBe(0);
  });
});
