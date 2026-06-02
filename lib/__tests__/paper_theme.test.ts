// lib/__tests__/paper_theme.test.ts
import { describe, it, expect } from "vitest";
import {
  fmtMoney,
  fmtMoneyOut,
  fmtKm,
  fmtDate,
  fmtYearMonth,
  paper,
  fontMono,
  fontSerif,
  amtColor,
  signPrefix,
} from "../paper-theme";

describe("paper CSS variable refs", () => {
  it("paper.ink is a CSS var reference, not a hex", () => {
    expect(paper.ink).toBe("var(--ink)");
  });

  it("paper.paper references --paper", () => {
    expect(paper.paper).toBe("var(--paper)");
  });

  it("fontMono references --font-mono CSS variable", () => {
    expect(fontMono).toBe("var(--font-mono)");
  });

  it("fontSerif references --font-serif CSS variable", () => {
    expect(fontSerif).toBe("var(--font-serif)");
  });
});

describe("fmtMoney", () => {
  it("formats a positive euro amount", () => {
    // nl-BE: 1234.56 → "€ 1.234,56"
    const result = fmtMoney(1234.56);
    expect(result).toContain("€");
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("formats zero as two decimal places", () => {
    expect(fmtMoney(0)).toContain("0,00");
  });

  it("uses absolute value (no minus sign)", () => {
    const pos = fmtMoney(50);
    const neg = fmtMoney(-50);
    expect(pos).toBe(neg);
  });
});

describe("fmtMoneyOut", () => {
  it("prepends a minus sign (U+2212) to a positive cost", () => {
    const result = fmtMoneyOut(1788.24);
    expect(result.startsWith("− ")).toBe(true);
    expect(result).toContain("€");
    expect(result).toContain("1.788,24");
  });

  it("never double-negates: a negative input still yields a single leading minus", () => {
    expect(fmtMoneyOut(50)).toBe(fmtMoneyOut(-50));
  });

  it("renders zero as a negative-prefixed amount", () => {
    expect(fmtMoneyOut(0).startsWith("− ")).toBe(true);
    expect(fmtMoneyOut(0)).toContain("0,00");
  });
});

describe("fmtKm", () => {
  it("appends km unit", () => {
    expect(fmtKm(100)).toContain("km");
  });

  it("formats zero km", () => {
    expect(fmtKm(0)).toContain("0");
  });

  it("formats large values with thousands separator", () => {
    const result = fmtKm(12000);
    expect(result).toContain("12");
    expect(result).toContain("km");
  });
});

describe("fmtDate", () => {
  it("formats a date in Dutch (default)", () => {
    const result = fmtDate("2026-06-01");
    // June 1 2026 is a Monday → 'ma' in nl
    expect(result).toContain("ma");
    expect(result).toContain("jun");
    expect(result).toContain("1");
  });

  it("formats a date in English", () => {
    const result = fmtDate("2026-06-01", "en");
    expect(result).toContain("Mon");
    expect(result).toContain("Jun");
  });

  it("handles different months", () => {
    const jan = fmtDate("2026-01-15", "nl");
    expect(jan).toContain("jan");
    const dec = fmtDate("2026-12-25", "nl");
    expect(dec).toContain("dec");
  });
});

describe("fmtYearMonth", () => {
  it("formats year-month in Dutch", () => {
    const result = fmtYearMonth("2026-03", "nl");
    expect(result).toContain("mrt");
    expect(result).toContain("2026");
  });

  it("formats year-month in English", () => {
    const result = fmtYearMonth("2026-03", "en");
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
  });

  it("uses Dutch as default locale", () => {
    const result = fmtYearMonth("2026-05");
    expect(result).toContain("mei");
  });
});

describe("amtColor", () => {
  it("returns green for positive amounts", () => {
    expect(amtColor(10)).toBe(paper.green);
    expect(amtColor(0.01)).toBe(paper.green);
  });

  it("returns accent (red) for negative amounts", () => {
    expect(amtColor(-10)).toBe(paper.accent);
    expect(amtColor(-0.01)).toBe(paper.accent);
  });

  it("returns inkMute for zero", () => {
    expect(amtColor(0)).toBe(paper.inkMute);
  });
});

describe("signPrefix", () => {
  it("returns + for positive amounts", () => {
    expect(signPrefix(10)).toBe("+");
  });

  it("returns − (U+2212) for negative amounts", () => {
    expect(signPrefix(-10)).toBe("−");
  });

  it("returns empty string for zero", () => {
    expect(signPrefix(0)).toBe("");
  });
});
