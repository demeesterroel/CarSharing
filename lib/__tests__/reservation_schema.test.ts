// lib/__tests__/reservation_schema.test.ts
import { describe, expect, it } from "vitest";
import { reservationSchema } from "../schemas/reservation";

const base = { person_id: 1, car_id: 1, start_date: "2026-09-01", end_date: "2026-09-01" };

describe("reservationSchema — optional times (#191)", () => {
  it("accepts an all-day reservation (no times → null)", () => {
    const r = reservationSchema.safeParse({ ...base, end_date: "2026-09-03" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.start_time).toBeNull();
      expect(r.data.end_time).toBeNull();
    }
  });

  it("accepts a valid single-day timed reservation", () => {
    const r = reservationSchema.safeParse({ ...base, start_time: "09:00", end_time: "12:30" });
    expect(r.success).toBe(true);
  });

  it("rejects only one time set", () => {
    expect(reservationSchema.safeParse({ ...base, start_time: "09:00" }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...base, end_time: "12:00" }).success).toBe(false);
  });

  it("accepts a multi-day timed reservation (start_time on start, end_time on end)", () => {
    const r = reservationSchema.safeParse({
      ...base,
      end_date: "2026-09-03",
      start_time: "18:00",
      end_time: "09:00", // earlier clock time, but two days later → valid
    });
    expect(r.success).toBe(true);
  });

  it("rejects end_time on or before start_time on a single day", () => {
    expect(
      reservationSchema.safeParse({ ...base, start_time: "12:00", end_time: "12:00" }).success
    ).toBe(false);
    expect(
      reservationSchema.safeParse({ ...base, start_time: "12:00", end_time: "09:00" }).success
    ).toBe(false);
  });

  it("rejects a malformed time", () => {
    expect(
      reservationSchema.safeParse({ ...base, start_time: "9am", end_time: "12:00" }).success
    ).toBe(false);
    expect(
      reservationSchema.safeParse({ ...base, start_time: "25:00", end_time: "26:00" }).success
    ).toBe(false);
  });
});
