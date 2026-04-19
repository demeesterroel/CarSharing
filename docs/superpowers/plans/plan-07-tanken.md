# CarSharing — Plan 07: Tanken

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Query helpers, API routes, list page, and add/edit form for tankbeurten — including auto-calculated prijs/liter and receipt photo upload.

---

### Task 1: Tankbeurten query helpers

**Files:**
- Create: `lib/queries/tankbeurten.ts`

- [ ] **Step 1: Create lib/queries/tankbeurten.ts**

```ts
import type Database from "better-sqlite3";
import type { Tankbeurt, TankbeurtInput } from "@/types";
import { calcPrijsPerLiter } from "@/lib/formulas";

export function getTankbeurten(db: Database.Database): Tankbeurt[] {
  return db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM tankbeurten t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    ORDER BY t.datum DESC, t.id DESC
  `).all() as Tankbeurt[];
}

export function getTankbeurtById(db: Database.Database, id: number): Tankbeurt | null {
  return (db.prepare(`
    SELECT t.*, p.name AS person_name, c.short AS car_short
    FROM tankbeurten t
    JOIN people p ON p.id = t.person_id
    JOIN cars c ON c.id = t.car_id
    WHERE t.id = ?
  `).get(id) as Tankbeurt) ?? null;
}

export function insertTankbeurt(db: Database.Database, input: TankbeurtInput): number {
  const prijs_liter = calcPrijsPerLiter(input.bedrag, input.liter);
  const result = db.prepare(`
    INSERT INTO tankbeurten (person_id,car_id,datum,bedrag,liter,prijs_liter,kilometerstand,bonnetje)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.datum,
    input.bedrag, input.liter, prijs_liter,
    input.kilometerstand ?? null, input.bonnetje ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateTankbeurt(db: Database.Database, id: number, input: TankbeurtInput): void {
  const prijs_liter = calcPrijsPerLiter(input.bedrag, input.liter);
  db.prepare(`
    UPDATE tankbeurten SET person_id=?,car_id=?,datum=?,bedrag=?,liter=?,prijs_liter=?,kilometerstand=?,bonnetje=? WHERE id=?
  `).run(
    input.person_id, input.car_id, input.datum,
    input.bedrag, input.liter, prijs_liter,
    input.kilometerstand ?? null, input.bonnetje ?? null, id
  );
}

export function deleteTankbeurt(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM tankbeurten WHERE id=?").run(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/tankbeurten.ts
git commit -m "feat: tankbeurten query helpers"
```

---

### Task 2: Receipt upload API & tankbeurten API routes

**Files:**
- Create: `app/api/uploads/route.ts`
- Create: `app/api/tankbeurten/route.ts`
- Create: `app/api/tankbeurten/[id]/route.ts`

- [ ] **Step 1: Create uploads directory**

```bash
mkdir -p uploads
echo "uploads/" >> .gitignore
```

- [ ] **Step 2: Create app/api/uploads/route.ts**

```ts
import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const dest = path.join(process.cwd(), "uploads", filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
}
```

- [ ] **Step 3: Serve uploads as static files — add to next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/static/:path*",
      },
    ];
  },
};

export default nextConfig;
```

Create `app/api/static/[...path]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(_: Request, { params }: { params: { path: string[] } }) {
  const filePath = path.join(process.cwd(), "uploads", ...params.path);
  try {
    const file = await readFile(filePath);
    const ext = params.path.at(-1)?.split(".").pop() ?? "jpg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return new Response(file, { headers: { "Content-Type": mime } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
```

- [ ] **Step 4: Create app/api/tankbeurten/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTankbeurten, insertTankbeurt } from "@/lib/queries/tankbeurten";

export async function GET() {
  return NextResponse.json(getTankbeurten(getDb()));
}

export async function POST(req: Request) {
  const body = await req.json();
  const id = insertTankbeurt(getDb(), {
    person_id: body.person_id,
    car_id: body.car_id,
    datum: body.datum,
    bedrag: body.bedrag,
    liter: body.liter,
    kilometerstand: body.kilometerstand ?? null,
    bonnetje: body.bonnetje ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 5: Create app/api/tankbeurten/[id]/route.ts**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTankbeurtById, updateTankbeurt, deleteTankbeurt } from "@/lib/queries/tankbeurten";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const t = getTankbeurtById(getDb(), Number(params.id));
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(t);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateTankbeurt(getDb(), Number(params.id), {
    person_id: body.person_id,
    car_id: body.car_id,
    datum: body.datum,
    bedrag: body.bedrag,
    liter: body.liter,
    kilometerstand: body.kilometerstand ?? null,
    bonnetje: body.bonnetje ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteTankbeurt(getDb(), Number(params.id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/tankbeurten/ app/api/uploads/ app/api/static/ next.config.ts
git commit -m "feat: tankbeurten and uploads API routes"
```

---

### Task 3: Tanken hook, receipt uploader, page

**Files:**
- Create: `hooks/use-tankbeurten.ts`
- Create: `components/receipt-upload.tsx`
- Create: `app/tanken/page.tsx`
- Create: `app/tanken/tank-form.tsx`

- [ ] **Step 1: Create hooks/use-tankbeurten.ts**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tankbeurt, TankbeurtInput } from "@/types";

export function useTankbeurten() {
  return useQuery<Tankbeurt[]>({
    queryKey: ["tankbeurten"],
    queryFn: () => fetch("/api/tankbeurten").then((r) => r.json()),
  });
}

export function useCreateTankbeurt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TankbeurtInput) =>
      fetch("/api/tankbeurten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tankbeurten"] }),
  });
}

export function useUpdateTankbeurt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: TankbeurtInput & { id: number }) =>
      fetch(`/api/tankbeurten/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tankbeurten"] }),
  });
}

export function useDeleteTankbeurt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`/api/tankbeurten/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tankbeurten"] }),
  });
}
```

- [ ] **Step 2: Create components/receipt-upload.tsx**

```tsx
"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";

interface Props {
  value: string | null;
  onChange: (path: string) => void;
}

export function ReceiptUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    onChange(data.path);
    setUploading(false);
  };

  return (
    <div className="border rounded-md p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50"
      onClick={() => inputRef.current?.click()}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value ? (
        <img src={value} alt="Bonnetje" className="max-h-32 rounded object-contain" />
      ) : (
        <>
          <Camera className={`w-6 h-6 ${uploading ? "animate-pulse text-blue-500" : "text-gray-400"}`} />
          <span className="text-xs text-gray-500">{uploading ? "Uploaden..." : "Bonnetje toevoegen"}</span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create app/tanken/tank-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { ReceiptUpload } from "@/components/receipt-upload";
import { calcPrijsPerLiter } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Tankbeurt } from "@/types";

const schema = z.object({
  person_id: z.number({ required_error: "Kies een persoon" }),
  car_id: z.number({ required_error: "Kies een wagen" }),
  datum: z.string().min(1),
  bedrag: z.coerce.number().positive(),
  liter: z.coerce.number().positive(),
  kilometerstand: z.coerce.number().int().optional().nullable(),
  bonnetje: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Tankbeurt>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
}

export function TankForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { register, handleSubmit, control, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      datum: new Date().toISOString().slice(0, 10),
      bedrag: 0, liter: 0, bonnetje: null, kilometerstand: null,
      ...defaultValues,
    },
  });

  const [bedrag, liter] = watch(["bedrag", "liter"]);
  const prijsLiter = calcPrijsPerLiter(bedrag ?? 0, liter ?? 0);

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Bedrag (€) *</label>
          <input {...register("bedrag")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1"># Liter *</label>
          <input {...register("liter")} type="number" step="0.01" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Prijs/liter</label>
          <input readOnly value={prijsLiter.toFixed(3)} className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Kilometerstand</label>
          <input {...register("kilometerstand")} type="number" className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bonnetje</label>
        <Controller name="bonnetje" control={control}
          render={({ field }) => <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />}
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

- [ ] **Step 4: Create app/tanken/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { TankForm } from "./tank-form";
import { useTankbeurten, useCreateTankbeurt, useUpdateTankbeurt, useDeleteTankbeurt } from "@/hooks/use-tankbeurten";
import type { Tankbeurt } from "@/types";
import { ChevronRight } from "lucide-react";

function yearMonth(datum: string) {
  const [y, m] = datum.split("-");
  return `${y}-${m}`;
}

export default function TankenPage() {
  const { data: tankbeurten = [], isLoading } = useTankbeurten();
  const createT = useCreateTankbeurt();
  const updateT = useUpdateTankbeurt();
  const deleteT = useDeleteTankbeurt();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Tankbeurt | null>(null);

  if (isLoading) return <><PageHeader title="Tanken" /><p className="p-4 text-gray-500">Laden...</p></>;

  return (
    <>
      <PageHeader title="Tanken" />
      <GroupedList
        items={tankbeurten}
        getKey={(t) => yearMonth(t.datum)}
        getGroupLabel={(key) => { const [y,m] = key.split("-"); return `${y}-${Number(m)}`; }}
        getGroupTotal={(items) => items.reduce((s, t) => s + t.bedrag, 0)}
        renderItem={(t) => (
          <button key={t.id} onClick={() => setEditing(t)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{t.car_short}</span>
                <span className="text-xs text-gray-500 ml-auto">{t.datum}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm font-medium">€ {t.bedrag.toFixed(2)}</span>
                <span className="text-xs text-gray-400">{t.liter} L · €{t.prijs_liter.toFixed(3)}/L</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}
      />

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Tankbeurt toevoegen</Dialog.Title>
            <TankForm
              onSubmit={(data) => createT.mutate(data as any, {
                onSuccess: () => { setAdding(false); toast.success("Tankbeurt opgeslagen"); },
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
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">Tankbeurt bewerken</Dialog.Title>
            {editing && (
              <>
                <TankForm
                  defaultValues={editing}
                  onSubmit={(data) => updateT.mutate({ id: editing.id, ...data } as any, {
                    onSuccess: () => { setEditing(null); toast.success("Opgeslagen"); },
                  })}
                  onCancel={() => setEditing(null)}
                />
                <div className="px-4 pb-4">
                  <button onClick={() => deleteT.mutate(editing.id, {
                    onSuccess: () => { setEditing(null); toast.success("Verwijderd"); },
                  })} className="w-full border border-red-300 text-red-600 rounded-md py-2 text-sm">
                    Verwijderen
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Fab onClick={() => setAdding(true)} label="Tankbeurt toevoegen" />
    </>
  );
}
```

- [ ] **Step 5: Verify in browser**

Navigate to http://localhost:3000/tanken. Add entry — prijs/liter auto-calculates. Receipt upload opens camera. List groups by month with euro total.

- [ ] **Step 6: Commit**

```bash
git add app/tanken/ hooks/use-tankbeurten.ts components/receipt-upload.tsx
git commit -m "feat: tanken list, form with receipt upload and auto prijs/liter"
```
