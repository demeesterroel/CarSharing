// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReceiptUpload } from "../receipt-upload";

vi.mock("@/lib/i18n", () => ({ t: (k: string) => k }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrf-token=test-csrf";
});

describe("ReceiptUpload", () => {
  // Regression for the invalid_csrf on receipt upload: the POST to /api/uploads
  // (which is CSRF-guarded) must include the x-csrf-token header.
  it("includes the x-csrf-token header when uploading to /api/uploads", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ path: "/uploads/x.png" }), { status: 201 }));

    render(<ReceiptUpload value={null} onChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "r.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/uploads");
    expect((init!.headers as Record<string, string>)["x-csrf-token"]).toBe("test-csrf");
  });
});
