# CarSharing — Plan 07: Fuel Fill-ups

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisites:** plans 00, 01, 02, 02b, 03, 03b (i18n), 04, 05, 06 completed.

**Goal:** Query helpers, API routes, list page, and add/edit form for fuel fill-ups (`fuel_fillups`) — including auto-calculated `price_per_liter` and receipt photo upload.

**Architecture:** Same shape as plan-06-trips: query helpers with joins, Zod-validated route handlers via `json()`, `createResourceHooks` factory. Receipt upload is a separate POST that writes to `./uploads/` and returns a URL path; the path is stored on the fill-up record as `receipt`. Fill-ups also record a `location` (where the fuelling happened — typically a gas station); the field is free-form and can be captured with the same `LocationPicker` used for trips. When the user picks a car in the form, the `odometer` field is prefilled from the car's last known state via `useLastCarState` (see plan-06 Task 2b) — location is NOT prefilled because each fill-up happens at a fresh location. User-facing strings resolve through `t()` from `@/lib/i18n` (plan-03b).

**Tech Stack:** better-sqlite3, Zod, TanStack Query, React Hook Form, Radix Dialog.

---

### Task 1: Fuel fill-up query helpers

**Files:**
- Create: `lib/queries/fuel-fillups.ts`

- [ ] **Step 1: Create lib/queries/fuel-fillups.ts**

```ts
import type Database from "better-sqlite3";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { calcPricePerLiter } from "@/lib/formulas";

export function getFuelFillups(db: Database.Database): FuelFillup[] {
  return db.prepare(`
    SELECT f.*, p.name AS person_name, c.short AS car_short
    FROM fuel_fillups f
    JOIN people p ON p.id = f.person_id
    JOIN cars c ON c.id = f.car_id
    ORDER BY f.date DESC, f.id DESC
  `).all() as FuelFillup[];
}

export function getFuelFillupById(db: Database.Database, id: number): FuelFillup | null {
  return (db.prepare(`
    SELECT f.*, p.name AS person_name, c.short AS car_short
    FROM fuel_fillups f
    JOIN people p ON p.id = f.person_id
    JOIN cars c ON c.id = f.car_id
    WHERE f.id = ?
  `).get(id) as FuelFillup) ?? null;
}

export function insertFuelFillup(db: Database.Database, input: FuelFillupInput): number {
  const price_per_liter = calcPricePerLiter(input.amount, input.liters);
  const result = db.prepare(`
    INSERT INTO fuel_fillups (person_id,car_id,date,amount,liters,price_per_liter,odometer,receipt,location)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date,
    input.amount, input.liters, price_per_liter,
    input.odometer ?? null, input.receipt ?? null, input.location ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateFuelFillup(db: Database.Database, id: number, input: FuelFillupInput): void {
  const price_per_liter = calcPricePerLiter(input.amount, input.liters);
  db.prepare(`
    UPDATE fuel_fillups
    SET person_id=?,car_id=?,date=?,amount=?,liters=?,price_per_liter=?,odometer=?,receipt=?,location=?
    WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date,
    input.amount, input.liters, price_per_liter,
    input.odometer ?? null, input.receipt ?? null, input.location ?? null, id
  );
}

export function deleteFuelFillup(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM fuel_fillups WHERE id=?").run(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/fuel-fillups.ts
git commit -m "feat: fuel fill-up query helpers"
```

---

### Task 2: Receipt upload API

**Files:**
- Create: `app/api/uploads/route.ts`
- Create: `app/api/static/[...path]/route.ts`
- Modify: `next.config.ts`
- Modify: `.gitignore`

The uploads route must cap file size and validate the MIME type — an unauthenticated write endpoint that blindly accepts any file is a data-exfiltration / disk-fill vector.

- [ ] **Step 1: Create uploads directory and gitignore entry**

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

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const filename = `${randomUUID()}.${ext}`;
  const dest = path.join(process.cwd(), "uploads", filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);

  return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
}
```

- [ ] **Step 3: Update next.config.ts to rewrite /uploads to the static route**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/:path*" },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create app/api/static/[...path]/route.ts**

```ts
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await ctx.params;
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const filePath = path.resolve(uploadsRoot, ...parts);

  // Guard against path traversal (../ segments escaping uploads/)
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readFile(filePath);
    const ext = parts.at(-1)?.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": mime, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/uploads/ app/api/static/ next.config.ts .gitignore
git commit -m "feat: upload route with size/mime validation and static serving"
```

---

### Task 3: Fuel fill-up API routes

**Files:**
- Create: `app/api/fuel/route.ts`
- Create: `app/api/fuel/[id]/route.ts`

- [ ] **Step 1: Create app/api/fuel/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getFuelFillups, insertFuelFillup } from "@/lib/queries/fuel-fillups";
import { json, readBody } from "@/lib/api";

const FuelFillupSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  liters: z.number().positive(),
  odometer: z.number().int().nonnegative().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async () => getFuelFillups(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, FuelFillupSchema);
  const id = insertFuelFillup(getDb(), body);
  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Create app/api/fuel/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  getFuelFillupById,
  updateFuelFillup,
  deleteFuelFillup,
} from "@/lib/queries/fuel-fillups";
import { json, readBody, readId, notFound } from "@/lib/api";

const FuelFillupSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  liters: z.number().positive(),
  odometer: z.number().int().nonnegative().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getFuelFillupById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, FuelFillupSchema);
  updateFuelFillup(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteFuelFillup(getDb(), id);
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/fuel/
git commit -m "feat: fuel fill-up API routes with zod validation"
```

---

### Task 4: Fuel fill-up hook

**Files:**
- Create: `hooks/use-fuel-fillups.ts`

- [ ] **Step 1: Create hooks/use-fuel-fillups.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { FuelFillup, FuelFillupInput } from "@/types";

export const fuelFillupsHooks = createResourceHooks<FuelFillup, FuelFillupInput>(
  "fuel-fillups",
  "/api/fuel",
  // Writes also mutate the car's "last state" (odometer/location), so invalidate
  // every ["car-state", carId] cache alongside the dashboard.
  { invalidate: [["dashboard"], ["car-state"]] }
);

export const useFuelFillups = fuelFillupsHooks.useList;
export const useCreateFuelFillup = fuelFillupsHooks.useCreate;
export const useUpdateFuelFillup = fuelFillupsHooks.useUpdate;
export const useDeleteFuelFillup = fuelFillupsHooks.useDelete;
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-fuel-fillups.ts
git commit -m "feat: useFuelFillups hooks"
```

---

### Task 5: Receipt upload component

**Files:**
- Create: `components/receipt-upload.tsx`

- [ ] **Step 1: Create components/receipt-upload.tsx**

```tsx
"use client";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

interface Props {
  value: string | null;
  onChange: (path: string) => void;
}

export function ReceiptUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Upload failed");
      }
      const data = await res.json();
      onChange(data.path);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="border rounded-md p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50"
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value ? (
        <img src={value} alt={t("form.receipt")} className="max-h-32 rounded object-contain" />
      ) : (
        <>
          <Camera className={`w-6 h-6 ${uploading ? "animate-pulse text-blue-500" : "text-gray-400"}`} />
          <span className="text-xs text-gray-500">
            {uploading ? t("state.uploading") : t("form.receipt_add")}
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/receipt-upload.tsx
git commit -m "feat: receipt-upload component"
```

---

### Task 6: Fuel page and form

**Files:**
- Create: `app/fuel/fuel-form.tsx`
- Create: `app/fuel/page.tsx`
- Modify: `components/nav-drawer.tsx` (already links to `/fuel` from plan 04)

- [ ] **Step 1: Create app/fuel/fuel-form.tsx**

```tsx
"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { ReceiptUpload } from "@/components/receipt-upload";
import { LocationPicker } from "@/components/location-picker";
import { calcPricePerLiter } from "@/lib/formulas";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import { useLastCarState } from "@/hooks/use-car-state";
import type { FuelFillup, FuelFillupInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  car_id: z.number({ required_error: t("validation.car_required") }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  liters: z.coerce.number().positive(),
  odometer: z.coerce.number().int().nullable().optional(),
  receipt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<FuelFillup>;
  onSubmit: (data: FuelFillupInput) => void;
  onCancel: () => void;
}

export function FuelForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const isAddMode = !defaultValues?.id;
  const { register, handleSubmit, control, watch, setValue, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      liters: 0,
      odometer: null,
      receipt: null,
      location: null,
      ...defaultValues,
    },
  });

  const [amount, liters, carId] = watch(["amount", "liters", "car_id"]);
  const pricePerLiter = calcPricePerLiter(amount ?? 0, liters ?? 0);

  // Last known state (odometer + location) for the selected car.
  // Only `odometer` is consumed here: location on a fuel fill-up is the gas
  // station, which differs per visit, so we leave the LocationPicker blank
  // for the user to fill via GPS or manual map click.
  const { data: lastState } = useLastCarState(carId);
  useEffect(() => {
    if (!isAddMode || !carId || !lastState) return;
    const current = getValues("odometer");
    if ((!current || Number(current) === 0) && lastState.odometer != null) {
      setValue("odometer", lastState.odometer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastState, carId, isAddMode]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
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
        <label className="block text-sm font-medium mb-1">{t("form.date")}</label>
        <input
          {...register("date")}
          type="date"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.amount_euro_required")}</label>
          <input
            {...register("amount")}
            type="number"
            step="0.01"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.liters")}</label>
          <input
            {...register("liters")}
            type="number"
            step="0.01"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.price_per_liter")}</label>
          <input
            readOnly
            value={pricePerLiter.toFixed(3)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("form.odometer")}</label>
          <input
            {...register("odometer")}
            type="number"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.receipt")}</label>
        <Controller
          name="receipt"
          control={control}
          render={({ field }) => (
            <ReceiptUpload value={field.value ?? null} onChange={field.onChange} />
          )}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.location")}</label>
        <Controller
          name="location"
          control={control}
          render={({ field }) => (
            <LocationPicker value={field.value ?? null} onChange={field.onChange} />
          )}
        />
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

- [ ] **Step 2: Create app/fuel/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { FuelForm } from "./fuel-form";
import {
  useFuelFillups,
  useCreateFuelFillup,
  useUpdateFuelFillup,
  useDeleteFuelFillup,
} from "@/hooks/use-fuel-fillups";
import type { FuelFillup } from "@/types";
import { t } from "@/lib/i18n";

function yearMonth(date: string) {
  const [y, m] = date.split("-");
  return `${y}-${m}`;
}

export default function FuelPage() {
  const { data: fillups = [], isLoading } = useFuelFillups();
  const createF = useCreateFuelFillup();
  const updateF = useUpdateFuelFillup();
  const deleteF = useDeleteFuelFillup();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FuelFillup | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("page.fuel")} />
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("page.fuel")} />
      <GroupedList
        items={fillups}
        getKey={(f) => yearMonth(f.date)}
        getGroupLabel={(key) => {
          const [y, m] = key.split("-");
          return `${y}-${Number(m)}`;
        }}
        getGroupTotal={(items) => items.reduce((s, f) => s + f.amount, 0)}
        renderItem={(f) => (
          <button
            key={f.id}
            onClick={() => setEditing(f)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{f.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                  {f.car_short}
                </span>
                <span className="text-xs text-gray-500 ml-auto">{f.date}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm font-medium">€ {f.amount.toFixed(2)}</span>
                <span className="text-xs text-gray-400">
                  {f.liters} L · €{f.price_per_liter.toFixed(3)}/L
                </span>
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
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.fuel_add")}
            </Dialog.Title>
            <FuelForm
              onSubmit={(data) =>
                createF.mutate(data, {
                  onSuccess: () => {
                    setAdding(false);
                    toast.success(t("toast.fuel_saved"));
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
          <Dialog.Content className="fixed inset-x-0 bottom-0 bg-white rounded-t-xl z-50 max-h-[95vh] overflow-y-auto">
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.fuel_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <FuelForm
                  defaultValues={editing}
                  onSubmit={(data) =>
                    updateF.mutate(
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
                      deleteF.mutate(editing.id, {
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

      <Fab onClick={() => setAdding(true)} label={t("page.fuel_add")} />
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Navigate to http://localhost:3000/fuel. Verify:
- Add entry — `prijs/liter` auto-calculates from `bedrag` and `liter`.
- Pick a car that has prior trips or fill-ups: `Kilometerstand` prefills from the car's last known odometer. Clear the field and pick a different car — it refills. Editing an existing fill-up does NOT refill the odometer.
- `Locatie` starts empty even after picking a car (gas stations change per visit). GPS button captures the station location; map click or GPS both update the pin.
- Receipt upload opens camera on mobile / file picker on desktop.
- Upload rejects files > 8 MB and non-image MIME types.
- List groups by month with euro total in header badge.
- Edit + delete both work — editing a fill-up preserves its stored `location`.

- [ ] **Step 4: Commit**

```bash
git add app/fuel/
git commit -m "feat: fuel page with receipt upload and auto price-per-liter"
```
