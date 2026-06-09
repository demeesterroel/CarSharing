// lib/__tests__/notify-users.test.ts
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import { runMigrations } from "../db/migrate";
import { insertNotification, listNotifications } from "../queries/notifications";
import { insertPerson } from "../queries/people";
import { notifyUsersOfEvent } from "../notify-users";

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

/**
 * Helper: insert a car owned by ownerPersonId and return the car id.
 */
function insertCar(
  db: Database.Database,
  ownerPersonId: number,
  short = "AA"
): number {
  const result = db
    .prepare(
      `INSERT INTO cars (short, name, price_per_km, owner_person_id, owner_from, active)
       VALUES (?, 'Car AA', 0.3, ?, '2020-01-01', 1)`
    )
    .run(short, ownerPersonId);
  return result.lastInsertRowid as number;
}

describe("notifyUsersOfEvent — new_reservation trigger", () => {
  it("inserts a notification for a user with pref='all'", async () => {
    const db = makeDb();
    const aliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_new_reservations: "all",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, aliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      carId,
      actorPersonId: actorId,
      message: "A new reservation was created",
    });

    const notifs = listNotifications(db, aliceId);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].recipient_person_id).toBe(aliceId);
    expect(notifs[0].message).toBe("A new reservation was created");
  });

  it("does NOT insert for a user with pref='off'", async () => {
    const db = makeDb();
    const aliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_new_reservations: "off",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, aliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      carId,
      actorPersonId: actorId,
      message: "A new reservation was created",
    });

    expect(listNotifications(db, aliceId)).toHaveLength(0);
  });

  it("inserts for pref='own' only if they own the car", async () => {
    const db = makeDb();
    const ownerAliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_new_reservations: "own",
    });
    const nonOwnerBobId = insertPerson(db, {
      ...basePerson,
      first_name: "Bob",
      notify_new_reservations: "own",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });

    // Only Alice owns Car AA
    const carId = insertCar(db, ownerAliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      carId,
      actorPersonId: actorId,
      message: "A reservation was made on Car AA",
    });

    expect(listNotifications(db, ownerAliceId)).toHaveLength(1);
    expect(listNotifications(db, nonOwnerBobId)).toHaveLength(0);
  });

  it("always excludes the actor, even if they have pref='all'", async () => {
    const db = makeDb();
    const actorId = insertPerson(db, {
      ...basePerson,
      first_name: "Actor",
      notify_new_reservations: "all",
    });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_reservation",
      entityType: "reservation",
      entityId: 1,
      carId,
      actorPersonId: actorId,
      message: "Self-triggered reservation",
    });

    // Actor must not receive a notification about their own action
    expect(listNotifications(db, actorId)).toHaveLength(0);
  });
});

describe("notifyUsersOfEvent — reservation_update trigger", () => {
  it("maps reservation_update to notify_reservation_updates pref column", async () => {
    const db = makeDb();
    const aliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_reservation_updates: "all",
      notify_new_reservations: "off", // ensure only the right column is checked
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, aliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "reservation_update",
      entityType: "reservation",
      entityId: 5,
      carId,
      actorPersonId: actorId,
      message: "Reservation updated",
    });

    expect(listNotifications(db, aliceId)).toHaveLength(1);
  });
});

describe("notifyUsersOfEvent — new_trip trigger", () => {
  it("maps new_trip to notify_new_trips pref column", async () => {
    const db = makeDb();
    const aliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_new_trips: "all",
      notify_new_reservations: "off",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, aliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_trip",
      entityType: "trip",
      entityId: 10,
      carId,
      actorPersonId: actorId,
      message: "A new trip was logged",
    });

    expect(listNotifications(db, aliceId)).toHaveLength(1);
  });
});

describe("notifyUsersOfEvent — multiple recipients", () => {
  it("sends to all eligible recipients", async () => {
    const db = makeDb();
    const aliceId = insertPerson(db, {
      ...basePerson,
      first_name: "Alice",
      notify_new_trips: "all",
    });
    const bobId = insertPerson(db, {
      ...basePerson,
      first_name: "Bob",
      notify_new_trips: "all",
    });
    const carolId = insertPerson(db, {
      ...basePerson,
      first_name: "Carol",
      notify_new_trips: "off",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, aliceId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_trip",
      entityType: "trip",
      entityId: 7,
      carId,
      actorPersonId: actorId,
      message: "New trip logged",
    });

    expect(listNotifications(db, aliceId)).toHaveLength(1);
    expect(listNotifications(db, bobId)).toHaveLength(1);
    expect(listNotifications(db, carolId)).toHaveLength(0);
  });

  it("does not send to inactive people, even with pref='all'", async () => {
    const db = makeDb();
    const inactiveId = insertPerson(db, {
      ...basePerson,
      first_name: "Inactive",
      active: 0,
      notify_new_trips: "all",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Actor" });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "new_trip",
      entityType: "trip",
      entityId: 8,
      carId,
      actorPersonId: actorId,
      message: "New trip",
    });

    expect(listNotifications(db, inactiveId)).toHaveLength(0);
  });
});

describe("notifyUsersOfEvent — error swallowing", () => {
  it("does not throw when an internal error occurs", async () => {
    // Pass a broken db (already closed) to simulate internal error
    const db = makeDb();
    db.close();

    await expect(
      notifyUsersOfEvent({
        db,
        trigger: "new_reservation",
        entityType: "reservation",
        entityId: 1,
        carId: 999,
        actorPersonId: 1,
        message: "Should not throw",
      })
    ).resolves.toBeUndefined();
  });
});

describe("notifyUsersOfEvent — alwaysNotifyPersonId (reserver outcome)", () => {
  it("notifies the always-notify person even when their pref is 'off'", async () => {
    const db = makeDb();
    const reserverId = insertPerson(db, {
      ...basePerson,
      first_name: "Reserver",
      notify_reservation_updates: "off",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Owner" });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "reservation_update",
      entityType: "reservation",
      entityId: 7,
      carId,
      actorPersonId: actorId,
      alwaysNotifyPersonId: reserverId,
      message: "approved",
    });

    expect(listNotifications(db, reserverId)).toHaveLength(1);
  });

  it("does not notify the always-notify person when they are the actor", async () => {
    const db = makeDb();
    const actorId = insertPerson(db, {
      ...basePerson,
      first_name: "Owner",
      notify_reservation_updates: "off",
    });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "reservation_update",
      entityType: "reservation",
      entityId: 8,
      carId,
      actorPersonId: actorId,
      alwaysNotifyPersonId: actorId,
      message: "approved",
    });

    expect(listNotifications(db, actorId)).toHaveLength(0);
  });

  it("does not double-notify when the reserver is also opted in", async () => {
    const db = makeDb();
    const reserverId = insertPerson(db, {
      ...basePerson,
      first_name: "Reserver",
      notify_reservation_updates: "all",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Owner" });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "reservation_update",
      entityType: "reservation",
      entityId: 9,
      carId,
      actorPersonId: actorId,
      alwaysNotifyPersonId: reserverId,
      message: "approved",
    });

    expect(listNotifications(db, reserverId)).toHaveLength(1);
  });
});

describe("notifyUsersOfEvent — per-recipient message", () => {
  it("uses alwaysNotifyMessage for the reserver and message for others", async () => {
    const db = makeDb();
    const watcherId = insertPerson(db, {
      ...basePerson,
      first_name: "Watcher",
      notify_reservation_updates: "all",
    });
    const reserverId = insertPerson(db, {
      ...basePerson,
      first_name: "Reserver",
      notify_reservation_updates: "off",
    });
    const actorId = insertPerson(db, { ...basePerson, first_name: "Owner" });
    const carId = insertCar(db, actorId);

    await notifyUsersOfEvent({
      db,
      trigger: "reservation_update",
      entityType: "reservation",
      entityId: 11,
      carId,
      actorPersonId: actorId,
      alwaysNotifyPersonId: reserverId,
      message: "generic",
      alwaysNotifyMessage: "yours",
    });

    expect(listNotifications(db, reserverId)[0].message).toBe("yours");
    expect(listNotifications(db, watcherId)[0].message).toBe("generic");
  });
});
