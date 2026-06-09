// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupedList } from "../grouped-list";

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let observerCallback: IOCallback | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  observerCallback = null;
  mockObserve.mockClear();
  mockDisconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IOCallback) {
        observerCallback = cb;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeItems(months: string[]) {
  return months.flatMap((month) => [
    { id: `${month}-a`, month },
    { id: `${month}-b`, month },
  ]);
}

const props = {
  getKey: (item: { month: string }) => item.month,
  getGroupLabel: (key: string) => key,
  getGroupTotal: () => 0,
  totalSuffix: "km" as const,
  renderItem: (item: { id: string }) => <div data-testid={item.id}>{item.id}</div>,
};

describe("GroupedList lazy rendering", () => {
  it("renders only the first 3 month groups initially", () => {
    const months = ["2026-05", "2026-04", "2026-03", "2026-02", "2026-01"];
    render(<GroupedList items={makeItems(months)} {...props} />);
    expect(screen.getByText("2026-05")).toBeInTheDocument();
    expect(screen.getByText("2026-04")).toBeInTheDocument();
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    expect(screen.queryByText("2026-02")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-01")).not.toBeInTheDocument();
  });

  it("renders all groups when total ≤ 3", () => {
    const months = ["2026-05", "2026-04"];
    render(<GroupedList items={makeItems(months)} {...props} />);
    expect(screen.getByText("2026-05")).toBeInTheDocument();
    expect(screen.getByText("2026-04")).toBeInTheDocument();
  });

  it("does not render sentinel when all groups are visible", () => {
    const months = ["2026-05", "2026-04"];
    const { container } = render(<GroupedList items={makeItems(months)} {...props} />);
    expect(container.querySelector('[style*="height: 1px"]')).not.toBeInTheDocument();
  });

  it("renders sentinel when more groups exist", () => {
    const months = ["2026-05", "2026-04", "2026-03", "2026-02"];
    const { container } = render(<GroupedList items={makeItems(months)} {...props} />);
    expect(container.querySelector('[style*="height: 1px"]')).toBeInTheDocument();
  });

  it("reveals next 3 groups when sentinel intersects", () => {
    const months = ["2026-07", "2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"];
    render(<GroupedList items={makeItems(months)} {...props} />);
    expect(screen.queryByText("2026-04")).not.toBeInTheDocument();
    act(() => {
      observerCallback!([{ isIntersecting: true }]);
    });
    expect(screen.getByText("2026-04")).toBeInTheDocument();
    expect(screen.queryByText("2026-01")).not.toBeInTheDocument();
  });

  it("resets to 3 visible groups when items prop changes", () => {
    const months = ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"];
    const { rerender } = render(<GroupedList items={makeItems(months)} {...props} />);
    act(() => {
      observerCallback!([{ isIntersecting: true }]);
    });
    expect(screen.getByText("2026-03")).toBeInTheDocument();
    const filtered = ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02"];
    rerender(<GroupedList items={makeItems(filtered)} {...props} />);
    expect(screen.getByText("2026-06")).toBeInTheDocument();
    expect(screen.queryByText("2026-03")).not.toBeInTheDocument();
  });

  it("disconnects observer on unmount", () => {
    const months = ["2026-05", "2026-04", "2026-03", "2026-02"];
    const { unmount } = render(<GroupedList items={makeItems(months)} {...props} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
