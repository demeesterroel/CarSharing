// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemberForm } from "../member-form";

// The form pulls strings from the static `t` (used in its zod schema at module
// load and in its labels), so mock it to echo the key for stable assertions.
vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }));

describe("MemberForm", () => {
  it("blocks submit and shows an error when first name is empty", async () => {
    const onSubmit = vi.fn();
    render(<MemberForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "action.save" }));

    // Validation message surfaces and onSubmit is never called.
    expect(await screen.findByText("validation.name_required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits coerced values when the form is valid", async () => {
    const onSubmit = vi.fn();
    render(<MemberForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("form.first_name"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("form.last_name"), { target: { value: "Owner" } });
    fireEvent.change(screen.getByLabelText("form.discount"), { target: { value: "0.15" } });
    fireEvent.change(screen.getByLabelText("form.discount_long"), { target: { value: "0.25" } });

    fireEvent.click(screen.getByRole("button", { name: "action.save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    // discount/discount_long are coerced to numbers; active defaults to 1.
    expect(onSubmit.mock.calls[0][0]).toEqual({
      first_name: "Alice",
      last_name: "Owner",
      discount: 0.15,
      discount_long: 0.25,
      active: 1,
    });
  });

  it("disables the submit button while a create is pending", () => {
    render(<MemberForm onSubmit={vi.fn()} onCancel={vi.fn()} isPending />);

    expect(screen.getByRole("button", { name: "…" })).toBeDisabled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<MemberForm onSubmit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "action.cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
