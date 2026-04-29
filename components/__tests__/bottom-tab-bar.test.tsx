// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BottomTabBar } from "../bottom-tab-bar";

// --- module mocks ---

vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string) => {
    const messages: Record<string, string> = {
      "nav.primary": "Hoofdnavigatie",
      "nav.dashboard": "Dashboard",
      "nav.trips": "Ritten",
      "nav.fuel": "Tanken",
      "nav.tab.reservations": "Reserv.",
      "nav.tab.expenses": "Kosten",
      "nav.admin": "Beheer",
    };
    return messages[key] ?? key;
  },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: () => ({ push: mockPush }),
}));

// Minimal Link stub — renders an <a> with href
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-me", () => ({
  useMe: vi.fn(() => ({ data: null })),
}));

import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/use-me";

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;
const mockUseMe = useMe as ReturnType<typeof vi.fn>;

describe("BottomTabBar", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUsePathname.mockReturnValue("/");
    mockUseMe.mockReturnValue({ data: null });
  });

  it("renders the nav element with accessible label", () => {
    render(<BottomTabBar />);
    expect(screen.getByRole("navigation", { name: "Hoofdnavigatie" })).toBeInTheDocument();
  });

  it("renders all 5 base tabs", () => {
    render(<BottomTabBar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Ritten")).toBeInTheDocument();
    expect(screen.getByText("Tanken")).toBeInTheDocument();
    expect(screen.getByText("Reserv.")).toBeInTheDocument();
    expect(screen.getByText("Kosten")).toBeInTheDocument();
  });

  it("marks the active tab with aria-current='page'", () => {
    mockUsePathname.mockReturnValue("/trips");
    render(<BottomTabBar />);
    const tripsLink = screen.getByRole("link", { name: /Ritten/i });
    expect(tripsLink).toHaveAttribute("aria-current", "page");
  });

  it("does not mark other tabs as active", () => {
    mockUsePathname.mockReturnValue("/trips");
    render(<BottomTabBar />);
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).not.toHaveAttribute("aria-current", "page");
  });

  it("marks / as active only on exact match", () => {
    mockUsePathname.mockReturnValue("/");
    render(<BottomTabBar />);
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("returns null on /login", () => {
    mockUsePathname.mockReturnValue("/login");
    const { container } = render(<BottomTabBar />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null on /invite/...", () => {
    mockUsePathname.mockReturnValue("/invite/abc123");
    const { container } = render(<BottomTabBar />);
    expect(container.firstChild).toBeNull();
  });

  it("shows admin tab for admins (not cloaked)", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: true, isOwner: false, isCloaked: false } });
    render(<BottomTabBar />);
    expect(screen.getByText("Beheer")).toBeInTheDocument();
  });

  it("shows admin tab for owners (not cloaked)", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: false, isOwner: true, isCloaked: false } });
    render(<BottomTabBar />);
    expect(screen.getByText("Beheer")).toBeInTheDocument();
  });

  it("hides admin tab when cloaked", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: true, isOwner: true, isCloaked: true } });
    render(<BottomTabBar />);
    expect(screen.queryByText("Beheer")).not.toBeInTheDocument();
  });

  it("hides admin tab for regular users", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: false, isOwner: false, isCloaked: false } });
    render(<BottomTabBar />);
    expect(screen.queryByText("Beheer")).not.toBeInTheDocument();
  });

  it("shows Exit Cloak button when cloaked", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: true, isOwner: false, isCloaked: true } });
    render(<BottomTabBar />);
    expect(screen.getByRole("button", { name: /Exit/i })).toBeInTheDocument();
  });

  it("does not show Exit Cloak button when not cloaked", () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: true, isOwner: false, isCloaked: false } });
    render(<BottomTabBar />);
    expect(screen.queryByRole("button", { name: /Exit/i })).not.toBeInTheDocument();
  });

  it("Exit Cloak button calls uncloak endpoint and redirects", async () => {
    mockUseMe.mockReturnValue({ data: { isAdmin: true, isOwner: false, isCloaked: true } });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<BottomTabBar />);
    const btn = screen.getByRole("button", { name: /Exit/i });
    await userEvent.click(btn);

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/uncloak", { method: "POST" });
    expect(mockPush).toHaveBeenCalledWith("/admin");
  });
});
