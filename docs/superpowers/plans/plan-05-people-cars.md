# CarSharing — Plan 05: People & Cars

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** API routes and pages for People and Cars — list, add, edit.

**Architecture:** Next.js API routes in `app/api/` handle CRUD. Pages use TanStack Query hooks. Forms use React Hook Form + Zod.

---

### Task 1: People API routes

**Files:**
- Create: `app/api/people/route.ts`
- Create: `app/api/people/[id]/route.ts`

- [ ] **Step 1: Create app/api/people/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPeople, insertPerson } from "@/lib/queries/people";

export async function GET() {
  const people = getPeople(getDb());
  return NextResponse.json(people);
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertPerson(getDb(), {
    name: body.name,
    korting: body.korting ?? 0,
    korting_long: body.korting_long ?? 0,
    active: body.active ?? 1,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create app/api/people/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const person = getPersonById(getDb(), Number(params.id));
  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updatePerson(getDb(), Number(params.id), {
    name: body.name,
    korting: body.korting ?? 0,
    korting_long: body.korting_long ?? 0,
    active: body.active ?? 1,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Test API manually**

```bash
npm run dev
curl http://localhost:3000/api/people
```
Expected: `[]` (empty array).

```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{"name":"Roeland","korting":0,"korting_long":0,"active":1}'
```
Expected: `{"id":1}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/people/
git commit -m "feat: people API routes GET/POST/PUT"
```

---

### Task 2: Cars API routes

**Files:**
- Create: `app/api/cars/route.ts`
- Create: `app/api/cars/[id]/route.ts`

- [ ] **Step 1: Create app/api/cars/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCars, insertCar } from "@/lib/queries/cars";

export async function GET() {
  return NextResponse.json(getCars(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertCar(getDb(), {
    short: body.short,
    name: body.name,
    prijs: body.prijs,
    merk: body.merk ?? null,
    kleur: body.kleur ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Create app/api/cars/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCarById, updateCar } from "@/lib/queries/cars";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const car = getCarById(getDb(), Number(params.id));
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(car);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateCar(getDb(), Number(params.id), {
    short: body.short,
    name: body.name,
    prijs: body.prijs,
    merk: body.merk ?? null,
    kleur: body.kleur ?? null,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cars/
git commit -m "feat: cars API routes GET/POST/PUT"
```

---

### Task 3: TanStack Query hooks

**Files:**
- Create: `hooks/use-people.ts`
- Create: `hooks/use-cars.ts`

- [ ] **Step 1: Create hooks/use-people.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Person } from "@/types";

export function usePeople() {
  return useQuery<Person[]>({
    queryKey: ["people"],
    queryFn: () => fetch("/api/people").then((r) => r.json()),
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Person, "id">) =>
      fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Person) =>
      fetch(`/api/people/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });
}
```

- [ ] **Step 2: Create hooks/use-cars.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Car } from "@/types";

export function useCars() {
  return useQuery<Car[]>({
    queryKey: ["cars"],
    queryFn: () => fetch("/api/cars").then((r) => r.json()),
  });
}

export function useCreateCar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Car, "id">) =>
      fetch("/api/cars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cars"] }),
  });
}

export function useUpdateCar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Car) =>
      fetch(`/api/cars/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cars"] }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/
git commit -m "feat: TanStack Query hooks for people and cars"
```

---

### Task 4: People page

**Files:**
- Create: `app/people/page.tsx`
- Create: `app/people/person-form.tsx`

- [ ] **Step 1: Create app/people/person-form.tsx**

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Person } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  korting: z.coerce.number().min(0).max(1),
  korting_long: z.coerce.number().min(0).max(1),
  active: z.coerce.number().int().min(0).max(1),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Person>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function PersonForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { korting: 0, korting_long: 0, active: 1, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">Naam *</label>
        <input {...register("name")} className="w-full border rounded-md px-3 py-2 text-sm" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Korting (0–1)</label>
        <input {...register("korting")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Korting lang (0–1)</label>
        <input {...register("korting_long")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create app/people/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PersonForm } from "./person-form";
import { usePeople, useCreatePerson, useUpdatePerson } from "@/hooks/use-people";
import type { Person } from "@/types";
import { ChevronRight } from "lucide-react";

export default function PeoplePage() {
  const { data: people = [], isLoading } = usePeople();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const [editing, setEditing] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <><PageHeader title="People" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="People" />
      <div className="divide-y">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3"
          >
            <span className={`w-2 h-2 rounded-full ${p.active ? "bg-green-500" : "bg-gray-300"}`} />
            <span className="flex-1 text-sm font-medium">{p.name}</span>
            {p.korting > 0 && <span className="text-xs text-gray-500">{p.korting}</span>}
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Persoon toevoegen</Dialog.Title>
            <PersonForm
              onSubmit={(data) => {
                createPerson.mutate(data as Omit<Person, "id">, {
                  onSuccess: () => { setAdding(false); toast.success("Persoon toegevoegd"); },
                });
              }}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit dialog */}
      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Persoon bewerken</Dialog.Title>
            {editing && (
              <PersonForm
                defaultValues={editing}
                onSubmit={(data) => {
                  updatePerson.mutate({ ...editing, ...data }, {
                    onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); },
                  });
                }}
                onCancel={() => setEditing(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Persoon toevoegen" />
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```
Navigate to http://localhost:3000/people — list shows, FAB opens add form, save works.

- [ ] **Step 4: Commit**

```bash
git add app/people/
git commit -m "feat: people list and add/edit form"
```

---

### Task 5: Cars page

**Files:**
- Create: `app/cars/page.tsx`
- Create: `app/cars/car-form.tsx`

- [ ] **Step 1: Create app/cars/car-form.tsx**

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Car } from "@/types";

const schema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  prijs: z.coerce.number().positive(),
  merk: z.string().optional(),
  kleur: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Car>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function CarForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { prijs: 0.20, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">Code (ETH/JF/LEW) *</label>
        <input {...register("short")} className="w-full border rounded-md px-3 py-2 text-sm uppercase" />
        {errors.short && <p className="text-red-500 text-xs mt-1">{errors.short.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Naam *</label>
        <input {...register("name")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Prijs/km *</label>
        <input {...register("prijs")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Merk</label>
        <input {...register("merk")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Kleur</label>
        <input {...register("kleur")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create app/cars/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { CarForm } from "./car-form";
import { useCars, useCreateCar, useUpdateCar } from "@/hooks/use-cars";
import type { Car } from "@/types";
import { ChevronRight } from "lucide-react";

export default function CarsPage() {
  const { data: cars = [], isLoading } = useCars();
  const createCar = useCreateCar();
  const updateCar = useUpdateCar();
  const [editing, setEditing] = useState<Car | null>(null);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <><PageHeader title="Cars" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Cars" />
      <div className="divide-y">
        {cars.map((c) => (
          <button key={c.id} onClick={() => setEditing(c)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3">
            <span className="text-sm font-mono font-bold text-blue-600 w-10">{c.short}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-gray-500">{c.merk} · {c.kleur} · €{c.prijs}/km</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Wagen toevoegen</Dialog.Title>
            <CarForm
              onSubmit={(data) => createCar.mutate(
                { ...data, merk: data.merk ?? null, kleur: data.kleur ?? null } as Omit<Car,"id">,
                { onSuccess: () => { setAdding(false); toast.success("Wagen toegevoegd"); } }
              )}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Wagen bewerken</Dialog.Title>
            {editing && (
              <CarForm
                defaultValues={editing}
                onSubmit={(data) => updateCar.mutate(
                  { ...editing, ...data, merk: data.merk ?? null, kleur: data.kleur ?? null },
                  { onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); } }
                )}
                onCancel={() => setEditing(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Wagen toevoegen" />
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to http://localhost:3000/cars — list shows 3 cars (after seed), FAB opens form.

- [ ] **Step 4: Commit**

```bash
git add app/cars/
git commit -m "feat: cars list and add/edit form"
```
