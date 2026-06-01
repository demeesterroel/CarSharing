// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginForm from "../login-form";

// useT returns the key itself so we can assert on stable identifiers.
vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("@/components/lang-switcher", () => ({ LangSwitcher: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

describe("LoginForm", () => {
  it("does not offer the magic-link option when mail is disabled", () => {
    render(<LoginForm mailEnabled={false} />);
    expect(screen.queryByText("auth.use_magic_link")).toBeNull();
    // Password login is still present.
    expect(screen.getByLabelText("form.name")).toBeInTheDocument();
  });

  it("reveals an email field and the send-link button when switching to magic mode", () => {
    render(<LoginForm mailEnabled={true} />);

    // Toggle is offered.
    const toggle = screen.getByText("auth.use_magic_link");
    fireEvent.click(toggle);

    // Magic mode shows an email input and the send button.
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "auth.send_magic_link" })).toBeInTheDocument();
  });
});
