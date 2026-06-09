import { describe, expect, it } from "vitest";
import { markCalendarNudgeSeen, shouldShowCalendarNudge } from "../calendar-nudge";

function makeStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> {
  const store = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

describe("shouldShowCalendarNudge", () => {
  it("returns true when the flag is absent", () => {
    const storage = makeStorage();
    expect(shouldShowCalendarNudge(storage)).toBe(true);
  });

  it("returns false when the flag is set to '1'", () => {
    const storage = makeStorage({ "cs.calendarNudgeSeen": "1" });
    expect(shouldShowCalendarNudge(storage)).toBe(false);
  });

  it("returns false when the flag is set to any truthy string", () => {
    const storage = makeStorage({ "cs.calendarNudgeSeen": "true" });
    expect(shouldShowCalendarNudge(storage)).toBe(false);
  });
});

describe("markCalendarNudgeSeen", () => {
  it("sets the flag so subsequent shouldShowCalendarNudge returns false", () => {
    const storage = makeStorage();
    expect(shouldShowCalendarNudge(storage)).toBe(true);
    markCalendarNudgeSeen(storage);
    expect(shouldShowCalendarNudge(storage)).toBe(false);
  });

  it("writes '1' to the correct localStorage key", () => {
    const written: Record<string, string> = {};
    const storage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: () => null,
      setItem: (key, value) => {
        written[key] = value;
      },
    };
    markCalendarNudgeSeen(storage);
    expect(written["cs.calendarNudgeSeen"]).toBe("1");
  });
});
