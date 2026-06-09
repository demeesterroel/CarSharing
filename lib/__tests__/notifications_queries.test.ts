// lib/__tests__/notifications_queries.test.ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../db/migrate";
import { insertPerson, updatePerson } from "../queries/people";
import {
  insertNotification,
  listNotifications,
  markRead,
  unreadCount,
} from "../queries/notifications";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const basePerson = {
  first_name: "",
  last_name: "",
  discount: 0,
  discount_long: 0,
  active: 1 as const,
  username: null,
  password_hash: null,
  is_admin: 0 as const,
  bank_account: "",
  email: null,
  theme_preference: "mono" as const,
};

describe("insertNotification", () => {
  it("returns a numeric id", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const id = insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "A new reservation was made",
    });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("stores the notification with correct fields", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const id = insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 42,
      message: "Car AA was reserved",
    });
    const row = db.prepare("SELECT * FROM notifications WHERE id=?").get(id) as any;
    expect(row.recipient_person_id).toBe(aliceId);
    expect(row.type).toBe("new_reservation");
    expect(row.entity_type).toBe("reservation");
    expect(row.entity_id).toBe(42);
    expect(row.message).toBe("Car AA was reserved");
    expect(row.read_at).toBeNull();
    expect(typeof row.created_at).toBe("string");
  });
});

describe("listNotifications", () => {
  it("returns empty array when no notifications", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    expect(listNotifications(db, aliceId)).toEqual([]);
  });

  it("returns newest-first for a single recipient", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });

    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "First",
    });
    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 2,
      message: "Second",
    });
    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_trip",
      entityType: "trip",
      entityId: 3,
      message: "Third",
    });

    const list = listNotifications(db, aliceId);
    expect(list).toHaveLength(3);
    expect(list[0].message).toBe("Third");
    expect(list[1].message).toBe("Second");
    expect(list[2].message).toBe("First");
  });

  it("recipient scoping: Alice never sees Bob's notifications", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const bobId = insertPerson(db, { ...basePerson, first_name: "Bob" });

    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "Alice's notification",
    });
    insertNotification(db, {
      recipientPersonId: bobId,
      type: "new_trip",
      entityType: "trip",
      entityId: 2,
      message: "Bob's notification",
    });

    const aliceList = listNotifications(db, aliceId);
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0].message).toBe("Alice's notification");

    const bobList = listNotifications(db, bobId);
    expect(bobList).toHaveLength(1);
    expect(bobList[0].message).toBe("Bob's notification");
  });

  it("respects the limit parameter", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    for (let i = 1; i <= 10; i++) {
      insertNotification(db, {
        recipientPersonId: aliceId,
        type: "new_trip",
        entityType: "trip",
        entityId: i,
        message: `Notification ${i}`,
      });
    }
    const limited = listNotifications(db, aliceId, 3);
    expect(limited).toHaveLength(3);
  });

  it("default limit is 50", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    for (let i = 1; i <= 60; i++) {
      insertNotification(db, {
        recipientPersonId: aliceId,
        type: "new_trip",
        entityType: "trip",
        entityId: i,
        message: `Notification ${i}`,
      });
    }
    const all = listNotifications(db, aliceId);
    expect(all).toHaveLength(50);
  });
});

describe("unreadCount", () => {
  it("returns 0 when no notifications", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    expect(unreadCount(db, aliceId)).toBe(0);
  });

  it("counts only unread notifications", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });

    const id1 = insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "First (will be read)",
    });
    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 2,
      message: "Second (unread)",
    });

    // Mark the first one as read
    db.prepare("UPDATE notifications SET read_at=datetime('now') WHERE id=?").run(id1);

    expect(unreadCount(db, aliceId)).toBe(1);
  });

  it("recipient scoping: Bob's unread don't affect Alice's count", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const bobId = insertPerson(db, { ...basePerson, first_name: "Bob" });

    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_trip",
      entityType: "trip",
      entityId: 1,
      message: "Alice's notification",
    });
    insertNotification(db, {
      recipientPersonId: bobId,
      type: "new_trip",
      entityType: "trip",
      entityId: 2,
      message: "Bob's notification",
    });
    insertNotification(db, {
      recipientPersonId: bobId,
      type: "new_trip",
      entityType: "trip",
      entityId: 3,
      message: "Bob's second notification",
    });

    expect(unreadCount(db, aliceId)).toBe(1);
    expect(unreadCount(db, bobId)).toBe(2);
  });
});

describe("markRead", () => {
  it("marks all unread notifications when no ids supplied", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });

    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "First",
    });
    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 2,
      message: "Second",
    });

    expect(unreadCount(db, aliceId)).toBe(2);
    markRead(db, aliceId);
    expect(unreadCount(db, aliceId)).toBe(0);
  });

  it("marks only specific ids when ids are supplied", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });

    const id1 = insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      message: "First",
    });
    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_reservation",
      entityType: "reservation",
      entityId: 2,
      message: "Second",
    });

    markRead(db, aliceId, [id1]);
    expect(unreadCount(db, aliceId)).toBe(1);
  });

  it("recipient-scoped: markRead all for Alice does not read Bob's notifications", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const bobId = insertPerson(db, { ...basePerson, first_name: "Bob" });

    insertNotification(db, {
      recipientPersonId: aliceId,
      type: "new_trip",
      entityType: "trip",
      entityId: 1,
      message: "Alice's notification",
    });
    insertNotification(db, {
      recipientPersonId: bobId,
      type: "new_trip",
      entityType: "trip",
      entityId: 2,
      message: "Bob's notification",
    });

    markRead(db, aliceId);
    expect(unreadCount(db, aliceId)).toBe(0);
    expect(unreadCount(db, bobId)).toBe(1);
  });

  it("recipient-scoped: Alice cannot mark Bob's specific notification as read", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const bobId = insertPerson(db, { ...basePerson, first_name: "Bob" });

    const bobNotifId = insertNotification(db, {
      recipientPersonId: bobId,
      type: "new_trip",
      entityType: "trip",
      entityId: 1,
      message: "Bob's notification",
    });

    // Alice tries to mark Bob's notification as read — should be a no-op
    markRead(db, aliceId, [bobNotifId]);
    expect(unreadCount(db, bobId)).toBe(1);
  });
});

describe("person notify preference columns", () => {
  it("returns default opt-out values for new person", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const row = db.prepare("SELECT * FROM people WHERE id=?").get(aliceId) as any;
    expect(row.notify_new_reservations).toBe("off");
    // Reservation updates default to 'mine': your own outcome is always sent,
    // but you don't see other people's updates unless you opt in.
    expect(row.notify_reservation_updates).toBe("mine");
    expect(row.notify_new_trips).toBe("off");
    expect(row.notify_my_car_reservations).toBe("off");
    expect(row.notify_my_car_trips).toBe("off");
  });

  it("updatePerson persists notify preference columns", () => {
    const db = makeDb();
    const aliceId = insertPerson(db, { ...basePerson, first_name: "Alice" });
    const row = db.prepare("SELECT * FROM people WHERE id=?").get(aliceId) as any;
    updatePerson(db, aliceId, {
      ...row,
      notify_new_reservations: "all",
      notify_reservation_updates: "own",
      notify_new_trips: "all",
    });
    const updated = db.prepare("SELECT * FROM people WHERE id=?").get(aliceId) as any;
    expect(updated.notify_new_reservations).toBe("all");
    expect(updated.notify_reservation_updates).toBe("own");
    expect(updated.notify_new_trips).toBe("all");
  });
});
