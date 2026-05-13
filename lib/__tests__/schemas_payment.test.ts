import { describe, it, expect } from "vitest";
import { paymentSchema } from "../schemas/payment";

describe("paymentSchema", () => {
  const valid = { person_id: 1, date: "2026-03-01", amount: 50, note: null };

  it("accepts positive amount", () => {
    expect(paymentSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts negative amount (refund/payout)", () => {
    expect(paymentSchema.safeParse({ ...valid, amount: -8.55 }).success).toBe(true);
  });

  it("rejects zero amount", () => {
    expect(paymentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
  });

  it("rejects missing amount", () => {
    const { amount: _, ...rest } = valid;
    expect(paymentSchema.safeParse(rest).success).toBe(false);
  });
});
