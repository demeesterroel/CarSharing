# CarSharing — Plan 05: People & Cars

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisite:** plans 01–04 and 00 (shared helpers) completed.

**Goal:** API routes and pages for People and Cars — list, add, edit.

**Architecture:** Every route handler is wrapped by `json()` from `lib/api.ts`. Bodies are parsed via Zod; Next 15 passes `params` as a Promise. CRUD hooks come from `createResourceHooks`. Forms use React Hook Form + Zod.

---

### Task 1: People API routes

**Files:**
- Create: `app/api/people/route.ts`
- Create: `app/api/people/[id]/route.ts`

- [ ] **Step 1: Create app/api/people/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPeople, insertPerson } from "@/lib/queries/people";
import { json, readBody } from "@/lib/api";

const PersonSchema = z.object({
  name: z.string().min(1),
  discount: z.number().min(0).max(1).default(0),
  discount_long: z.number().min(0).max(1).default(0),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
});

export const GET = json(async () => getPeople(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, PersonSchema);
  const id = insertPerson(getDb(), data);
  return Response.json({ id }, { status: 201 });
});
```

- [ ] **Step 2: Create app/api/people/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPersonById, updatePerson } from "@/lib/queries/people";
import { json, readBody, readId, notFound } from "@/lib/api";

const PersonSchema = z.object({
  name: z.string().min(1),
  discount: z.number().min(0).max(1).default(0),
  discount_long: z.number().min(0).max(1).default(0),
  active: z.union([z.literal(0), z.literal(1)]).default(1),
});

export const GET = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const person = getPersonById(getDb(), await readId(ctx));
  if (!person) notFound();
  return person;
});

export const PUT = json(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = await readId(ctx);
  const data = await readBody(req, PersonSchema);
  updatePerson(getDb(), id, data);
  return { ok: true };
});
```

- [ ] **Step 3: Test API manually**

```bash
npm run dev
curl http://localhost:3000/api/people
```
Expected: `[]` (empty array) or seeded rows.

```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{"name":"Roeland","discount":0,"discount_long":0,"active":1}'
```
Expected: `{"id":N}`.

Invalid payload fails fast:
```bash
curl -X POST http://localhost:3000/api/people \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
```
Expected: `400` with `{"error":"Validation failed","issues":[...]}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/people/
git commit -m "feat: people API routes with zod validation and error wrapper"
```

---

### Task 2: Cars API routes

**Files:**
- Create: `app/api/cars/route.ts`
- Create: `app/api/cars/[id]/route.ts`

- [ ] **Step 1: Create app/api/cars/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCars, insertCar } from "@/lib/queries/cars";
import { json, readBody } from "@/lib/api";

const CarSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z.string().nullable().optional().transform((v) => v ?? null),
  color: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getCars(getDb()));

export const POST = json(async (req) => {
  const data = await readBody(req, CarSchema);
  const id = insertCar(getDb(), data);
  return Response.json({ id }, { status: 201 });
});
```

- [ ] **Step 2: Create app/api/cars/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCarById, updateCar } from "@/lib/queries/cars";
import { json, readBody, readId, notFound } from "@/lib/api";

const CarSchema = z.object({
  short: z.string().min(1).max(10),
  name: z.string().min(1),
  price_per_km: z.number().positive(),
  brand: z.string().nullable().optional().transform((v) => v ?? null),
  color: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const car = getCarById(getDb(), await readId(ctx));
  if (!car) notFound();
  return car;
});

export const PUT = json(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const id = await readId(ctx);
  const data = await readBody(req, CarSchema);
  updateCar(getDb(), id, data);
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cars/
git commit -m "feat: cars API routes with zod validation"
```

---

### Task 3: TanStack Query hooks via factory

**Files:**
- Create: `hooks/use-people.ts`
- Create: `hooks/use-cars.ts`

- [ ] **Step 1: Create hooks/use-people.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Person } from "@/types";

const hooks = createResourceHooks<Person, Omit<Person, "id">>("people", "/api/people", {
  invalidate: [["dashboard"]],
});
export const usePeople = hooks.useList;
export const useCreatePerson = hooks.useCreate;
export const useUpdatePerson = hooks.useUpdate;
```

- [ ] **Step 2: Create hooks/use-cars.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Car } from "@/types";

const hooks = createResourceHooks<Car, Omit<Car, "id">>("cars", "/api/cars", {
  invalidate: [["dashboard"]],
});
export const useCars = hooks.useList;
export const useCreateCar = hooks.useCreate;
export const useUpdateCar = hooks.useUpdate;
```

- [ ] **Step 3: Commit**

```bash
git add hooks/use-people.ts hooks/use-cars.ts
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
  discount: z.coerce.number().min(0).max(1),
  discount_long: z.coerce.number().min(0).max(1),
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
    defaultValues: { discount: 0, discount_long: 0, active: 1, ...defaultValues },
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
        <input {...register("discount")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Korting lang (0–1)</label>
        <input {...register("discount_long")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <input {...register("active")} type="checkbox" id="active" value="1" defaultChecked={defaultValues?.active !== 0} />
        <label htmlFor="active" className="text-sm">Actief lid</label>
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
            {p.discount > 0 && <span className="text-xs text-gray-500">{p.discount}</span>}
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Persoon toevoegen</Dialog.Title>
            <PersonForm
              onSubmit={(data) => {
                createPerson.mutate(data as Omit<Person, "id">, {
                  onSuccess: () => { setAdding(false); toast.success("Persoon toegevoegd"); },
                  onError: (e) => toast.error(e.message),
                });
              }}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
                    onError: (e) => toast.error(e.message),
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
  price_per_km: z.coerce.number().positive(),
  brand: z.string().optional(),
  color: z.string().optional(),
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
    defaultValues: { price_per_km: 0.20, ...defaultValues },
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
        <input {...register("price_per_km")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Merk</label>
        <input {...register("brand")} className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Kleur</label>
        <input {...register("color")} className="w-full border rounded-md px-3 py-2 text-sm" />
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
              <p className="text-xs text-gray-500">
                {[c.brand, c.color].filter(Boolean).join(" · ")} · €{c.price_per_km}/km
              </p>
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
                { ...data, brand: data.brand ?? null, color: data.color ?? null } as Omit<Car,"id">,
                { onSuccess: () => { setAdding(false); toast.success("Wagen toegevoegd"); },
                  onError: (e) => toast.error(e.message) }
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
                  { ...editing, ...data, brand: data.brand ?? null, color: data.color ?? null },
                  { onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); },
                    onError: (e) => toast.error(e.message) }
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

Navigate to http://localhost:3000/cars — list shows 4 cars (after seed), FAB opens form.

- [ ] **Step 4: Commit**

```bash
git add app/cars/
git commit -m "feat: cars list and add/edit form"
```
