// lib/__tests__/queries_reservations.test.ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate";
import {
  getReservations,
  getReservationById,
  insertReservation,
  updateReservation,
  updateReservationStatus,
  deleteReservation,
  ConflictError,
} from "../queries/reservations";

function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function seed(db: Database.Database) {
  db.exec(`INSERT INTO people (id, name, first_name, last_name, active) VALUES (1, 'Alice Owner', 'Alice', 'Owner', 1), (2, 'Bob Member', 'Bob', 'Member', 1)`);
  db.exec(
    `INSERT INTO cars (id, short, name, price_per_km, owner_person_id, owner_from, active) VALUES (1, 'CA', 'Car A', 0.2, 1, '2020-01-01', 1)`
  );
}

describe("getReservations", () => {
  it("returns empty array when no reservations exist", () => {
    const db = makeDb();
    seed(db);
    expect(getReservations(db)).toEqual([]);
  });

  it("returns all reservations with joined person_name and car_short", () => {
    const db = makeDb();
    seed(db);
    insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    const list = getReservations(db);
    expect(list).toHaveLength(1);
    expect(list[0].person_name).toBe("Alice");
    expect(list[0].car_short).toBe("CA");
  });

  it("orders by start_date DESC", () => {
    const db = makeDb();
    seed(db);
    insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-02",
    });
    insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-07-01",
      end_date: "2026-07-02",
    });
    const list = getReservations(db);
    expect(list[0].start_date).toBe("2026-07-01");
    expect(list[1].start_date).toBe("2026-06-01");
  });
});

describe("getReservationById", () => {
  it("returns the correct reservation", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-05",
    });
    const res = getReservationById(db, id);
    expect(res?.id).toBe(id);
    expect(res?.person_name).toBe("Alice");
    expect(res?.car_short).toBe("CA");
  });

  it("returns null for a non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(getReservationById(db, 9999)).toBeNull();
  });
});

describe("insertReservation", () => {
  it("creates a reservation with default status=pending", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    const res = getReservationById(db, id);
    expect(res?.status).toBe("pending");
  });

  it("respects provided status", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      status: "confirmed",
    });
    expect(getReservationById(db, id)?.status).toBe("confirmed");
  });

  it("stores note when provided", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      note: "Please confirm ASAP",
    });
    expect(getReservationById(db, id)?.note).toBe("Please confirm ASAP");
  });

  it("idempotency: returns existing id when client_id already exists", () => {
    const db = makeDb();
    seed(db);
    const id1 = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      client_id: "client-abc",
    });
    const id2 = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      client_id: "client-abc",
    });
    expect(id2).toBe(id1);
    expect(getReservations(db)).toHaveLength(1);
  });

  it("creates a new row when client_id is null", () => {
    const db = makeDb();
    seed(db);
    insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-02",
    });
    insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-07-01",
      end_date: "2026-07-02",
    });
    expect(getReservations(db)).toHaveLength(2);
  });
});

describe("updateReservation", () => {
  it("updates all fields of a reservation", () => {
    const db = makeDb();
    seed(db);
    db.exec(`INSERT INTO people (id, name, first_name, last_name, active) VALUES (3, 'Carol', 'Carol', '', 1)`);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    updateReservation(db, id, {
      person_id: 3,
      car_id: 1,
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      status: "confirmed",
      note: "Updated note",
    });
    const res = getReservationById(db, id);
    expect(res?.person_name).toBe("Carol");
    expect(res?.start_date).toBe("2026-06-10");
    expect(res?.status).toBe("confirmed");
    expect(res?.note).toBe("Updated note");
  });

  it("with expectedUpdatedAt: succeeds when timestamp matches", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    const res = getReservationById(db, id)!;
    expect(() =>
      updateReservation(
        db,
        id,
        {
          person_id: 1,
          car_id: 1,
          start_date: "2026-06-01",
          end_date: "2026-06-03",
          status: "confirmed",
        },
        { expectedUpdatedAt: res.updated_at }
      )
    ).not.toThrow();
  });

  it("with expectedUpdatedAt: throws ConflictError when timestamp mismatches", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    expect(() =>
      updateReservation(
        db,
        id,
        { person_id: 1, car_id: 1, start_date: "2026-06-01", end_date: "2026-06-03" },
        { expectedUpdatedAt: "2000-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });

  it("with expectedUpdatedAt: throws ConflictError when reservation no longer exists", () => {
    const db = makeDb();
    seed(db);
    expect(() =>
      updateReservation(
        db,
        9999,
        { person_id: 1, car_id: 1, start_date: "2026-06-01", end_date: "2026-06-03" },
        { expectedUpdatedAt: "2000-01-01 00:00:00" }
      )
    ).toThrow(ConflictError);
  });
});

describe("updateReservationStatus", () => {
  it("updates only the status field", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    updateReservationStatus(db, id, "confirmed");
    expect(getReservationById(db, id)?.status).toBe("confirmed");
  });

  it("can set status to rejected", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    updateReservationStatus(db, id, "rejected");
    expect(getReservationById(db, id)?.status).toBe("rejected");
  });
});

describe("deleteReservation", () => {
  it("removes the reservation from the DB", () => {
    const db = makeDb();
    seed(db);
    const id = insertReservation(db, {
      person_id: 1,
      car_id: 1,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
    });
    deleteReservation(db, id);
    expect(getReservationById(db, id)).toBeNull();
    expect(getReservations(db)).toHaveLength(0);
  });

  it("does not throw for non-existent id", () => {
    const db = makeDb();
    seed(db);
    expect(() => deleteReservation(db, 9999)).not.toThrow();
  });
});
