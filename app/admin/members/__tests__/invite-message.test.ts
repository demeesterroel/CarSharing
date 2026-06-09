import { describe, expect, it } from "vitest";
import { buildInviteMessage } from "../invite-message";

// Stub t function: returns the key with placeholders substituted.
// To make var values visible in output, we append them as "key[var=value]".
function stubT(key: string, vars?: Record<string, string | number>): string {
  let result = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result += `[${k}=${v}]`;
    }
  }
  return result;
}

describe("buildInviteMessage", () => {
  it("includes the username when provided", () => {
    const msg = buildInviteMessage("alice", "https://example.com/invite/abc123", stubT);
    expect(msg).toContain("alice");
    expect(msg).toContain("https://example.com/invite/abc123");
  });

  it("includes the URL", () => {
    const msg = buildInviteMessage("bob", "https://example.com/invite/xyz", stubT);
    expect(msg).toContain("https://example.com/invite/xyz");
  });

  it("omits the username line when username is null", () => {
    const msg = buildInviteMessage(null, "https://example.com/invite/token", stubT);
    expect(msg).not.toContain("admin.invite_msg_username");
    expect(msg).toContain("https://example.com/invite/token");
  });

  it("omits the username line when username is an empty string", () => {
    const msg = buildInviteMessage("", "https://example.com/invite/token2", stubT);
    expect(msg).not.toContain("admin.invite_msg_username");
    expect(msg).toContain("https://example.com/invite/token2");
  });

  it("contains the intro and cta lines from t()", () => {
    const msg = buildInviteMessage("carol", "https://example.com/invite/qqq", stubT);
    expect(msg).toContain("admin.invite_msg_intro");
    expect(msg).toContain("admin.invite_msg_cta");
  });

  it("the username line contains the username substituted in", () => {
    const msg = buildInviteMessage("owner_a", "https://example.com/invite/qqq", stubT);
    // stubT replaces {username} with the value, so the line should contain the username
    expect(msg).toContain("owner_a");
  });
});
