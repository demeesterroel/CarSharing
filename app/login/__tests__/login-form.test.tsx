// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("does not offer the inline reset affordance when mail is disabled", () => {
    render(<LoginForm mailEnabled={false} />);
    // The inline reset toggle should not appear; only the link to /forgot remains.
    expect(screen.queryByRole("button", { name: "auth.forgot_password" })).toBeNull();
    // The fallback link to /forgot is shown instead.
    expect(screen.getByRole("link", { name: "auth.forgot_password" })).toBeInTheDocument();
  });

  it("shows the inline reset toggle when mail is enabled", () => {
    render(<LoginForm mailEnabled={true} />);
    // Inline button (not a link) is shown.
    expect(screen.getByRole("button", { name: "auth.forgot_password" })).toBeInTheDocument();
    // The /forgot link is NOT shown.
    expect(screen.queryByRole("link", { name: "auth.forgot_password" })).toBeNull();
  });

  it("reveals email field and send-reset-link button when switching to reset mode", () => {
    render(<LoginForm mailEnabled={true} />);

    const toggle = screen.getByRole("button", { name: "auth.forgot_password" });
    fireEvent.click(toggle);

    // Reset mode shows an email input labelled auth.email.
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    // And the send reset link button.
    expect(screen.getByRole("button", { name: "auth.send_reset_link" })).toBeInTheDocument();
    // The "use password instead" back button is present.
    expect(screen.getByRole("button", { name: "auth.use_password" })).toBeInTheDocument();
  });

  it("calls fetch to /api/auth/forgot when submitting reset email", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    render(<LoginForm mailEnabled={true} />);

    // Switch to reset mode.
    fireEvent.click(screen.getByRole("button", { name: "auth.forgot_password" }));

    // Fill in email.
    const emailInput = screen.getByLabelText("auth.email");
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });

    // Submit.
    fireEvent.click(screen.getByRole("button", { name: "auth.send_reset_link" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/forgot",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "user@example.com" }),
        })
      );
    });

    // Confirmation message is shown.
    expect(screen.getByRole("status")).toHaveTextContent("auth.forgot_sent");

    fetchSpy.mockRestore();
  });
});
