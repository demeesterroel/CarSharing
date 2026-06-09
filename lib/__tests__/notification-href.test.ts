import { describe, expect, it } from "vitest";
import { notificationHref } from "../notification-href";

describe("notificationHref", () => {
  it("returns /calendar?reservation=<id> for entity_type 'reservation'", () => {
    expect(notificationHref({ entity_type: "reservation", entity_id: 42 })).toBe(
      "/calendar?reservation=42"
    );
  });

  it("returns /trips?trip=<id> for entity_type 'trip'", () => {
    expect(notificationHref({ entity_type: "trip", entity_id: 7 })).toBe("/trips?trip=7");
  });

  it("returns empty string for unknown entity_type", () => {
    expect(notificationHref({ entity_type: "fuel", entity_id: 1 })).toBe("");
  });

  it("returns empty string for empty entity_type", () => {
    expect(notificationHref({ entity_type: "", entity_id: 1 })).toBe("");
  });

  it("uses the correct entity_id", () => {
    expect(notificationHref({ entity_type: "reservation", entity_id: 100 })).toBe(
      "/calendar?reservation=100"
    );
    expect(notificationHref({ entity_type: "trip", entity_id: 999 })).toBe("/trips?trip=999");
  });
});
