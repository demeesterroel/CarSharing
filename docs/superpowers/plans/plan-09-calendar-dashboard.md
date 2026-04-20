# CarSharing — Plan 09: Calendar & Dashboard

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisites:** plans 00, 01, 02, 02b, 03, 03b (i18n), 04, 05, 06, 07, 08 completed.

**Goal:** Reservations API + FullCalendar reservation view, and the Dashboard balance summary with per-person saldo.

**Architecture:** Reservations follow the standard CRUD pattern. Dashboard aggregates in 4 `GROUP BY person_id` queries (one per fact table) rather than N × 4 round-trips, then composes balances in memory. FullCalendar all-day events use exclusive end dates, so `end_date` is rendered as `end_date + 1 day`. User-facing strings resolve through `t()` from `@/lib/i18n` (plan-03b).

**Tech Stack:** better-sqlite3, Zod, TanStack Query, FullCalendar.

---

### Task 1: Reservations query helpers

**Files:**
- Create: `lib/queries/reservations.ts`

- [ ] **Step 1: Create lib/queries/reservations.ts**

```ts
import type Database from "better-sqlite3";
import type { Reservation, ReservationInput } from "@/types";

export function getReservations(db: Database.Database): Reservation[] {
  return db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM reservations r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    ORDER BY r.start_date DESC
  `).all() as Reservation[];
}

export function getReservationById(db: Database.Database, id: number): Reservation | null {
  return (db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM reservations r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = ?
  `).get(id) as Reservation) ?? null;
}

export function insertReservation(db: Database.Database, input: ReservationInput): number {
  const result = db.prepare(
    "INSERT INTO reservations (person_id,car_id,start_date,end_date) VALUES (?,?,?,?)"
  ).run(input.person_id, input.car_id, input.start_date, input.end_date);
  return result.lastInsertRowid as number;
}

export function updateReservation(db: Database.Database, id: number, input: ReservationInput): void {
  db.prepare("UPDATE reservations SET person_id=?,car_id=?,start_date=?,end_date=? WHERE id=?")
    .run(input.person_id, input.car_id, input.start_date, input.end_date, id);
}

export function deleteReservation(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM reservations WHERE id=?").run(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/reservations.ts
git commit -m "feat: reservation query helpers"
```

---

### Task 2: Reservations API routes

**Files:**
- Create: `app/api/reservations/route.ts`
- Create: `app/api/reservations/[id]/route.ts`

- [ ] **Step 1: Create app/api/reservations/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";
import { json, readBody, badRequest } from "@/lib/api";

const ReservationSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
}).refine((v) => v.end_date >= v.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

export const GET = json(async () => getReservations(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, ReservationSchema);
  const id = insertReservation(getDb(), body);
  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Create app/api/reservations/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  getReservationById,
  updateReservation,
  deleteReservation,
} from "@/lib/queries/reservations";
import { json, readBody, readId, notFound } from "@/lib/api";

const ReservationSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  start_date: z.string().min(10),
  end_date: z.string().min(10),
}).refine((v) => v.end_date >= v.start_date, {
  message: "end_date must be on or after start_date",
  path: ["end_date"],
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getReservationById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, ReservationSchema);
  updateReservation(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteReservation(getDb(), id);
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/reservations/
git commit -m "feat: reservations API routes with zod validation"
```

---

### Task 3: Reservations hook

**Files:**
- Create: `hooks/use-reservations.ts`

- [ ] **Step 1: Create hooks/use-reservations.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Reservation, ReservationInput } from "@/types";

export const reservationsHooks = createResourceHooks<Reservation, ReservationInput>(
  "reservations",
  "/api/reservations"
);

export const useReservations = reservationsHooks.useList;
export const useCreateReservation = reservationsHooks.useCreate;
export const useUpdateReservation = reservationsHooks.useUpdate;
export const useDeleteReservation = reservationsHooks.useDelete;
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-reservations.ts
git commit -m "feat: useReservations hooks"
```

---

### Task 4: Calendar page with FullCalendar

**Files:**
- Create: `app/calendar/reservation-form.tsx`
- Create: `app/calendar/full-calendar-wrapper.tsx`
- Create: `app/calendar/page.tsx`

- [ ] **Step 1: Create app/calendar/reservation-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Reservation, ReservationInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z
  .object({
    person_id: z.number({ required_error: t("validation.person_required") }),
    car_id: z.number({ required_error: t("validation.car_required") }),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: t("validation.end_date_gte_start"),
    path: ["end_date"],
  });
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Reservation>;
  onSubmit: (data: ReservationInput) => void;
  onCancel: () => void;
}

export function ReservationForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: today, end_date: today, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-2">{t("form.car")}</label>
        <Controller
          name="car_id"
          control={control}
          render={({ field }) => (
            <CarToggle cars={cars} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller
          name="person_id"
          control={control}
          render={({ field }) => (
            <PersonSelect
              people={people.filter((p) => p.active)}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.date_from")}</label>
          <input
            {...register("start_date")}
            type="date"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.date_to")}</label>
          <input
            {...register("end_date")}
            type="date"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          {errors.end_date && (
            <p className="text-xs text-red-600 mt-1">{errors.end_date.message}</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">
          {t("action.cancel")}
        </button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">
          {t("action.save")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create app/calendar/full-calendar-wrapper.tsx**

FullCalendar must load as a client-only component (no SSR) — it touches `window` during init.

```tsx
"use client";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

interface Props {
  events: EventInput[];
  onEventClick: (info: EventClickArg) => void;
}

export default function FullCalendarWrapper({ events, onEventClick }: Props) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      }}
      events={events}
      eventClick={onEventClick}
      height="auto"
      locale="nl"
      firstDay={1}
    />
  );
}
```

- [ ] **Step 3: Create app/calendar/page.tsx**

Important: FullCalendar treats `end` as **exclusive** for all-day events, so to render a reservation that runs from 2026-04-18 through 2026-04-20 inclusive, `end` must be `2026-04-21`. We add one day at mapping time.

```tsx
"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import type { EventClickArg } from "@fullcalendar/core";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { ReservationForm } from "./reservation-form";
import {
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from "@/hooks/use-reservations";
import type { Reservation } from "@/types";
import { t } from "@/lib/i18n";

const FullCalendarWrapper = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { data: reservations = [], isLoading } = useReservations();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const events = useMemo(
    () =>
      reservations.map((r) => ({
        id: String(r.id),
        title: `${r.car_short} - ${r.person_name}`,
        start: r.start_date,
        end: addOneDay(r.end_date), // FullCalendar all-day end is exclusive
        allDay: true,
        backgroundColor: "#c0392b",
        borderColor: "#c0392b",
        extendedProps: { reservation: r },
      })),
    [reservations]
  );

  const handleEventClick = (info: EventClickArg) => {
    setEditing(info.event.extendedProps.reservation as Reservation);
  };

  return (
    <>
      <PageHeader title={t("page.calendar")} />
      <div className="p-2">
        {!isLoading && <FullCalendarWrapper events={events} onEventClick={handleEventClick} />}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.reservation_add")}
            </Dialog.Title>
            <ReservationForm
              onSubmit={(data) =>
                createR.mutate(data, {
                  onSuccess: () => {
                    setAdding(false);
                    toast.success(t("toast.reservation_saved"));
                  },
                })
              }
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.reservation_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <ReservationForm
                  defaultValues={editing}
                  onSubmit={(data) =>
                    updateR.mutate(
                      { id: editing.id, ...data },
                      {
                        onSuccess: () => {
                          setEditing(null);
                          toast.success(t("toast.saved"));
                        },
                      }
                    )
                  }
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button
                    onClick={() =>
                      deleteR.mutate(editing.id, {
                        onSuccess: () => {
                          setEditing(null);
                          toast.success(t("toast.deleted"));
                        },
                      })
                    }
                    className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm"
                  >
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.reservation_add")} />
    </>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to http://localhost:3000/calendar. Month view renders. Create a reservation spanning 3 days — the event visually covers the full 3 days (not 2). Click the event to open edit dialog. FAB opens create dialog.

- [ ] **Step 5: Commit**

```bash
git add app/calendar/
git commit -m "feat: calendar page with FullCalendar and inclusive end-date rendering"
```

---

### Task 5: Dashboard query — aggregated in 4 GROUP BY queries

**Files:**
- Create: `lib/queries/dashboard.ts`
- Modify: `lib/__tests__/queries.test.ts` (or create if missing)

The previous design issued 4 queries per person. For 10 people that is 40 round-trips; the query below issues 4 queries total, independent of person count, and composes balances in JS.

- [ ] **Step 1: Create lib/queries/dashboard.ts**

```ts
import type Database from "better-sqlite3";
import type { DashboardRow } from "@/types";

interface TripAgg {
  person_id: number;
  trip_count: number;
  trip_km: number;
  trip_amount: number;
}
interface FuelAgg {
  person_id: number;
  fuel_count: number;
  fuel_liters: number;
  fuel_amount: number;
}
interface ExpenseAgg {
  person_id: number;
  expense_amount: number;
}
interface PaymentAgg {
  person_id: number;
  paid_amount: number;
}

export function getDashboard(db: Database.Database, year: number): DashboardRow[] {
  const yearStr = String(year);

  const people = db
    .prepare("SELECT id, name FROM people ORDER BY name")
    .all() as { id: number; name: string }[];

  const tripRows = db
    .prepare(`
      SELECT person_id,
             COUNT(*)                AS trip_count,
             COALESCE(SUM(km),0)     AS trip_km,
             COALESCE(SUM(amount),0) AS trip_amount
      FROM trips
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as TripAgg[];

  const fuelRows = db
    .prepare(`
      SELECT person_id,
             COUNT(*)                AS fuel_count,
             COALESCE(SUM(liters),0) AS fuel_liters,
             COALESCE(SUM(amount),0) AS fuel_amount
      FROM fuel_fillups
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as FuelAgg[];

  const expenseRows = db
    .prepare(`
      SELECT person_id,
             COALESCE(SUM(amount),0) AS expense_amount
      FROM expenses
      WHERE strftime('%Y', date) = ?
      GROUP BY person_id
    `)
    .all(yearStr) as ExpenseAgg[];

  const paymentRows = db
    .prepare(`
      SELECT person_id,
             COALESCE(SUM(amount),0) AS paid_amount
      FROM payments
      WHERE year = ?
      GROUP BY person_id
    `)
    .all(year) as PaymentAgg[];

  const byId = <T extends { person_id: number }>(rows: T[]) =>
    new Map<number, T>(rows.map((r) => [r.person_id, r]));
  const trips = byId(tripRows);
  const fuel = byId(fuelRows);
  const expenses = byId(expenseRows);
  const payments = byId(paymentRows);

  return people.map((person) => {
    const t = trips.get(person.id);
    const f = fuel.get(person.id);
    const e = expenses.get(person.id);
    const p = payments.get(person.id);

    const trip_amount = -(t?.trip_amount ?? 0); // trips are billed (negative)
    const fuel_amount = f?.fuel_amount ?? 0; // fuel paid by person (positive)
    const expense_amount = e?.expense_amount ?? 0; // extra costs paid (positive)
    const paid_amount = p?.paid_amount ?? 0; // settlement payments

    const total_amount = trip_amount + fuel_amount + expense_amount;
    const balance = total_amount + paid_amount;

    return {
      person_id: person.id,
      person_name: person.name,
      year,
      trip_count: t?.trip_count ?? 0,
      trip_km: t?.trip_km ?? 0,
      fuel_count: f?.fuel_count ?? 0,
      fuel_liters: f?.fuel_liters ?? 0,
      trip_amount,
      fuel_amount,
      expense_amount,
      total_amount,
      paid_amount,
      balance,
    };
  });
}
```

- [ ] **Step 2: Append tests to lib/__tests__/queries.test.ts**

```ts
import { describe, it, expect } from "vitest";
import { getDashboard } from "../queries/dashboard";
import { insertTrip } from "../queries/trips";
import { insertPerson } from "../queries/people";
import { insertCar } from "../queries/cars";
import { makeTestDb } from "./test-db";

describe("getDashboard", () => {
  it("returns zero balance for person with no activity", () => {
    const db = makeTestDb();
    insertPerson(db, { name: "Test", discount: 0, discount_long: 0, active: 1 });
    const rows = getDashboard(db, 2026);
    expect(rows[0].balance).toBe(0);
    expect(rows[0].trip_count).toBe(0);
  });

  it("computes negative balance when trip amount exceeds payments", () => {
    const db = makeTestDb();
    const pid = insertPerson(db, { name: "Roeland", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, {
      short: "LEW",
      name: "Lewis",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2026-01-10",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const rows = getDashboard(db, 2026);
    // trip_amount = -25, no fuel/expense/payment → balance = -25
    expect(rows[0].balance).toBeCloseTo(-25);
    expect(rows[0].trip_km).toBe(100);
    expect(rows[0].trip_count).toBe(1);
  });

  it("filters trips outside target year", () => {
    const db = makeTestDb();
    const pid = insertPerson(db, { name: "X", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, {
      short: "A",
      name: "A",
      price_per_km: 0.25,
      brand: null,
      color: null,
    });
    insertTrip(db, {
      person_id: pid,
      car_id: cid,
      date: "2025-06-01",
      start_odometer: 0,
      end_odometer: 100,
      location: null,
    });
    const rows = getDashboard(db, 2026);
    expect(rows[0].trip_count).toBe(0);
    expect(rows[0].balance).toBe(0);
  });
});
```

Note: `makeTestDb` is the in-memory test helper created in plan 02. If it hasn't been extracted yet, create `lib/__tests__/test-db.ts` with the same migration + schema application used in the db plan.

- [ ] **Step 3: Run tests**

```bash
npm test lib/__tests__/
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/dashboard.ts lib/__tests__/queries.test.ts
git commit -m "feat: dashboard query aggregates in 4 GROUP BY passes with tests"
```

---

### Task 6: Dashboard API route

**Files:**
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Create app/api/dashboard/route.ts**

```ts
import { getDb } from "@/lib/db";
import { getDashboard } from "@/lib/queries/dashboard";
import { json } from "@/lib/api";

export const GET = json(async (req) => {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  return getDashboard(getDb(), year);
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/dashboard/
git commit -m "feat: dashboard API route"
```

---

### Task 7: Dashboard hook and page

**Files:**
- Create: `hooks/use-dashboard.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create hooks/use-dashboard.ts**

```ts
import { useQuery } from "@tanstack/react-query";
import type { DashboardRow } from "@/types";

export function useDashboard(year: number) {
  return useQuery<DashboardRow[]>({
    queryKey: ["dashboard", year],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?year=${year}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });
}
```

- [ ] **Step 2: Replace app/page.tsx with full dashboard**

```tsx
"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useDashboard } from "@/hooks/use-dashboard";
import { t } from "@/lib/i18n";

function balanceColor(balance: number) {
  if (balance > 0.005) return "text-green-600";
  if (balance < -0.005) return "text-red-600";
  return "text-gray-400";
}

function balanceDot(balance: number) {
  if (balance > 0.005) return "bg-green-500";
  if (balance < -0.005) return "bg-red-500";
  return "bg-gray-300";
}

function balanceMessage(balance: number): string {
  if (Math.abs(balance) < 0.005) return t("balance.settled");
  if (balance > 0) return t("balance.credit", { amount: balance.toFixed(2) });
  return t("balance.debt", { amount: Math.abs(balance).toFixed(2) });
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: rows = [], isLoading } = useDashboard(year);

  return (
    <>
      <PageHeader title={t("page.dashboard")} />
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.person_id} className="flex items-center px-4 py-3 gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${balanceDot(row.balance)}`}
              />
              <span
                className={`flex-1 text-sm font-medium ${
                  row.balance !== 0 ? balanceColor(row.balance) : "text-gray-500"
                }`}
              >
                {row.person_name}
              </span>
              <div className="text-right">
                <p className={`text-sm font-mono font-medium ${balanceColor(row.balance)}`}>
                  € {row.balance.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">{balanceMessage(row.balance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to http://localhost:3000. Dashboard shows all people with green/red/grey saldo dots. Year ◀ ▶ navigation swaps data and disables the forward arrow at the current year.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-dashboard.ts app/page.tsx
git commit -m "feat: dashboard page with per-person balance and year navigation"
```
