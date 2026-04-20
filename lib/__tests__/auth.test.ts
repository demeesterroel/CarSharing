import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials } from "../auth";

let HASH: string;

beforeAll(async () => {
  // Cost 4 keeps tests fast; production uses cost 12.
  HASH = await bcrypt.hash("correct-horse", 4);
});

describe("verifyCredentials", () => {
  it("returns true for matching username and password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "correct-horse" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(true);
  });

  it("returns false for wrong username", async () => {
    expect(
      await verifyCredentials(
        { username: "bob", password: "correct-horse" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false for wrong password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "wrong" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false for empty password", async () => {
    expect(
      await verifyCredentials(
        { username: "alice", password: "" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });

  it("returns false when both username and password are wrong", async () => {
    expect(
      await verifyCredentials(
        { username: "hacker", password: "guess" },
        { username: "alice", passwordHash: HASH }
      )
    ).toBe(false);
  });
});
