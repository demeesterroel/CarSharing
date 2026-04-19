# CarSharing — Plan 06: Ritten (Kilometers)

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Query helpers, API routes, list page, and add/edit form for ritten — including bedrag auto-calculation and Leaflet GPS location picker.

**Architecture:** `lib/queries/ritten.ts` computes `km` and `bedrag` before insert using `calcBedrag` from `lib/formulas.ts`. The form auto-calculates bedrag client-side as user enters start/eind. Leaflet loads dynamically (SSR-safe).

---

### Task 1: Ritten query helpers

**Files:**
- Create: `lib/queries/ritten.ts`

- [ ] **Step 1: Create lib/queries/ritten.ts**

```ts
import type Database from "better-sqlite3";
import type { Rit, RitInput } from "@/types";
import { calcBedrag } from "@/lib/formulas";

export function getRitten(db: Database.Database): Rit[] {
  return db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM ritten r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    ORDER BY r.datum DESC, r.id DESC
  `).all() as Rit[];
}

export function getRitById(db: Database.Database, id: number): Rit | null {
  return (db.prepare(`
    SELECT r.*, p.name AS person_name, c.short AS car_short
    FROM ritten r
    JOIN people p ON p.id = r.person_id
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = ?
  `).get(id) as Rit) ?? null;
}

export function insertRit(db: Database.Database, input: RitInput): number {
  const person = db.prepare("SELECT korting, korting_long FROM people WHERE id=?").get(input.person_id) as any;
  const car = db.prepare("SELECT prijs FROM cars WHERE id=?").get(input.car_id) as any;
  const km = input.eind - input.start;
  const bedrag = calcBedrag(km, car.prijs, person.korting, person.korting_long);
  const result = db.prepare(`
    INSERT INTO ritten (person_id,car_id,datum,start,eind,km,bedrag,locatie)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(input.person_id, input.car_id, input.datum, input.start, input.eind, km, bedrag, input.locatie ?? null);
  return result.lastInsertRowid as number;
}

export function updateRit(db: Database.Database, id: number, input: RitInput): void {
  const person = db.prepare("SELECT korting, korting_long FROM people WHERE id=?").get(input.person_id) as any;
  const car = db.prepare("SELECT prijs FROM cars WHERE id=?").get(input.car_id) as any;
  const km = input.eind - input.start;
  const bedrag = calcBedrag(km, car.prijs, person.korting, person.korting_long);
  db.prepare(`
    UPDATE ritten SET person_id=?,car_id=?,datum=?,start=?,eind=?,km=?,bedrag=?,locatie=? WHERE id=?
  `).run(input.person_id, input.car_id, input.datum, input.start, input.eind, km, bedrag, input.locatie ?? null, id);
}

export function deleteRit(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM ritten WHERE id=?").run(id);
}
```

- [ ] **Step 2: Write test**

Append to `lib/__tests__/queries.test.ts`:
```ts
import { insertRit, getRitten } from "../queries/ritten";
import { insertPerson } from "../queries/people";
import { insertCar } from "../queries/cars";

describe("ritten queries", () => {
  it("inserts a rit and computes km and bedrag", () => {
    const db = makeDb(); // from earlier describe block — copy makeDb() here
    const pid = insertPerson(db, { name: "Roeland", korting: 0, korting_long: 0, active: 1 });
    const cid = insertCar(db, { short: "LEW", name: "Lewis", prijs: 0.25, merk: null, kleur: null });
    insertRit(db, { person_id: pid, car_id: cid, datum: "2026-04-18", start: 233900, eind: 241929, locatie: null });
    const ritten = getRitten(db);
    expect(ritten[0].km).toBe(8029);
    expect(ritten[0].bedrag).toBeCloseTo(2007.25);
  });
});
```

Note: `makeDb` must be defined at the describe-block level. Copy this helper at the top of the test file:
```ts
function makeDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}
```

- [ ] **Step 3: Run test — expect PASS**

```bash
npm test lib/__tests__/queries.test.ts
```
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/ritten.ts lib/__tests__/queries.test.ts
git commit -m "feat: ritten query helpers with bedrag calculation"
```

---

### Task 2: Ritten API routes

**Files:**
- Create: `app/api/ritten/route.ts`
- Create: `app/api/ritten/[id]/route.ts`

- [ ] **Step 1: Create app/api/ritten/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRitten, insertRit } from "@/lib/queries/ritten";

export async function GET() {
  return NextResponse.json(getRitten(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertRit(getDb(), {
    person_id: body.person_id,
    car_id: body.car_id,
    datum: body.datum,
    start: body.start,
    eind: body.eind,
    locatie: body.locatie ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create app/api/ritten/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRitById, updateRit, deleteRit } from "@/lib/queries/ritten";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const rit = getRitById(getDb(), Number(params.id));
  if (!rit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rit);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateRit(getDb(), Number(params.id), {
    person_id: body.person_id,
    car_id: body.car_id,
    datum: body.datum,
    start: body.start,
    eind: body.eind,
    locatie: body.locatie ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteRit(getDb(), Number(params.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/ritten/
git commit -m "feat: ritten API routes GET/POST/PUT/DELETE"
```

---

### Task 3: Ritten hook & location picker

**Files:**
- Create: `hooks/use-ritten.ts`
- Create: `components/location-picker.tsx`

- [ ] **Step 1: Create hooks/use-ritten.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Rit, RitInput } from "@/types";

export function useRitten() {
  return useQuery<Rit[]>({
    queryKey: ["ritten"],
    queryFn: () => fetch("/api/ritten").then((r) => r.json()),
  });
}

export function useCreateRit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RitInput) =>
      fetch("/api/ritten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ritten"] }),
  });
}

export function useUpdateRit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: RitInput & { id: number }) =>
      fetch(`/api/ritten/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ritten"] }),
  });
}

export function useDeleteRit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/ritten/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ritten"] }),
  });
}
```

- [ ] **Step 2: Create components/location-picker.tsx**

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
    import("leaflet").then((L) => {
      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const coords = value ? value.split(",").map(Number) : [51.05, 4.45];
      const map = L.map(mapRef.current!).setView(coords as [number,number], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      if (value) {
        markerRef.current = L.marker(coords as [number,number]).addTo(map);
      }
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        onChange(coordStr);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng]).addTo(map);
      });
      mapInstance.current = map;
    });
    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  const captureGPS = () => {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coordStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        onChange(coordStr);
        setStatus("idle");
        if (mapInstance.current) {
          const [lat, lng] = coordStr.split(",").map(Number);
          mapInstance.current.setView([lat, lng], 15);
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          else {
            import("leaflet").then((L) => {
              markerRef.current = L.marker([lat, lng]).addTo(mapInstance.current);
            });
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
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="h-48 rounded-md border" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-ritten.ts components/location-picker.tsx
git commit -m "feat: ritten hook and GPS location picker"
```

---

### Task 4: Ritten list page & form

**Files:**
- Create: `app/ritten/page.tsx`
- Create: `app/ritten/rit-form.tsx`

- [ ] **Step 1: Create app/ritten/rit-form.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { LocationPicker } from "@/components/location-picker";
import { calcBedrag } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Rit } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  car_id: z.number({ required_error: "Kies een wagen" }),
  datum: z.string().min(1),
  start: z.coerce.number().int().min(0),
  eind: z.coerce.number().int().min(0),
  locatie: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Rit>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function RitForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      datum: new Date().toISOString().slice(0, 10),
      start: 0, eind: 0, locatie: null,
      ...defaultValues,
    },
  });

  const [start, eind, personId, carId] = watch(["start", "eind", "person_id", "car_id"]);
  const km = Math.max(0, (eind ?? 0) - (start ?? 0));
  const person = people.find((p) => p.id === personId);
  const car = cars.find((c) => c.id === carId);
  const bedrag = person && car ? calcBedrag(km, car.prijs, person.korting, person.korting_long) : 0;

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
        <input {...register("datum")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Start *</label>
          <input {...register("start")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Eind *</label>
          <input {...register("eind")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">KM</label>
          <input readOnly value={km} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bedrag</label>
          <input readOnly value={bedrag.toFixed(2)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Locatie</label>
        <Controller name="locatie" control={control}
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

- [ ] **Step 2: Create app/ritten/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { RitForm } from "./rit-form";
import { useRitten, useCreateRit, useUpdateRit, useDeleteRit } from "@/hooks/use-ritten";
import type { Rit } from "@/types";
import { MapPin, ChevronRight } from "lucide-react";

function yearMonth(datum: string) {
  const [y, m] = datum.split("-");
  return `${y}-${m}`;
}

export default function RittenPage() {
  const { data: ritten = [], isLoading } = useRitten();
  const createRit = useCreateRit();
  const updateRit = useUpdateRit();
  const deleteRit = useDeleteRit();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Rit | null>(null);

  if (isLoading) return <><PageHeader title="Kilometers" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Kilometers" />
      <GroupedList
        items={ritten}
        getKey={(r) => yearMonth(r.datum)}
        getGroupLabel={(key) => {
          const [y, m] = key.split("-");
          return `${y}-${Number(m)}`;
        }}
        getGroupTotal={(items) => items.reduce((s, r) => s + r.km, 0)}
        renderItem={(r) => (
          <button key={r.id} onClick={() => setEditing(r)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{r.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{r.datum}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{r.km} km</span>
                <span className="text-xs text-gray-400">{r.start} → {r.eind}</span>
                <span className="text-sm font-medium ml-auto">€ {r.bedrag.toFixed(2)}</span>
              </div>
            </div>
            {r.locatie && <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Rit toevoegen</Dialog.Title>
            <RitForm
              onSubmit={(data) => createRit.mutate(data as any, {
                onSuccess: () => { setAdding(false); toast.success("Rit opgeslagen"); },
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
                <RitForm
                  defaultValues={editing}
                  onSubmit={(data) => updateRit.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); },
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteRit.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success("Rit verwijderd"); },
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

Navigate to http://localhost:3000/ritten. Add a rit — verify KM and Bedrag auto-calculate. GPS button captures location. Map shows pin.

- [ ] **Step 4: Commit**

```bash
git add app/ritten/ hooks/use-ritten.ts
git commit -m "feat: ritten list page, form with GPS and auto-calculation"
```
