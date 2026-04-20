import { describe, it, expect } from "vitest";
import { t } from "@/lib/i18n";

describe("t()", () => {
  it("returns the Dutch value for a known key", () => {
    expect(t("action.save")).toBe("Opslaan");
  });

  it("returns the value unchanged when no params are passed", () => {
    expect(t("balance.settled")).toBe("vereffend");
  });

  it("substitutes {param} placeholders", () => {
    expect(t("balance.credit", { amount: "12.34" })).toBe("Je krijgt €12.34");
    expect(t("balance.debt", { amount: "5.00" })).toBe("Je bent €5.00 verschuldigd");
  });

  it("accepts numeric params and stringifies them", () => {
    expect(t("balance.credit", { amount: 7 })).toBe("Je krijgt €7");
  });

  it("leaves unknown placeholders visible when the param is missing", () => {
    expect(t("balance.credit")).toBe("Je krijgt €{amount}");
    expect(t("balance.credit", {})).toBe("Je krijgt €{amount}");
  });
});
