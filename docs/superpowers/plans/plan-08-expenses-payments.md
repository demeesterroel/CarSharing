# CarSharing — Plan 08: Expenses & Payments

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisites:** plans 00, 01, 02, 02b, 03, 03b (i18n), 04, 05, 06, 07 completed.

**Goal:** Query helpers, API routes, and pages for `expenses` (Extra Kosten — maintenance/tax costs) and `payments` (Betaald — settlement payments). Both follow the same shape as trips and fuel.

**Architecture:** Two independent resources. Expenses attach to `(person, car)`; payments attach to `(person)` only and carry a computed `year` column (datum year − 1, from the AppSheet `calcBetaaldYear` helper). User-facing strings resolve through `t()` from `@/lib/i18n` (plan-03b).

**Tech Stack:** better-sqlite3, Zod, TanStack Query, React Hook Form, Radix Dialog.

---

### Task 1: Expenses query helpers

**Files:**
- Create: `lib/queries/expenses.ts`

- [ ] **Step 1: Create lib/queries/expenses.ts**

```ts
import type Database from "better-sqlite3";
import type { Expense, ExpenseInput } from "@/types";

export function getExpenses(db: Database.Database): Expense[] {
  return db.prepare(`
    SELECT e.*, p.name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    ORDER BY e.date DESC, e.id DESC
  `).all() as Expense[];
}

export function getExpenseById(db: Database.Database, id: number): Expense | null {
  return (db.prepare(`
    SELECT e.*, p.name AS person_name, c.short AS car_short
    FROM expenses e
    JOIN people p ON p.id = e.person_id
    JOIN cars c ON c.id = e.car_id
    WHERE e.id = ?
  `).get(id) as Expense) ?? null;
}

export function insertExpense(db: Database.Database, input: ExpenseInput): number {
  const result = db.prepare(`
    INSERT INTO expenses (person_id,car_id,date,amount,description) VALUES (?,?,?,?,?)
  `).run(
    input.person_id, input.car_id, input.date, input.amount,
    input.description ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateExpense(db: Database.Database, id: number, input: ExpenseInput): void {
  db.prepare(`
    UPDATE expenses SET person_id=?,car_id=?,date=?,amount=?,description=? WHERE id=?
  `).run(
    input.person_id, input.car_id, input.date, input.amount,
    input.description ?? null, id
  );
}

export function deleteExpense(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM expenses WHERE id=?").run(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/expenses.ts
git commit -m "feat: expense query helpers"
```

---

### Task 2: Expenses API routes

**Files:**
- Create: `app/api/expenses/route.ts`
- Create: `app/api/expenses/[id]/route.ts`

- [ ] **Step 1: Create app/api/expenses/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getExpenses, insertExpense } from "@/lib/queries/expenses";
import { json, readBody } from "@/lib/api";

const ExpenseSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
});

export const GET = json(async () => getExpenses(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, ExpenseSchema);
  const id = insertExpense(getDb(), body);
  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Create app/api/expenses/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "@/lib/queries/expenses";
import { json, readBody, readId, notFound } from "@/lib/api";

const ExpenseSchema = z.object({
  person_id: z.number().int().positive(),
  car_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getExpenseById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, ExpenseSchema);
  updateExpense(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deleteExpense(getDb(), id);
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/expenses/
git commit -m "feat: expenses API routes with zod validation"
```

---

### Task 3: Expenses hook and page

**Files:**
- Create: `hooks/use-expenses.ts`
- Create: `app/expenses/expense-form.tsx`
- Create: `app/expenses/page.tsx`

- [ ] **Step 1: Create hooks/use-expenses.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Expense, ExpenseInput } from "@/types";

export const expensesHooks = createResourceHooks<Expense, ExpenseInput>(
  "expenses",
  "/api/expenses",
  { invalidate: [["dashboard"]] }
);

export const useExpenses = expensesHooks.useList;
export const useCreateExpense = expensesHooks.useCreate;
export const useUpdateExpense = expensesHooks.useUpdate;
export const useDeleteExpense = expensesHooks.useDelete;
```

- [ ] **Step 2: Create app/expenses/expense-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CarToggle } from "@/components/car-toggle";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import { useCars } from "@/hooks/use-cars";
import type { Expense, ExpenseInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  car_id: z.number({ required_error: t("validation.car_required") }),
  date: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Expense>;
  onSubmit: (data: ExpenseInput) => void;
  onCancel: () => void;
}

export function ExpenseForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { data: cars = [] } = useCars();
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      description: null,
      ...defaultValues,
    },
  });

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
        <label className="block text-sm font-medium mb-1">{t("form.description")}</label>
        <input
          {...register("description")}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder={t("form.description_placeholder")}
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

- [ ] **Step 3: Create app/expenses/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { GroupedList } from "@/components/grouped-list";
import { Fab } from "@/components/fab";
import { ExpenseForm } from "./expense-form";
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "@/hooks/use-expenses";
import type { Expense } from "@/types";
import { t } from "@/lib/i18n";

export default function ExpensesPage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const createE = useCreateExpense();
  const updateE = useUpdateExpense();
  const deleteE = useDeleteExpense();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("page.expenses")} />
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("page.expenses")} />
      <GroupedList
        items={expenses}
        getKey={(e) => e.date.slice(0, 7)}
        getGroupLabel={(key) => {
          const [y, m] = key.split("-");
          return `${y}-${Number(m)}`;
        }}
        getGroupTotal={(items) => items.reduce((s, e) => s + e.amount, 0)}
        renderItem={(e) => (
          <button
            key={e.id}
            onClick={() => setEditing(e)}
            className="w-full flex items-center px-4 py-3 border-b hover:bg-gray-50 text-left gap-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{e.person_name}</span>
                <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                  {e.car_short}
                </span>
                <span className="text-xs text-gray-500 ml-auto">{e.date}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-sm text-gray-600">{e.description}</span>
                <span className="text-sm font-medium ml-auto">€ {e.amount.toFixed(2)}</span>
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
              {t("page.expense_add")}
            </Dialog.Title>
            <ExpenseForm
              onSubmit={(data) =>
                createE.mutate(data, {
                  onSuccess: () => {
                    setAdding(false);
                    toast.success(t("toast.saved"));
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
              {t("page.expense_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <ExpenseForm
                  defaultValues={editing}
                  onSubmit={(data) =>
                    updateE.mutate(
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
                      deleteE.mutate(editing.id, {
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

      <Fab onClick={() => setAdding(true)} label={t("page.expense_add")} />
    </>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to http://localhost:3000/expenses. Add an expense — it shows under the matching month with running total.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-expenses.ts app/expenses/
git commit -m "feat: expenses page with grouped list"
```

---

### Task 4: Payment query helpers

**Files:**
- Create: `lib/queries/payments.ts`

- [ ] **Step 1: Create lib/queries/payments.ts**

```ts
import type Database from "better-sqlite3";
import type { Payment, PaymentInput } from "@/types";
import { calcPaymentYear } from "@/lib/formulas";

export function getPayments(db: Database.Database): Payment[] {
  return db.prepare(`
    SELECT b.*, p.name AS person_name
    FROM payments b
    JOIN people p ON p.id = b.person_id
    ORDER BY b.date DESC, b.id DESC
  `).all() as Payment[];
}

export function getPaymentById(db: Database.Database, id: number): Payment | null {
  return (db.prepare(`
    SELECT b.*, p.name AS person_name FROM payments b
    JOIN people p ON p.id = b.person_id WHERE b.id=?
  `).get(id) as Payment) ?? null;
}

export function insertPayment(db: Database.Database, input: PaymentInput): number {
  const year = calcPaymentYear(input.date);
  const result = db.prepare(
    "INSERT INTO payments (person_id,date,amount,note,year) VALUES (?,?,?,?,?)"
  ).run(input.person_id, input.date, input.amount, input.note ?? null, year);
  return result.lastInsertRowid as number;
}

export function updatePayment(db: Database.Database, id: number, input: PaymentInput): void {
  const year = calcPaymentYear(input.date);
  db.prepare("UPDATE payments SET person_id=?,date=?,amount=?,note=?,year=? WHERE id=?")
    .run(input.person_id, input.date, input.amount, input.note ?? null, year, id);
}

export function deletePayment(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM payments WHERE id=?").run(id);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/payments.ts
git commit -m "feat: payment query helpers"
```

---

### Task 5: Payments API routes

**Files:**
- Create: `app/api/payments/route.ts`
- Create: `app/api/payments/[id]/route.ts`

- [ ] **Step 1: Create app/api/payments/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPayments, insertPayment } from "@/lib/queries/payments";
import { json, readBody } from "@/lib/api";

const PaymentSchema = z.object({
  person_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number(),
  note: z.string().nullable().optional(),
});

export const GET = json(async () => getPayments(getDb()));

export const POST = json(async (req) => {
  const body = await readBody(req, PaymentSchema);
  const id = insertPayment(getDb(), body);
  return new Response(JSON.stringify({ id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Create app/api/payments/[id]/route.ts**

```ts
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  getPaymentById,
  updatePayment,
  deletePayment,
} from "@/lib/queries/payments";
import { json, readBody, readId, notFound } from "@/lib/api";

const PaymentSchema = z.object({
  person_id: z.number().int().positive(),
  date: z.string().min(10),
  amount: z.number(),
  note: z.string().nullable().optional(),
});

export const GET = json(async (_req, ctx) => {
  const id = await readId(ctx);
  const row = getPaymentById(getDb(), id);
  if (!row) notFound();
  return row;
});

export const PUT = json(async (req, ctx) => {
  const id = await readId(ctx);
  const body = await readBody(req, PaymentSchema);
  updatePayment(getDb(), id, body);
  return { ok: true };
});

export const DELETE = json(async (_req, ctx) => {
  const id = await readId(ctx);
  deletePayment(getDb(), id);
  return { ok: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/payments/
git commit -m "feat: payments API routes with zod validation"
```

---

### Task 6: Payments hook and page

**Files:**
- Create: `hooks/use-payments.ts`
- Create: `app/payments/payment-form.tsx`
- Create: `app/payments/page.tsx`

- [ ] **Step 1: Create hooks/use-payments.ts**

```ts
import { createResourceHooks } from "./use-resource";
import type { Payment, PaymentInput } from "@/types";

export const paymentsHooks = createResourceHooks<Payment, PaymentInput>(
  "payments",
  "/api/payments",
  { invalidate: [["dashboard"]] }
);

export const usePayments = paymentsHooks.useList;
export const useCreatePayment = paymentsHooks.useCreate;
export const useUpdatePayment = paymentsHooks.useUpdate;
export const useDeletePayment = paymentsHooks.useDelete;
```

- [ ] **Step 2: Create app/payments/payment-form.tsx**

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PersonSelect } from "@/components/person-select";
import { usePeople } from "@/hooks/use-people";
import type { Payment, PaymentInput } from "@/types";
import { t } from "@/lib/i18n";

const schema = z.object({
  person_id: z.number({ required_error: t("validation.person_required") }),
  date: z.string().min(1),
  amount: z.coerce.number(),
  note: z.string().nullable().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Payment>;
  onSubmit: (data: PaymentInput) => void;
  onCancel: () => void;
}

export function PaymentForm({ defaultValues, onSubmit, onCancel }: Props) {
  const { data: people = [] } = usePeople();
  const { register, handleSubmit, control } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      note: null,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.name")}</label>
        <Controller
          name="person_id"
          control={control}
          render={({ field }) => (
            <PersonSelect people={people} value={field.value} onChange={field.onChange} />
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
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.amount_euro")}</label>
        <input
          {...register("amount")}
          type="number"
          step="0.01"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("form.note")}</label>
        <input
          {...register("note")}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder={t("form.note_placeholder")}
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

- [ ] **Step 3: Create app/payments/page.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Fab } from "@/components/fab";
import { PaymentForm } from "./payment-form";
import {
  usePayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
} from "@/hooks/use-payments";
import type { Payment } from "@/types";
import { t } from "@/lib/i18n";

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = usePayments();
  const createP = useCreatePayment();
  const updateP = useUpdatePayment();
  const deleteP = useDeletePayment();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t("page.payments")} />
        <p className="p-4 text-gray-500">{t("state.loading")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("page.payments")} />
      <div className="divide-y">
        {payments.map((b) => (
          <button
            key={b.id}
            onClick={() => setEditing(b)}
            className="w-full flex items-center px-4 py-3 hover:bg-gray-50 text-left gap-3"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{b.person_name}</span>
                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{b.year}</span>
                <span className="text-xs text-gray-500 ml-auto">{b.date}</span>
              </div>
              <div className="flex items-center mt-0.5">
                <span className="text-xs text-gray-500">{b.note}</span>
                <span className="text-sm font-medium ml-auto">€ {b.amount.toFixed(2)}</span>
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
            <Dialog.Title className="px-4 pt-4 text-base font-semibold">
              {t("page.payment_add")}
            </Dialog.Title>
            <PaymentForm
              onSubmit={(data) =>
                createP.mutate(data, {
                  onSuccess: () => {
                    setAdding(false);
                    toast.success(t("toast.payment_saved"));
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
              {t("page.payment_edit")}
            </Dialog.Title>
            {editing && (
              <>
                <PaymentForm
                  defaultValues={editing}
                  onSubmit={(data) =>
                    updateP.mutate(
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
                      deleteP.mutate(editing.id, {
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

      <Fab onClick={() => setAdding(true)} label={t("page.payment_add")} />
    </>
  );
}
```

- [ ] **Step 4: Verify in browser**

Navigate to http://localhost:3000/payments. Add a payment — `year` badge shows `date.year - 1` (server-computed via `calcPaymentYear`).

- [ ] **Step 5: Commit**

```bash
git add hooks/use-payments.ts app/payments/
git commit -m "feat: payments page"
```
