import { describe, expect, it } from "vitest";
import { canEdit } from "./permissions";

describe("canEdit", () => {
  // Record authored by Alice (person 2) on Car JF (car 10).
  // Car JF is owned by Owner A (person 5).
  const record = { person_id: 2, car_id: 10 };
  const carOwner = 5;

  // Identities used in the truth table below:
  const ADMIN = 99; // an admin who is neither author nor owner
  const ALICE = 2; // the record's author
  const OWNER_A = 5; // the car owner
  const BOB = 7; // unrelated member (neither admin, author, nor owner)

  describe("admin", () => {
    it("allows an admin who is unrelated to the record", () => {
      expect(canEdit(ADMIN, true, record, carOwner)).toBe(true);
    });
    it("allows an admin even when the car has no owner", () => {
      expect(canEdit(ADMIN, true, record, null)).toBe(true);
    });
  });

  describe("author", () => {
    it("allows the author of the record", () => {
      expect(canEdit(ALICE, false, record, carOwner)).toBe(true);
    });
    it("allows the author even when the car has no owner", () => {
      expect(canEdit(ALICE, false, record, null)).toBe(true);
    });
  });

  describe("car owner", () => {
    it("allows the car owner who did not author the record", () => {
      expect(canEdit(OWNER_A, false, record, carOwner)).toBe(true);
    });
  });

  describe("unrelated member", () => {
    it("rejects a member who is neither admin, author, nor owner", () => {
      expect(canEdit(BOB, false, record, carOwner)).toBe(false);
    });
    it("rejects an unrelated member when the car has no owner", () => {
      expect(canEdit(BOB, false, record, null)).toBe(false);
    });
  });

  describe("owner self-match guard", () => {
    it("does not treat a null car owner as a match for person 0-like ids", () => {
      // carOwnerPersonId === null must never short-circuit to true.
      expect(canEdit(BOB, false, record, null)).toBe(false);
    });
  });
});
