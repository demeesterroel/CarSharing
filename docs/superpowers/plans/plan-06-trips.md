# CarSharing — Plan 06: Trips (Kilometers)

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisite:** plans 01–05 and 00 completed.

**Goal:** Query helpers, API routes, list page, and add/edit form for trips — including `amount` auto-calculation and Leaflet GPS location picker.

**Architecture:** `lib/queries/trips.ts` computes `km` and `amount` before insert using `calcTripAmount` from `lib/formulas.ts`. The form auto-calculates amount client-side as the user enters start/end odometer. Leaflet is imported dynamically (SSR-safe); its stylesheet is loaded once in `app/layout.tsx`.

---

### Task 1: Trips query helpers

**Files:**
- Create: `lib/queries/trips.ts`

- [ ] **Step 1: Create lib/queries/trips.ts**

```ts
import type Database from "better-sqlite3";
import type { Trip, TripInput } from "@/types";
import { calcTripAmount } from "@/lib/formulas";

export function getTrips(db: Database.Database): Trip[] {
  return db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    ORDER BY t.date DESC, t.id DESC
  `).all() as Trip[];
}

export function getTripById(db: Database.Database, id: number): Trip | null {
  return (db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM trips t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    WHERE t.id = ?
  `).get(id) as Trip) ?? null;
}

function compute(db: Database.Database, input: TripInput) {
  const person = db.prepare("SELECT discount, discount_long FROM people WHERE id=?")
    .get(input.person_id) as { discount: number; discount_long: number } | undefined;
  const car = db.prepare("SELECT price_per_km FROM cars WHERE id=?")
    .get(input.car_id) as { price_per_km: number } | undefined;
  if (!person || !car) throw new Error("Invalid person_id or car_id");
  const km = input.end_odometer - input.start_odometer;
  const amount = calcTripAmount(km, car.price_per_km, person.discount, person.discount_long);
  return { km, amount };
}

export function insertTrip(db: Database.Database, input: TripInput): number {
  const { km, amount } = compute(db, input);
  const result = db.prepare(`
    INSERT INTO trips (person_id,car_id,date,start_odometer,end_odometer,km,amount,location)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.start_odometer, input.end_odometer, km, amount,
    input.location ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateTrip(db: Database.Database, id: number, input: TripInput): void {
  const { km, amount } = compute(db, input);
  db.prepare(`
    UPDATE trips SET person_id=?,car_id=?,date=?,start_odometer=?,end_odometer=?,km=?,amount=?,location=? WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date,
    input.start_odometer, input.end_odometer, km, amount,
    input.location ?? null, id
  );
}

export function deleteTrip(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM trips WHERE id=?").run(id);
}
```

- [ ] **Step 2: Append test to lib/__tests__/queries.test.ts**

```ts
import { insertTrip, getTrips } from "../queries/trips";

describe("trips queries", () => {
  it("inserts a trip and computes km and amount", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "Roeland", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, { short: "LEW", name: "Lewis", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-18", start_odometer: 233900, end_odometer: 241929, location: null });
    const trips = getTrips(db);
    expect(trips[0].km).toBe(8029);
    expect(trips[0].amount).toBeCloseTo(2007.25);
  });
});
```

- [ ] **Step 3: Run test — expect PASS**

```bash
npm test lib/__tests__/queries.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/queries/trips.ts lib/__tests__/queries.test.ts
git commit -m "feat: trips query helpers with amount calculation"
```

---

### Task 2: Trips API routes

**Files:**
- Create: `app/api/trips/route.ts`
- Create: `app/api/trips/[id]/route.ts`

- [ ] **Step 1: Create app/api/trips/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getTrips, insertTrip } from "@/lib/queries/trips";
import { json, readBody } from "@/lib/api";

const TripSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_odometer: z.number().int().nonnegative(),
  end_odometer: z.number().int().nonnegative(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getTrips(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, TripSchema);
  const id = insertTrip(getDb(), data);
  return Response.json({ id }, { status: 201 });
});
```

- [ ] **Step 2: Create app/api/trips/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getTripById, updateTrip, deleteTrip } from "@/lib/queries/trips";
import { json, readBody, readId, notFound } from "@/lib/api";

const TripSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_odometer: z.number().int().nonnegative(),
  end_odometer: z.number().int().nonnegative(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const trip = getTripById(getDb(), await readId(ctx));
  if (!trip) notFound();
  return trip;
});

export const PUT = json(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = await readId(ctx);
  const data = await readBody(req, TripSchema);
  updateTrip(getDb(), id, data);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  deleteTrip(getDb(), await readId(ctx));
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/trips/
git commit -m "feat: trips API routes with zod validation"
```

---

### Task 3: Trips hook & location picker

**Files:**
- Create: `hooks/use-trips.ts`
- Create: `components/location-picker.tsx`

- [ ] **Step 1: Create hooks/use-trips.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Trip, TripInput } from "@/types";

const hooks = createResourceHooks<Trip, TripInput>("trips", "/api/trips", {
  invalidate: [["dashboard"]],
});
export const useTrips = hooks.useList;
export const useCreateTrip = hooks.useCreate;
export const useUpdateTrip = hooks.useUpdate;
export const useDeleteTrip = hooks.useDelete;
```

- [ ] **Step 2: Create components/location-picker.tsx**

The Leaflet stylesheet is already loaded globally from `app/layout.tsx` (plan-01) — this component only renders the map container.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

interface Props {
  value: string | null;
  onChange: (coords: string) => void;
}

export function LocationPicker({ value, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle"|"loading"|"error">("idle");

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const coords: [number, number] = value
        ? (value.split(",").map(Number) as [number, number])
        : [51.05, 4.45];
      const map = L.map(mapRef.current).setView(coords, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      if (value) markerRef.current = L.marker(coords).addTo(map);

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange(coordStr);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng]).addTo(map);
      });

      mapInstance.current = map;
    })();

    return () => {
      cancelled = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureGPS = () => {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coordStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        onChange(coordStr);
        setStatus("idle");
        if (mapInstance.current) {
          const [lat, lng] = coordStr.split(",").map(Number);
          mapInstance.current.setView([lat, lng], 15);
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          else {
            const L = await import("leaflet");
            markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current);
          }
        }
      },
      () => setStatus("error")
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value ?? ""}
          placeholder="Klik op kaart of gebruik GPS"
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-gray-50"
        />
        <button type="button" onClick={captureGPS} className="p-2 border rounded-md hover:bg-gray-50">
          <MapPin className={`w-4 h-4 ${status === "loading" ? "animate-pulse text-blue-500" : "text-gray-600"}`} />
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-500">GPS niet beschikbaar</p>}
      <div ref={mapRef} className="h-48 rounded-md border" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-trips.ts components/location-picker.tsx
git commit -m "feat: trips hook and GPS location picker"
```

---

### Task 4: Trips list page & form

**Files:**
- Create: `app/trips/page.tsx`
- Create: `app/trips/trip-form.tsx`

- [ ] **Step 1: Create app/trips/trip-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { LocationPicker } from "@/components/location-picker";
import { calcTripAmount } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Trip } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  car_id: z.number({ required_error: "Kies een wagen" }),
  date: z.string().min(1),
  start_odometer: z.coerce.number().int().min(0),
  end_odometer: z.coerce.number().int().min(0),
  location: z.string().nullable().optional(),
}).refine((d) => d.end_odometer >= d.start_odometer, {
  path: ["end_odometer"],
  message: "Eind moet ≥ start zijn",
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Trip>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function TripForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      start_odometer: 0, end_odometer: 0, location: null,
      ...defaultValues,
    },
  });

  const [start, end, personId, carId] = watch(["start_odometer", "end_odometer", "person_id", "car_id"]);
  const km = Math.max(0, (end ?? 0) - (start ?? 0));
  const person = people.find((p) => p.id === personId);
  const car = cars.find((c) => c.id === carId);
  const amount = person && car ? calcTripAmount(km, car.price_per_km, person.discount, person.discount_long) : 0;

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
          render={({ field }) => (
            <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Datum *</label>
        <input {...register("date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Start *</label>
          <input {...register("start_odometer")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Eind *</label>
          <input {...register("end_odometer")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
          {errors.end_odometer && <p className="text-red-500 text-xs mt-1">{errors.end_odometer.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">KM</label>
          <input readOnly value={km} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bedrag</label>
          <input readOnly value={amount.toFixed(2)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Locatie</label>
        <Controller name="location" control={control}
          render={({ field }) => <LocationPicker value={field.value ?? null} onChange={field.onChange} />}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create app/trips/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { TripForm } from "./trip-form";
import { useTrips, useCreateTrip, useUpdateTrip, useDeleteTrip } from "@/hooks/use-trips";
import type { Trip } from "@/types";
import { MapPin, ChevronRight } from "lucide-react";

export default function TripsPage() {
  const { data: trips = [], isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  if (isLoading) return <><PageHeader title="Kilometers" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Kilometers" />
      <GroupedList
        items={trips}
        getKey={(t) => t.date.slice(0, 7)}
        getGroupLabel={(key) => { const [y, m] = key.split("-"); return `${y}-${Number(m)}`; }}
        getGroupTotal={(items) => items.reduce((s, t) => s + t.km, 0)}
        renderItem={(t) => (
          <button key={t.id} onClick={() => setEditing(t)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{t.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{t.date}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{t.km} km</span>
                <span className="text-xs text-gray-400">{t.start_odometer} → {t.end_odometer}</span>
                <span className="text-sm font-medium ml-auto">€ {t.amount.toFixed(2)}</span>
              </div>
            </div>
            {t.location && <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Rit toevoegen</Dialog.Title>
            <TripForm
              onSubmit={(data) => createTrip.mutate(data as any, {
                onSuccess: () => { setAdding(false); toast.success("Rit opgeslagen"); },
                onError: (e) => toast.error(e.message),
              })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Rit bewerken</Dialog.Title>
            {editing && (
              <>
                <TripForm
                  defaultValues={editing}
                  onSubmit={(data) => updateTrip.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); },
                    onError: (e) => toast.error(e.message),
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteTrip.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success("Rit verwijderd"); },
                    onError: (e) => toast.error(e.message),
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    Verwijderen
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Rit toevoegen" />
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to http://localhost:3000/trips. Add a trip — verify KM and Bedrag auto-calculate. GPS button captures location. Map shows pin.

- [ ] **Step 4: Commit**

```bash
git add app/trips/ hooks/use-trips.ts
git commit -m "feat: trips list page, form with GPS and auto-calculation"
```
