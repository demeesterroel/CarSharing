import { describe, expect, it } from "vitest";
import { fullNameOf, shortNameOf } from "../person-utils";

describe("shortNameOf", () => {
  it("returns first_name when set", () => {
    expect(shortNameOf({ first_name: "Alice", last_name: "Smith", username: "alice" })).toBe(
      "Alice"
    );
  });
  it("returns capitalized username when first_name empty", () => {
    expect(shortNameOf({ first_name: "", last_name: "", username: "jan" })).toBe("Jan");
  });
  it("returns capitalized username when first_name null", () => {
    expect(shortNameOf({ first_name: null, last_name: "", username: "bob" })).toBe("Bob");
  });
  it("returns '?' when both first_name and username are empty", () => {
    expect(shortNameOf({ first_name: null, last_name: "", username: null })).toBe("?");
  });
  it("capitalizes only the first character of username", () => {
    expect(shortNameOf({ first_name: "", last_name: "", username: "alice_j" })).toBe("Alice_j");
  });
});

describe("fullNameOf", () => {
  it("returns shortName + LASTNAME when last_name present", () => {
    expect(fullNameOf({ first_name: "Alice", last_name: "Smith", username: null })).toBe(
      "Alice SMITH"
    );
  });
  it("returns just shortName when last_name empty", () => {
    expect(fullNameOf({ first_name: "Alice", last_name: "", username: null })).toBe("Alice");
  });
  it("uses capitalized username as short when first_name empty", () => {
    expect(fullNameOf({ first_name: "", last_name: "Doe", username: "jan" })).toBe("Jan DOE");
  });
  it("uppercases entire last_name", () => {
    expect(fullNameOf({ first_name: "Bob", last_name: "van den Berg", username: null })).toBe(
      "Bob VAN DEN BERG"
    );
  });
});
