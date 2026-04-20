# CarSharing — Plan 06: Trips (Kilometers)

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisite:** plans 01–05, 00, and 03b (i18n module) completed.

**Goal:** Query helpers, API routes, list page, and add/edit form for trips — including `amount` auto-calculation, Leaflet GPS location picker, and car-aware field prefilling (start odometer + location filled from the car's last known state when the user picks a car).

**Architecture:** `lib/queries/trips.ts` computes `km` and `amount` before insert using `calcTripAmount` from `lib/formulas.ts`. The form auto-calculates amount client-side as the user enters start/end odometer. Leaflet is imported dynamically (SSR-safe); its stylesheet is loaded once in `app/layout.tsx`. A shared `getLastCarState` query (see Task 2b) unions the most recent odometer/location across `trips` and `fuel_fillups` so both the trip form (this plan) and the fuel form (plan-07) can prefill fields consistently. User-facing strings resolve through `t()` from `@/lib/i18n` (plan-03b).

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

### Task 2b: Car "last state" query, API, and hook

Both the trip form (this plan, Task 4) and the fuel form (plan-07, Task 6) need to answer the same question when the user selects a car: *"what was the last known odometer reading and location for this car?"* We answer it once here with a single query that unions the most recent rows from `trips` and `fuel_fillups`, and expose it via a dedicated endpoint + TanStack Query hook. No caller caches per-car state client-side; the hook is enabled only when `carId` is truthy.

**Files:**
- Create: `lib/queries/car-state.ts`
- Create: `app/api/cars/[id]/last-state/route.ts`
- Create: `hooks/use-car-state.ts`
- Modify: `lib/__tests__/queries.test.ts`

- [ ] **Step 1: Create lib/queries/car-state.ts**

```ts
import type Database from "better-sqlite3";
import type { CarState } from "@/types";

interface Row {
  odometer: number | null;
  location: string | null;
  source: "trip" | "fuel";
  // sort keys — date first, then synthetic "source priority" so a trip and a fuel
  // with the same date resolve to the trip (trip end_odometer reflects the car
  // state AFTER the fill-up would be recorded against it), then id as a tiebreaker.
  date: string;
  source_priority: number;
  id: number;
}

export function getLastCarState(db: Database.Database, carId: number): CarState | null {
  const row = db
    .prepare(
      `
      SELECT odometer, location, source, date, source_priority, id FROM (
        SELECT end_odometer AS odometer, location, 'trip' AS source,
               date, 1 AS source_priority, id
        FROM trips
        WHERE car_id = ?
        UNION ALL
        SELECT odometer, location, 'fuel' AS source,
               date, 0 AS source_priority, id
        FROM fuel_fillups
        WHERE car_id = ? AND odometer IS NOT NULL
      )
      ORDER BY date DESC, source_priority DESC, id DESC
      LIMIT 1
      `
    )
    .get(carId, carId) as Row | undefined;

  if (!row) return null;
  return { odometer: row.odometer, location: row.location, source: row.source };
}
```

- [ ] **Step 2: Append tests to lib/__tests__/queries.test.ts**

```ts
import { getLastCarState } from "../queries/car-state";
import { insertFuelFillup } from "../queries/fuel-fillups";

describe("getLastCarState", () => {
  it("returns null when the car has no trips or fill-ups", () => {
    const db = makeDb();
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    expect(getLastCarState(db, cid)).toBeNull();
  });

  it("returns the last trip's end_odometer when trips exist", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: "51.0,4.4" });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-10", start_odometer: 150, end_odometer: 200, location: "51.1,4.5" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 200, location: "51.1,4.5", source: "trip" });
  });

  it("prefers a later fuel fill-up over an earlier trip", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: null });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-05", amount: 50, liters: 30, odometer: 180, receipt: null, location: "station" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 180, location: "station", source: "fuel" });
  });

  it("ignores fuel fill-ups where odometer is null", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-01", start_odometer: 100, end_odometer: 150, location: "loc-trip" });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-05", amount: 50, liters: 30, odometer: null, receipt: null, location: "loc-fuel" });
    // Fuel has null odometer → trip still wins on odometer
    expect(getLastCarState(db, cid)).toEqual({ odometer: 150, location: "loc-trip", source: "trip" });
  });

  it("prefers trip over fuel when both share the same date", () => {
    const db = makeDb();
    const pid = insertPerson(db, { name: "P", discount: 0, discount_long: 0, active: 1 });
    const cid = insertCar(db, { short: "A", name: "A", price_per_km: 0.25, brand: null, color: null });
    insertFuelFillup(db, { person_id: pid, car_id: cid, date: "2026-04-10", amount: 50, liters: 30, odometer: 175, receipt: null, location: "station" });
    insertTrip(db, { person_id: pid, car_id: cid, date: "2026-04-10", start_odometer: 175, end_odometer: 225, location: "parked" });
    expect(getLastCarState(db, cid)).toEqual({ odometer: 225, location: "parked", source: "trip" });
  });
});
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npm test lib/__tests__/queries.test.ts
```

- [ ] **Step 4: Create app/api/cars/[id]/last-state/route.ts**

```ts
import { getDb } from "@/lib/db";
import { getLastCarState } from "@/lib/queries/car-state";
import { json, readId } from "@/lib/api";

export const GET = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const carId = await readId(ctx);
  // Returning null is fine — the hook treats a missing state as "no prefill".
  return getLastCarState(getDb(), carId);
});
```

- [ ] **Step 5: Create hooks/use-car-state.ts**

```ts
import { useQuery } from "@tanstack/react-query";
import type { CarState } from "@/types";

export function useLastCarState(carId: number | undefined) {
  return useQuery<CarState | null>({
    queryKey: ["car-state", carId],
    enabled: Boolean(carId),
    queryFn: async () => {
      const res = await fetch(`/api/cars/${carId}/last-state`);
      if (!res.ok) throw new Error("Failed to load car state");
      return res.json();
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/queries/car-state.ts app/api/cars/[id]/ hooks/use-car-state.ts lib/__tests__/queries.test.ts
git commit -m "feat: car last-state query, API route, and hook"
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
  // Creating/updating/deleting a trip changes the car's "last state",
  // so invalidate all per-car state caches (the prefix match in React Query
  // covers every ["car-state", carId] entry).
  invalidate: [["dashboard"], ["car-state"]],
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
import { t } from "@/lib/i18n";

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
          placeholder={t("form.location_placeholder")}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-gray-50"
        />
        <button type="button" onClick={captureGPS} className="p-2 border rounded-md hover:bg-gray-50">
          <MapPin className={`w-4 h-4 ${status === "loading" ? "animate-pulse text-blue-500" : "text-gray-600"}`} />
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-500">{t("error.gps_unavailable")}</p>}
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
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { LocationPicker } from "@/components/location-picker";
import { calcTripAmount } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import type { Trip } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  car_id: z.number({ required_error: t("validation.car_required") }),
  date: z.string().min(1),
  start_odometer: z.coerce.number().int().min(0),
  end_odometer: z.coerce.number().int().min(0),
  location: z.string().nullable().optional(),
}).refine((d) => d.end_odometer >= d.start_odometer, {
  path: ["end_odometer"],
  message: t("validation.end_gte_start"),
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
  // "Add" mode when no row id was passed in. In add mode we prefill fields
  // from the car's last known state; in edit mode we leave the existing row alone.
  const isAddMode = !defaultValues?.id;
  const { register, handleSubmit, control, watch, setValue, getValues, formState: { errors } } = useForm<FormData>({
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

  // Last known state for the selected car — null until a car is picked and
  // the request resolves. The hook is disabled when carId is undefined.
  const { data: lastState } = useLastCarState(carId);

  // If end_odometer is still zero/empty, keep it aligned with start.
  // Used by both the car-change prefill (below) and the start-odometer blur handler.
  const maybePrefillEnd = (startVal: number) => {
    const current = getValues("end_odometer");
    if (!current || Number(current) === 0) setValue("end_odometer", startVal);
  };

  // Prefill start_odometer and location from the car's last state when the
  // user picks a car. Only fires in add mode. Picking a different car
  // intentionally overwrites any manual edits — the previous values
  // belonged to a different car.
  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    if (lastState.odometer != null) {
      setValue("start_odometer", lastState.odometer);
      maybePrefillEnd(lastState.odometer);
    }
    if (lastState.location) setValue("location", lastState.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastState, carId, isAddMode]);

  const startReg = register("start_odometer");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-2">{t("form.car")}</label>
        <Controller name="car_id" control={control}
          render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller name="person_id" control={control}
          render={({ field }) => (
            <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.date")}</label>
        <input {...register("date")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.start_odometer")}</label>
          <input
            {...startReg}
            type="number"
            className="w-full border rounded-md px-3 py-2 text-sm"
            onBlur={(e) => {
              // Call RHF's own onBlur first so validation/dirty tracking still runs.
              startReg.onBlur(e);
              maybePrefillEnd(Number(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.end_odometer")}</label>
          <input {...register("end_odometer")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
          {errors.end_odometer && <p className="text-red-500 text-xs mt-1">{errors.end_odometer.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.km")}</label>
          <input readOnly value={km} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.amount")}</label>
          <input readOnly value={amount.toFixed(2)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.location")}</label>
        <Controller name="location" control={control}
          render={({ field }) => <LocationPicker value={field.value ?? null} onChange={field.onChange} />}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">{t("action.cancel")}</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">{t("action.save")}</button>
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
import { t } from "@/lib/i18n";

export default function TripsPage() {
  const { data: trips = [], isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  if (isLoading) return <><PageHeader title={t("page.trips")} /><p className="p-4 text-gray-500">{t("state.loading")}</p></>;

  return (
    <>
      <PageHeader title={t("page.trips")} />
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
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.trip_add")}</Dialog.Title>
            <TripForm
              onSubmit={(data) => createTrip.mutate(data as any, {
                onSuccess: () => { setAdding(false); toast.success(t("toast.trip_saved")); },
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
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">{t("page.trip_edit")}</Dialog.Title>
            {editing && (
              <>
                <TripForm
                  defaultValues={editing}
                  onSubmit={(data) => updateTrip.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.saved")); },
                    onError: (e) => toast.error(e.message),
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteTrip.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success(t("toast.trip_deleted")); },
                    onError: (e) => toast.error(e.message),
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    {t("action.delete")}
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label={t("page.trip_add")} />
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to http://localhost:3000/trips. Checks:
1. Open "Rit toevoegen". Pick a car that has prior trips/fill-ups — `Start` and `Locatie` auto-fill from the car's last known state; the map pin moves to that location.
2. Clear the odometers, type a value into `Start`, tab out — `Eind` fills to the same number because it was empty.
3. Type a larger value into `Eind` — `KM` and `Bedrag` recompute live.
4. Change the car selection — `Start`/`Locatie` refill from the new car's state, overwriting whatever was there.
5. Save. Open an existing trip — prefill does not fire and the stored values are preserved.
6. GPS button captures current location. Map shows pin.

- [ ] **Step 4: Commit**

```bash
git add app/trips/ hooks/use-trips.ts
git commit -m "feat: trips list page, form with GPS and auto-calculation"
```
