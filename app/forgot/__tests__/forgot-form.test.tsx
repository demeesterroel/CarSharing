// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ForgotForm from "../forgot-form";

// useT returns the key itself so we can assert on stable identifiers.
vi.mock("@/components/locale-provider", () => ({
  useT: () => (key: string) => key,
}));

// The form calls router.push for the "back to login" button; stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ForgotForm", () => {
  it("shows the unavailable notice and disables the form when mail is off", () => {
    render(<ForgotForm mailEnabled={false} />);

    // Notice is rendered.
    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("auth.forgot_unavailable");

    // Both submit buttons and the email field are disabled.
    expect(screen.getByRole("button", { name: "auth.send_reset_link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "auth.send_magic_link" })).toBeDisabled();
    expect(screen.getByLabelText("auth.email")).toBeDisabled();
  });

  it("hides the notice and enables the email field when mail is on", () => {
    render(<ForgotForm mailEnabled={true} />);

    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByLabelText("auth.email")).toBeEnabled();
  });
});
