# CarSharing — Plan 08: Kosten & Betaald

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Query helpers, API routes, and pages for Extra Kosten (maintenance/tax costs) and Betaald (settlement payments). Both follow the same pattern as Ritten/Tanken.

---

### Task 1: Kosten query helpers & API

**Files:**
- Create: `lib/queries/kosten.ts`
- Create: `app/api/kosten/route.ts`
- Create: `app/api/kosten/[id]/route.ts`

- [ ] **Step 1: Create lib/queries/kosten.ts**

```ts
import type Database from "better-sqlite3";
import type { Kost, KostInput } from "@/types";

export function getKosten(db: Database.Database): Kost[] {
  return db.prepare(`
    SELECT k.*, p.name AS person_name, c.short AS car_short
    FROM kosten k
    JOIN people p ON p.id = k.person_id
    JOIN cars c ON c.id = k.car_id
    ORDER BY k.datum DESC, k.id DESC
  `).all() as Kost[];
}

export function getKostById(db: Database.Database, id: number): Kost | null {
  return (db.prepare(`
    SELECT k.*, p.name AS person_name, c.short AS car_short
    FROM kosten k
    JOIN people p ON p.id = k.person_id
    JOIN cars c ON c.id = k.car_id
    WHERE k.id = ?
  `).get(id) as Kost) ?? null;
}

export function insertKost(db: Database.Database, input: KostInput): number {
  const result = db.prepare(`
    INSERT INTO kosten (person_id,car_id,datum,bedrag,omschrijving) VALUES (?,?,?,?,?)
  `).run(input.person_id, input.car_id, input.datum, input.bedrag, input.omschrijving ?? null);
  return result.lastInsertRowid as number;
}

export function updateKost(db: Database.Database, id: number, input: KostInput): void {
  db.prepare(`
    UPDATE kosten SET person_id=?,car_id=?,datum=?,bedrag=?,omschrijving=? WHERE id=?
  `).run(input.person_id, input.car_id, input.datum, input.bedrag, input.omschrijving ?? null, id);
}

export function deleteKost(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM kosten WHERE id=?").run(id);
}
```

- [ ] **Step 2: Create app/api/kosten/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getKosten, insertKost } from "@/lib/queries/kosten";

export async function GET() {
  return NextResponse.json(getKosten(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertKost(getDb(), {
    person_id: body.person_id,
    car_id: body.car_id,
    datum: body.datum,
    bedrag: body.bedrag,
    omschrijving: body.omschrijving ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 3: Create app/api/kosten/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getKostById, updateKost, deleteKost } from "@/lib/queries/kosten";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const k = getKostById(getDb(), Number(params.id));
  if (!k) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(k);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateKost(getDb(), Number(params.id), {
    person_id: body.person_id, car_id: body.car_id,
    datum: body.datum, bedrag: body.bedrag, omschrijving: body.omschrijving ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteKost(getDb(), Number(params.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/queries/kosten.ts app/api/kosten/
git commit -m "feat: kosten query helpers and API routes"
```

---

### Task 2: Kosten page

**Files:**
- Create: `hooks/use-kosten.ts`
- Create: `app/kosten/page.tsx`
- Create: `app/kosten/kost-form.tsx`

- [ ] **Step 1: Create hooks/use-kosten.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Kost, KostInput } from "@/types";

export function useKosten() {
  return useQuery<Kost[]>({
    queryKey: ["kosten"],
    queryFn: () => fetch("/api/kosten").then((r) => r.json()),
  });
}

export function useCreateKost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: KostInput) =>
      fetch("/api/kosten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kosten"] }),
  });
}

export function useUpdateKost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: KostInput & { id: number }) =>
      fetch(`/api/kosten/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kosten"] }),
  });
}

export function useDeleteKost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/kosten/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kosten"] }),
  });
}
```

- [ ] **Step 2: Create app/kosten/kost-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Kost } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  car_id: z.number({ required_error: "Kies een wagen" }),
  datum: z.string().min(1),
  bedrag: z.coerce.number().positive(),
  omschrijving: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Kost>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function KostForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { datum: new Date().toISOString().slice(0,10), bedrag: 0, omschrijving: null, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">Naam *</label>
        <Controller name="person_id" control={control}
          render={({ field }) => <PersonSelect people={people.filter((p) => p.active)} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Wagen *</label>
        <Controller name="car_id" control={control}
          render={({ field }) => <CarToggle cars={cars} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Datum *</label>
        <input {...register("datum")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bedrag (€) *</label>
        <input {...register("bedrag")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Omschrijving</label>
        <input {...register("omschrijving")} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="bv. Verkeersbelasting" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create app/kosten/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { KostForm } from "./kost-form";
import { useKosten, useCreateKost, useUpdateKost, useDeleteKost } from "@/hooks/use-kosten";
import type { Kost } from "@/types";
import { ChevronRight } from "lucide-react";

export default function KostenPage() {
  const { data: kosten = [], isLoading } = useKosten();
  const createK = useCreateKost();
  const updateK = useUpdateKost();
  const deleteK = useDeleteKost();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Kost | null>(null);

  if (isLoading) return <><PageHeader title="Extra Kosten" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Extra Kosten" />
      <GroupedList
        items={kosten}
        getKey={(k) => k.datum.slice(0, 7)}
        getGroupLabel={(key) => { const [y,m] = key.split("-"); return `${y}-${Number(m)}`; }}
        getGroupTotal={(items) => items.reduce((s, k) => s + k.bedrag, 0)}
        renderItem={(k) => (
          <button key={k.id} onClick={() => setEditing(k)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{k.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{k.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{k.datum}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{k.omschrijving}</span>
                <span className="text-sm font-medium ml-auto">€ {k.bedrag.toFixed(2)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      {[{ open: adding, setOpen: setAdding, title: "Kost toevoegen", onSubmit: (d: any) => createK.mutate(d, { onSuccess: () => { setAdding(false); toast.success("Opgeslagen"); } }) }].map(({ open, setOpen, title, onSubmit }) => (
        <Dialog.Root key={title} open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
              <Dialog.Title className="px-4 pt-4 text-base font-semibold">{title}</Dialog.Title>
              <KostForm onSubmit={onSubmit} onCancel={() => setOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ))}

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Kost bewerken</Dialog.Title>
            {editing && (
              <>
                <KostForm defaultValues={editing}
                  onSubmit={(d) => updateK.mutate({ id: editing.id, ...d } as any, { onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); } })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteK.mutate(editing.id, { onSuccess: () => { setEditing(null); toast.success("Verwijderd"); } })}
                    className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">Verwijderen</button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Kost toevoegen" />
    </>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to http://localhost:3000/kosten. Add a kost — grouped by month with euro total.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-kosten.ts app/kosten/
git commit -m "feat: kosten list and form"
```

---

### Task 3: Betaald query helpers, API & page

**Files:**
- Create: `lib/queries/betaald.ts`
- Create: `app/api/betaald/route.ts`
- Create: `app/api/betaald/[id]/route.ts`
- Create: `hooks/use-betaald.ts`
- Create: `app/betaald/page.tsx`
- Create: `app/betaald/betaald-form.tsx`

- [ ] **Step 1: Create lib/queries/betaald.ts**

```ts
import type Database from "better-sqlite3";
import type { Betaald, BetaaldInput } from "@/types";
import { calcBetaaldYear } from "@/lib/formulas";

export function getBetaald(db: Database.Database): Betaald[] {
  return db.prepare(`
    SELECT b.*, p.name AS person_name
    FROM betaald b
    JOIN people p ON p.id = b.person_id
    ORDER BY b.datum DESC, b.id DESC
  `).all() as Betaald[];
}

export function getBetaaldById(db: Database.Database, id: number): Betaald | null {
  return (db.prepare(`
    SELECT b.*, p.name AS person_name FROM betaald b
    JOIN people p ON p.id = b.person_id WHERE b.id=?
  `).get(id) as Betaald) ?? null;
}

export function insertBetaald(db: Database.Database, input: BetaaldInput): number {
  const year = calcBetaaldYear(input.datum);
  const result = db.prepare(
    "INSERT INTO betaald (person_id,datum,bedrag,opmerking,year) VALUES (?,?,?,?,?)"
  ).run(input.person_id, input.datum, input.bedrag, input.opmerking ?? null, year);
  return result.lastInsertRowid as number;
}

export function updateBetaald(db: Database.Database, id: number, input: BetaaldInput): void {
  const year = calcBetaaldYear(input.datum);
  db.prepare("UPDATE betaald SET person_id=?,datum=?,bedrag=?,opmerking=?,year=? WHERE id=?")
    .run(input.person_id, input.datum, input.bedrag, input.opmerking ?? null, year, id);
}

export function deleteBetaald(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM betaald WHERE id=?").run(id);
}
```

- [ ] **Step 2: Create app/api/betaald/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBetaald, insertBetaald } from "@/lib/queries/betaald";

export async function GET() {
  return NextResponse.json(getBetaald(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertBetaald(getDb(), {
    person_id: body.person_id, datum: body.datum,
    bedrag: body.bedrag, opmerking: body.opmerking ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 3: Create app/api/betaald/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getBetaaldById, updateBetaald, deleteBetaald } from "@/lib/queries/betaald";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const b = getBetaaldById(getDb(), Number(params.id));
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(b);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateBetaald(getDb(), Number(params.id), {
    person_id: body.person_id, datum: body.datum,
    bedrag: body.bedrag, opmerking: body.opmerking ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteBetaald(getDb(), Number(params.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create hooks/use-betaald.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Betaald, BetaaldInput } from "@/types";

export function useBetaald() {
  return useQuery<Betaald[]>({
    queryKey: ["betaald"],
    queryFn: () => fetch("/api/betaald").then((r) => r.json()),
  });
}

export function useCreateBetaald() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BetaaldInput) =>
      fetch("/api/betaald", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["betaald", "dashboard"] }),
  });
}

export function useUpdateBetaald() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: BetaaldInput & { id: number }) =>
      fetch(`/api/betaald/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["betaald", "dashboard"] }),
  });
}

export function useDeleteBetaald() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/betaald/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["betaald", "dashboard"] }),
  });
}
```

- [ ] **Step 5: Create app/betaald/betaald-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import type { Betaald } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  datum: z.string().min(1),
  bedrag: z.coerce.number(),
  opmerking: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Betaald>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function BetaaldForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { datum: new Date().toISOString().slice(0,10), bedrag: 0, opmerking: null, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">Naam *</label>
        <Controller name="person_id" control={control}
          render={({ field }) => <PersonSelect people={people} value={field.value} onChange={field.onChange} />}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Datum *</label>
        <input {...register("datum")} type="date" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bedrag (€)</label>
        <input {...register("bedrag")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Opmerking</label>
        <input {...register("opmerking")} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="bv. Vereffening 2025" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border rounded-md py-2 text-sm">Annuleer</button>
        <button type="submit" className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm">Opslaan</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Create app/betaald/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { BetaaldForm } from "./betaald-form";
import { useBetaald, useCreateBetaald, useUpdateBetaald, useDeleteBetaald } from "@/hooks/use-betaald";
import type { Betaald } from "@/types";
import { ChevronRight } from "lucide-react";

export default function BetaaldPage() {
  const { data: betaald = [], isLoading } = useBetaald();
  const createB = useCreateBetaald();
  const updateB = useUpdateBetaald();
  const deleteB = useDeleteBetaald();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Betaald | null>(null);

  if (isLoading) return <><PageHeader title="Betalingen" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Betalingen" />
      <div className="divide-y">
        {betaald.map((b) => (
          <button key={b.id} onClick={() => setEditing(b)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{b.person_name}</span>
                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{b.year}</span>
                <span className="text-xs text-gray-500 ml-auto">{b.datum}</span>
              </div>
              <div className="flex items-center mt-0.5">
                <span className="text-xs text-gray-500">{b.opmerking}</span>
                <span className="text-sm font-medium ml-auto">€ {b.bedrag.toFixed(2)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        ))}
      </div>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Betaling toevoegen</Dialog.Title>
            <BetaaldForm
              onSubmit={(d) => createB.mutate(d as any, { onSuccess: () => { setAdding(false); toast.success("Betaling opgeslagen"); } })}
              onCancel={() => setAdding(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Betaling bewerken</Dialog.Title>
            {editing && (
              <>
                <BetaaldForm defaultValues={editing}
                  onSubmit={(d) => updateB.mutate({ id: editing.id, ...d } as any, { onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); } })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteB.mutate(editing.id, { onSuccess: () => { setEditing(null); toast.success("Verwijderd"); } })}
                    className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">Verwijderen</button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Betaling toevoegen" />
    </>
  );
}
```

- [ ] **Step 7: Verify in browser**

Navigate to http://localhost:3000/betaald. Add a payment — year is computed server-side (datum year − 1).

- [ ] **Step 8: Commit**

```bash
git add lib/queries/betaald.ts app/api/betaald/ hooks/use-betaald.ts app/betaald/
git commit -m "feat: betaald query helpers, API, and page"
```
