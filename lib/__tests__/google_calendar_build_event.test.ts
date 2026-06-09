// lib/__tests__/google_calendar_build_event.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    NODE_ENV: "test",
  },
}));

import { buildEventBody } from "@/lib/google-calendar";

const base = {
  start_date: "2026-06-01",
  end_date: "2026-06-03",
  car_short: "CA",
  person_name: "Alice",
  note: null,
};

type Body = {
  status: string;
  attendees: Array<{ email: string }>;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  summary: string;
  colorId?: string;
};

describe("buildEventBody attendee rule (#337)", () => {
  it("invites the owner as attendee while pending (tentative)", () => {
    const body = buildEventBody({ ...base, status: "pending" }, "n1", "bob@example.com") as Body;
    expect(body.status).toBe("tentative");
    expect(body.attendees).toEqual([{ email: "bob@example.com" }]);
  });

  it("drops the owner attendee once confirmed", () => {
    const body = buildEventBody({ ...base, status: "confirmed" }, "n1", "bob@example.com") as Body;
    expect(body.status).toBe("confirmed");
    expect(body.attendees).toEqual([]);
  });

  it("marks a confirmed event with a ✓ title prefix and green colorId (#344)", () => {
    const body = buildEventBody({ ...base, status: "confirmed" }, "n1", "bob@example.com") as Body;
    expect(body.summary).toBe("✓ [CA] Alice");
    expect(body.colorId).toBe("10");
  });

  it("leaves a pending event's title and color at default (#344)", () => {
    const body = buildEventBody({ ...base, status: "pending" }, "n1", "bob@example.com") as Body;
    expect(body.summary).toBe("[CA] Alice");
    expect(body.colorId).toBeUndefined();
  });

  it("marks a rejected reservation as a cancelled event (attendee moot)", () => {
    // Only the confirmed transition uninvites the owner; a rejected reservation
    // becomes a cancelled event, which leaves everyone's calendar regardless.
    const body = buildEventBody({ ...base, status: "rejected" }, "n1", "bob@example.com") as Body;
    expect(body.status).toBe("cancelled");
  });

  it("has no attendees when there is no owner email", () => {
    const body = buildEventBody({ ...base, status: "pending" }, "n1") as Body;
    expect(body.attendees).toEqual([]);
  });

  it("sets an exclusive end date (end_date + 1 day)", () => {
    const body = buildEventBody({ ...base, status: "pending" }, "n1") as Body;
    expect(body.end.date).toBe("2026-06-04");
  });
});

describe("buildEventBody timed events (#191)", () => {
  const timed = {
    start_date: "2026-06-01",
    end_date: "2026-06-01",
    start_time: "09:00",
    end_time: "12:30",
    car_short: "CA",
    person_name: "Alice",
    note: null,
  };

  it("emits a dateTime range with the Brussels time zone when timed", () => {
    const body = buildEventBody({ ...timed, status: "pending" }, "n1") as Body;
    expect(body.start.dateTime).toBe("2026-06-01T09:00:00");
    expect(body.start.timeZone).toBe("Europe/Brussels");
    expect(body.end.dateTime).toBe("2026-06-01T12:30:00");
    expect(body.end.timeZone).toBe("Europe/Brussels");
    expect(body.start.date).toBeUndefined();
    expect(body.end.date).toBeUndefined();
  });

  it("falls back to an all-day event when only one time is set", () => {
    const body = buildEventBody({ ...timed, end_time: null, status: "pending" }, "n1") as Body;
    expect(body.start.date).toBe("2026-06-01");
    expect(body.start.dateTime).toBeUndefined();
  });

  it("keeps the ✓ + green marker on a confirmed timed event", () => {
    const body = buildEventBody({ ...timed, status: "confirmed" }, "n1") as Body;
    expect(body.summary).toBe("✓ [CA] Alice");
    expect(body.colorId).toBe("10");
    expect(body.start.dateTime).toBe("2026-06-01T09:00:00");
  });

  it("spans multiple days: end dateTime uses end_date, not start_date (#191)", () => {
    const body = buildEventBody(
      { ...timed, end_date: "2026-06-03", status: "pending" },
      "n1"
    ) as Body;
    expect(body.start.dateTime).toBe("2026-06-01T09:00:00");
    expect(body.end.dateTime).toBe("2026-06-03T12:30:00");
  });
});
