// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OfflineBadge } from "../offline-badge";
import type { OnlineState } from "@/lib/offline/online-state";

// Mock both dependencies
vi.mock("@/lib/offline/online-state", () => ({
  useOnlineState: vi.fn(),
}));

vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string, params?: Record<string, string | number>) => {
    const messages: Record<string, string> = {
      "offline.label": "OFFLINE",
      "offline.stale_suffix": "ouder dan 1u",
      "offline.tooltip_fresh": "Je bent offline. Gegevens zijn recent gesynchroniseerd.",
      "offline.tooltip_stale": "Je bent offline en de gegevens zijn ouder dan een uur.",
      "offline.queued_suffix": "{count} wachten",
      "offline.tooltip_syncing": "Synchroniseren…",
    };
    const template = messages[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`
    );
  },
}));

import { useOnlineState } from "@/lib/offline/online-state";
const mockUseOnlineState = useOnlineState as ReturnType<typeof vi.fn>;

function makeState(overrides: Partial<OnlineState>): OnlineState {
  return {
    online: true,
    lastSyncAt: null,
    staleness: "fresh",
    pendingCount: 0,
    markSynced: vi.fn(),
    setPendingCount: vi.fn(),
    ...overrides,
  };
}

describe("OfflineBadge", () => {
  describe("when online with no pending items", () => {
    it("renders nothing", () => {
      mockUseOnlineState.mockReturnValue(makeState({ online: true, pendingCount: 0 }));
      const { container } = render(<OfflineBadge />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("when online with pending items (syncing)", () => {
    beforeEach(() => {
      mockUseOnlineState.mockReturnValue(makeState({ online: true, pendingCount: 3 }));
    });

    it("renders a status badge", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("shows SYNC label and pending count", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toHaveTextContent("SYNC · 3");
    });

    it("has aria-live polite", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });

    it("has the syncing tooltip", () => {
      render(<OfflineBadge />);
      expect(screen.getByTitle("Synchroniseren…")).toBeInTheDocument();
    });
  });

  describe("when offline with fresh data and no pending items", () => {
    beforeEach(() => {
      mockUseOnlineState.mockReturnValue(
        makeState({ online: false, staleness: "fresh", pendingCount: 0 })
      );
    });

    it("renders a status badge", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("shows OFFLINE label", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toHaveTextContent("OFFLINE");
    });

    it("has the fresh offline tooltip", () => {
      render(<OfflineBadge />);
      expect(
        screen.getByTitle("Je bent offline. Gegevens zijn recent gesynchroniseerd.")
      ).toBeInTheDocument();
    });
  });

  describe("when offline with stale data", () => {
    beforeEach(() => {
      mockUseOnlineState.mockReturnValue(
        makeState({ online: false, staleness: "stale", pendingCount: 0 })
      );
    });

    it("shows OFFLINE label with stale suffix", () => {
      render(<OfflineBadge />);
      expect(screen.getByRole("status")).toHaveTextContent("OFFLINE");
      expect(screen.getByRole("status")).toHaveTextContent("ouder dan 1u");
    });

    it("has the stale offline tooltip", () => {
      render(<OfflineBadge />);
      expect(
        screen.getByTitle("Je bent offline en de gegevens zijn ouder dan een uur.")
      ).toBeInTheDocument();
    });
  });

  describe("when offline with pending items", () => {
    beforeEach(() => {
      mockUseOnlineState.mockReturnValue(
        makeState({ online: false, staleness: "fresh", pendingCount: 2 })
      );
    });

    it("shows OFFLINE label with queued suffix", () => {
      render(<OfflineBadge />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveTextContent("OFFLINE");
      expect(badge).toHaveTextContent("2 wachten");
    });
  });
});
