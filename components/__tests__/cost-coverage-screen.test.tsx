// @vitest-environment jsdom
import type { CarPnL } from "@/lib/queries/admin";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// --- module mocks ---

// Translate keys to the human labels we assert on; unknown keys fall through.
vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string, vars?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      "breakeven.revenue": "Trip revenue",
      "breakeven.expenses": "Variable costs",
      "breakeven.net": "Net",
      "coverage.title": "Cost coverage",
      "coverage.projection.title": "Projection",
      "coverage.projection.others_contribution": "Others' contribution",
      "coverage.projection.expenses": "Costs to cover",
      "coverage.projection.owner_fuel": "Own fuel",
      "coverage.projection.net": "Owner net",
      "coverage.zone.dark_green": "Fuel also covered",
      "coverage.zone.light_green": "Costs covered",
      "coverage.zone.orange": "Costs not covered",
      "coverage.zone.red": "Loss per trip",
      "coverage.ytd": "This year",
      "coverage.exact": "exact",
      "coverage.default_current": "current",
      "coverage.slider.fuel_per_km": "Fuel / km",
      "coverage.slider.total_km": "Total km / year",
      "coverage.slider.pct_others": "% others",
      "coverage.slider.expenses": "Expected costs",
      "coverage.slider.price": "Price / km",
      "coverage.save": "Save price",
      "action.collapse": "Collapse",
      "action.expand": "Expand",
      "stats.trips": "trips",
      "stats.trips_short": "tr.",
      "stats.fillups": "fill-ups",
      "stats.fillups_short": "fu.",
      "stats.expenses": "expenses",
      "stats.expenses_short": "ex.",
      "stats.others": "Others",
      "stats.own": "Own",
    };
    void vars;
    return messages[key] ?? key;
  },
}));

vi.mock("@/hooks/use-vehicles", () => ({
  useUpdateCar: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CostCoverageScreen } from "../cost-coverage-screen";

// --- fixture ---

const HISTORIC_YEAR = new Date().getFullYear() - 1;

function makeCar(overrides: Partial<CarPnL> = {}): CarPnL {
  return {
    car_id: 1,
    car_short: "JF",
    car_name: "Car JF",
    car_price_per_km: 0.35,
    owner_name: "Owner A",
    long_threshold: 100,
    expected_km: 14000,
    trip_count: 40,
    trip_km: 12000,
    trip_revenue: 4200,
    owner_trip_count: 10,
    owner_trip_km: 3000,
    owner_trip_amount: 1050,
    fuel_count: 20,
    fuel_amount: 1500,
    fuel_liters: 900,
    owner_fuel_count: 5,
    owner_fuel_amount: 400,
    owner_fuel_liters: 240,
    expense_count: 6,
    expense_amount: 288.24,
    owner_expense_count: 1,
    owner_expense_amount: 50,
    variable_total: 1788.24,
    net: 2411.76,
    cost_per_km: 0.149,
    prev_year_trip_km: 11000,
    ...overrides,
  };
}

function renderScreen(carOverrides: Partial<CarPnL> = {}) {
  // Use a historic year so all slider values are derived from exact actuals
  // (no async data needed) and the layout is deterministic.
  return render(
    <CostCoverageScreen
      car={makeCar(carOverrides)}
      fullCar={undefined}
      historicalKm={[]}
      ownerSplit={[]}
      historicalExpenses={[]}
      priceHistory={[]}
      rollingFuelPerKm={0}
      year={HISTORIC_YEAR}
    />
  );
}

describe("CostCoverageScreen — collapse toggle", () => {
  it("defaults to expanded: shows the trips/fill-ups/expenses breakdown", () => {
    renderScreen();
    expect(screen.getByText("Car JF")).toBeInTheDocument();
    // breakdown sub-rows only render when expanded
    expect(screen.getAllByText("Others").length).toBeGreaterThan(0);
    expect(screen.getByText("Trip revenue")).toBeInTheDocument();
  });

  it("collapsing hides the breakdown but keeps car name, year and NET visible", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Collapse" }));

    // breakdown + revenue line are hidden
    expect(screen.queryByText("Others")).not.toBeInTheDocument();
    expect(screen.queryByText("Trip revenue")).not.toBeInTheDocument();
    // car name, year and NET stay
    expect(screen.getByText("Car JF")).toBeInTheDocument();
    expect(screen.getByText(String(HISTORIC_YEAR))).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
  });

  it("toggles back to expanded on a second click", async () => {
    const user = userEvent.setup();
    renderScreen();
    const toggle = screen.getByRole("button", { name: "Collapse" });

    await user.click(toggle); // collapse
    expect(screen.queryByText("Trip revenue")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand" })); // expand
    expect(screen.getByText("Trip revenue")).toBeInTheDocument();
  });
});

describe("CostCoverageScreen — controlled collapse (survives year switch)", () => {
  it("reflects the expanded prop instead of internal state", () => {
    render(
      <CostCoverageScreen
        car={makeCar()}
        fullCar={undefined}
        historicalKm={[]}
        ownerSplit={[]}
        historicalExpenses={[]}
        priceHistory={[]}
        rollingFuelPerKm={0}
        year={HISTORIC_YEAR}
        expanded={false}
        onToggleExpanded={() => {}}
      />
    );
    // expanded=false → breakdown hidden, NET still shown
    expect(screen.queryByText("Trip revenue")).not.toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
  });

  it("calls onToggleExpanded (not internal state) when controlled", async () => {
    const user = userEvent.setup();
    const onToggleExpanded = vi.fn();
    render(
      <CostCoverageScreen
        car={makeCar()}
        fullCar={undefined}
        historicalKm={[]}
        ownerSplit={[]}
        historicalExpenses={[]}
        priceHistory={[]}
        rollingFuelPerKm={0}
        year={HISTORIC_YEAR}
        expanded={true}
        onToggleExpanded={onToggleExpanded}
      />
    );
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    // stays expanded because the parent owns the state (prop unchanged)
    expect(screen.getByText("Trip revenue")).toBeInTheDocument();
  });
});

describe("CostCoverageScreen — costs shown as negative red", () => {
  it("renders VARIABLE COSTS with a leading minus (U+2212)", () => {
    renderScreen();
    const label = screen.getByText("Variable costs");
    const value = label.parentElement?.querySelector("span:last-child");
    expect(value?.textContent?.startsWith("−")).toBe(true);
  });

  it("renders COSTS TO COVER and OWN FUEL with a leading minus (U+2212)", () => {
    renderScreen();
    for (const lbl of ["Costs to cover", "Own fuel"]) {
      const label = screen.getByText(lbl);
      const value = label.parentElement?.querySelector("span:last-child");
      expect(value?.textContent?.startsWith("−")).toBe(true);
    }
  });

  it("does NOT prepend a minus to the NET line (sign handled by NET itself)", () => {
    renderScreen();
    const net = screen.getByText("Net");
    const value = net.parentElement?.querySelector("span:last-child");
    expect(value?.textContent?.startsWith("−")).toBe(false);
  });
});
