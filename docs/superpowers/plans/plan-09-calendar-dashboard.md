# CarSharing — Plan 09: Calendar & Dashboard

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Reservations API + FullCalendar reservation view, and the Dashboard balance summary with per-person saldo.

---

### Task 1: Reservations query helpers & API

**Files:**
- Create: `lib/queries/reservations.ts`
- Create: `app/api/reservations/route.ts`
- Create: `app/api/reservations/[id]/route.ts`

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

- [ ] **Step 2: Create app/api/reservations/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservations, insertReservation } from "@/lib/queries/reservations";

export async function GET() {
  return NextResponse.json(getReservations(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertReservation(getDb(), {
    person_id: body.person_id, car_id: body.car_id,
    start_date: body.start_date, end_date: body.end_date,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 3: Create app/api/reservations/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReservationById, updateReservation, deleteReservation } from "@/lib/queries/reservations";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const r = getReservationById(getDb(), Number(params.id));
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(r);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateReservation(getDb(), Number(params.id), {
    person_id: body.person_id, car_id: body.car_id,
    start_date: body.start_date, end_date: body.end_date,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteReservation(getDb(), Number(params.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/queries/reservations.ts app/api/reservations/
git commit -m "feat: reservations query helpers and API routes"
```

---

### Task 2: Calendar page

**Files:**
- Create: `hooks/use-reservations.ts`
- Create: `app/calendar/page.tsx`
- Create: `app/calendar/reservation-form.tsx`

- [ ] **Step 1: Create hooks/use-reservations.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Reservation, ReservationInput } from "@/types";

export function useReservations() {
  return useQuery<Reservation[]>({
    queryKey: ["reservations"],
    queryFn: () => fetch("/api/reservations").then((r) => r.json()),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReservationInput) =>
      fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ReservationInput & { id: number }) =>
      fetch(`/api/reservations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/reservations/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}
```

- [ ] **Step 2: Create app/calendar/reservation-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Reservation } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  car_id: z.number({ required_error: "Kies een wagen" }),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Reservation>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function ReservationForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const today = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: today, end_date: today, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-2">Wagen *</label>
        <Controller name="car_id" control={control}
          render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Naam *</label>
        <Controller name="person_id" control={control}
          render={({ field }) => <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Van *</label>
          <input {...register("start_date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tot *</label>
          <input {...register("end_date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create app/calendar/page.tsx**

FullCalendar must be loaded as a client component. Reservations map to FullCalendar events with red background.

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { ReservationForm } from "./reservation-form";
import { useReservations, useCreateReservation, useUpdateReservation, useDeleteReservation } from "@/hooks/use-reservations";
import type { Reservation } from "@/types";

// FullCalendar must be client-only (no SSR)
const FullCalendarWrapper = dynamic(() => import("./full-calendar-wrapper"), { ssr: false });

export default function CalendarPage() {
  const { data: reservations = [], isLoading } = useReservations();
  const createR = useCreateReservation();
  const updateR = useUpdateReservation();
  const deleteR = useDeleteReservation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const events = reservations.map((r) => ({
    id: String(r.id),
    title: `${r.car_short} - ${r.person_name}`,
    start: r.start_date,
    end: r.end_date,
    backgroundColor: "#c0392b",
    borderColor: "#c0392b",
    extendedProps: { reservation: r },
  }));

  return (
    <>
      <PageHeader title="Calendar" />
      <div className="p-2">
        {!isLoading && (
          <FullCalendarWrapper
            events={events}
            onEventClick={(info: any) => {
              setEditing(info.event.extendedProps.reservation);
            }}
          />
        )}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Reservering toevoegen</Dialog.Title>
            <ReservationForm
              onSubmit={(d) => createR.mutate(d, { onSuccess: () => { setAdding(false); toast.success("Reservering opgeslagen"); } })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Reservering bewerken</Dialog.Title>
            {editing && (
              <>
                <ReservationForm defaultValues={editing}
                  onSubmit={(d) => updateR.mutate({ id: editing.id, ...d }, { onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); } })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteR.mutate(editing.id, { onSuccess: () => { setEditing(null); toast.success("Verwijderd"); } })}
                    className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">Verwijderen</button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Reservering toevoegen" />
    </>
  );
}
```

- [ ] **Step 4: Create app/calendar/full-calendar-wrapper.tsx**

```tsx
"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

interface Props {
  events: any[];
  onEventClick: (info: any) => void;
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

- [ ] **Step 5: Verify in browser**

Navigate to http://localhost:3000/calendar. Month view shows. FAB opens reservation form. Clicking an event opens edit dialog.

- [ ] **Step 6: Commit**

```bash
git add lib/queries/reservations.ts app/api/reservations/ hooks/use-reservations.ts app/calendar/
git commit -m "feat: calendar with reservations and FullCalendar"
```

---

### Task 3: Dashboard API

**Files:**
- Create: `lib/queries/dashboard.ts`
- Create: `app/api/dashboard/route.ts`

- [ ] **Step 1: Create lib/queries/dashboard.ts**

```ts
import type Database from "better-sqlite3";
import type { DashboardRow } from "@/types";

export function getDashboard(db: Database.Database, year: number): DashboardRow[] {
  const people = db.prepare("SELECT id, name FROM people ORDER BY name").all() as { id: number; name: string }[];

  return people.map((person) => {
    const ritten = db.prepare(`
      SELECT COUNT(*) AS aantal, COALESCE(SUM(km),0) AS km, COALESCE(SUM(bedrag),0) AS bedrag
      FROM ritten
      WHERE person_id=? AND strftime('%Y', datum)=?
    `).get(person.id, String(year)) as any;

    const tank = db.prepare(`
      SELECT COUNT(*) AS aantal, COALESCE(SUM(liter),0) AS liter, COALESCE(SUM(bedrag),0) AS bedrag
      FROM tankbeurten
      WHERE person_id=? AND strftime('%Y', datum)=?
    `).get(person.id, String(year)) as any;

    const kost = db.prepare(`
      SELECT COALESCE(SUM(bedrag),0) AS bedrag
      FROM kosten
      WHERE person_id=? AND strftime('%Y', datum)=?
    `).get(person.id, String(year)) as any;

    const betaald = db.prepare(`
      SELECT COALESCE(SUM(bedrag),0) AS bedrag
      FROM betaald
      WHERE person_id=? AND year=?
    `).get(person.id, year) as any;

    const rit_bedrag = -(ritten.bedrag);   // cost charged (negative)
    const tank_bedrag = tank.bedrag;        // fuel paid (positive)
    const kost_bedrag = kost.bedrag;        // extra costs paid (positive)
    const betaald_bedrag = betaald.bedrag;  // settlement payments
    const totaal_bedrag = rit_bedrag + tank_bedrag + kost_bedrag;
    const saldo_bedrag = totaal_bedrag + betaald_bedrag;

    return {
      person_id: person.id,
      person_name: person.name,
      year,
      rit_aantal: ritten.aantal,
      rit_km: ritten.km,
      tank_aantal: tank.aantal,
      tank_liter: tank.liter,
      rit_bedrag,
      tank_bedrag,
      kost_bedrag,
      totaal_bedrag,
      betaald_bedrag,
      saldo_bedrag,
    };
  });
}
```

- [ ] **Step 2: Write test for getDashboard**

Append to `lib/__tests__/queries.test.ts`:
```ts
import { getDashboard } from "../queries/dashboard";
import { insertRit } from "../queries/ritten";
import { insertTankbeurt } from "../queries/tankbeurten";

describe("getDashboard", () => {
  it("returns zero saldo for person with no activity", () => {
    const db = makeDb();
    insertPerson(db, { name: "Test", korting: 0, korting_long: 0, active: 1 });
    const rows = getDashboard(db, 2026);
    expect(rows[0].saldo_bedrag).toBe(0);
  });

  it("computes negative saldo when rit cost exceeds payments", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "Roeland", korting: 0, korting_long: 0, active: 1 });
    const cid = insertCar(db, { short: "LEW", name: "Lewis", prijs: 0.25, merk: null, kleur: null });
    // 100km trip costs 25.00
    insertRit(db, { person_id: pid, car_id: cid, datum: "2026-01-10", start: 0, eind: 100, locatie: null });
    const rows = getDashboard(db, 2026);
    // rit_bedrag = -25, no fuel/kosten/betaald → saldo = -25
    expect(rows[0].saldo_bedrag).toBeCloseTo(-25);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test lib/__tests__/
```
Expected: all PASS.

- [ ] **Step 4: Create app/api/dashboard/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDashboard } from "@/lib/queries/dashboard";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  return NextResponse.json(getDashboard(getDb(), year));
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/queries/dashboard.ts app/api/dashboard/ lib/__tests__/queries.test.ts
git commit -m "feat: dashboard query with balance calculation and tests"
```

---

### Task 4: Dashboard page

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
    queryFn: () => fetch(`/api/dashboard?year=${year}`).then((r) => r.json()),
  });
}
```

- [ ] **Step 2: Replace app/page.tsx with full dashboard**

```tsx
"use client";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useDashboard } from "@/hooks/use-dashboard";
import { ChevronLeft, ChevronRight } from "lucide-react";

function saldoColor(saldo: number) {
  if (saldo > 0.005) return "text-green-600";
  if (saldo < -0.005) return "text-red-600";
  return "text-gray-400";
}

function saldoDot(saldo: number) {
  if (saldo > 0.005) return "bg-green-500";
  if (saldo < -0.005) return "bg-red-500";
  return "bg-gray-300";
}

function saldoMessage(saldo: number): string {
  if (Math.abs(saldo) < 0.005) return "vereffend";
  if (saldo > 0) return `Je krijgt €${saldo.toFixed(2)}`;
  return `Je bent €${Math.abs(saldo).toFixed(2)} verschuldigd`;
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: rows = [], isLoading } = useDashboard(year);

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <p className="p-4 text-gray-500">Laden...</p>
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.person_id} className="flex items-center px-4 py-3 gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${saldoDot(row.saldo_bedrag)}`} />
              <span className={`flex-1 text-sm font-medium ${row.saldo_bedrag !== 0 ? saldoColor(row.saldo_bedrag) : "text-gray-500"}`}>
                {row.person_name}
              </span>
              <div className="text-right">
                <p className={`text-sm font-mono font-medium ${saldoColor(row.saldo_bedrag)}`}>
                  € {row.saldo_bedrag.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">{saldoMessage(row.saldo_bedrag)}</p>
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

Navigate to http://localhost:3000. Dashboard shows all people with green/red/grey saldo. Year navigation works.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-dashboard.ts app/page.tsx
git commit -m "feat: dashboard page with balance per person and year navigation"
```
