import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "../form-utils";

describe("parseDecimalInput", () => {
  it("parses a period decimal", () => {
    expect(parseDecimalInput("48.5")).toBe(48.5);
  });

  it("parses a comma decimal (Belgian iOS input)", () => {
    expect(parseDecimalInput("48,5")).toBe(48.5);
  });

  it("parses an integer string", () => {
    expect(parseDecimalInput("50")).toBe(50);
  });

  it("returns NaN for empty string", () => {
    expect(parseDecimalInput("")).toBeNaN();
  });

  it("returns NaN for non-numeric string", () => {
    expect(parseDecimalInput("abc")).toBeNaN();
  });

  it("parses a number passthrough", () => {
    expect(parseDecimalInput(48.5 as unknown as string)).toBe(48.5);
  });

  it("handles price per liter format: 1,789", () => {
    expect(parseDecimalInput("1,789")).toBe(1.789);
  });

  it("is positive for comma decimal — canSubmit check passes", () => {
    expect(parseDecimalInput("211,2") > 0).toBe(true);
    expect(parseDecimalInput("10,32") > 0).toBe(true);
  });
});
