// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PendingBadge } from "../pending-badge";

// Mock locale-provider: useT returns a simple identity-style translator
vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string) => {
    const messages: Record<string, string> = {
      "offline.pending": "Sync.",
      "offline.pending_tooltip": "Wordt gesynchroniseerd zodra je weer online bent.",
    };
    return messages[key] ?? key;
  },
}));

describe("PendingBadge", () => {
  it("renders without crashing", () => {
    render(<PendingBadge />);
  });

  it("displays the pending label text", () => {
    render(<PendingBadge />);
    expect(screen.getByText(/Sync\./i)).toBeInTheDocument();
  });

  it("has a title tooltip attribute", () => {
    render(<PendingBadge />);
    const badge = screen.getByTitle("Wordt gesynchroniseerd zodra je weer online bent.");
    expect(badge).toBeInTheDocument();
  });

  it("renders as an inline span", () => {
    render(<PendingBadge />);
    const badge = screen.getByTitle("Wordt gesynchroniseerd zodra je weer online bent.");
    expect(badge.tagName.toLowerCase()).toBe("span");
  });
});
