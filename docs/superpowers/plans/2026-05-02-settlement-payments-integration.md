# Settlement–Payments Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the `payments` table to the annual settlement calculation so the admin settlement page shows, per transfer, how much has been paid and what remains outstanding, enabling the admin to confirm all bank transfers are complete before closing a year.

**Architecture:** A new `getPaymentsByYear(db, year)` query fetches payments filtered by their `year` column; a new `getSettlementWithPayments(db, year)` function (or extension of the settlement API route) merges payment totals per person into `SettlementResult`; the settlement page UI gains a per-transfer payment status row showing amount due, amount paid, and open balance; no DB schema changes are needed because `payments.year` already tracks which settlement year a payment belongs to.

**Tech Stack:** better-sqlite3, Next.js App Router, React Query (`@tanstack/react-query`), TypeScript, Vitest, paper-theme inline styles.

---

## Design decisions resolved

### 1. How are payments linked to a settlement year?

The `payments` table already has a `year` column set to `date.year − 1` at insert time (see `calcPaymentYear` in `lib/formulas.ts`). A payment dated 2026-03-01 gets `year = 2025`, meaning it settles the 2025 settlement. **We match payments to a settlement year via `payments.year = ?`** — no date-range matching is needed.

### 2. How do we handle partial payments?

We sum all payments for a given `person_id` and `year`. The settlement page shows:

- **Due:** the signed settlement amount (S₁ for non-owners, net = S₂ + X for owners)
- **Paid:** total of `SUM(payments.amount) WHERE person_id = ? AND year = ?`
- **Open:** due − paid (capped at zero for display when overpaid)

Partial payments are shown naturally: if due is −€120 and paid is −€80, open is −€40.

### 3. How do we show the 3-step transfer structure alongside payment status?

Each transfer in `settlement.transfers` has a `from`, `to`, `amount`, and `step`. For each transfer we look up:

- **Step 1** (member → co-op or co-op → member): the `from` or `to` person's payment record for the year. The payer is always the person with a negative S₁ (they owe the co-op). If S₁ < 0, the member must pay; if S₁ > 0, the co-op must pay the member.
- **Step 2** (co-op → owner or owner → co-op): the owner's payment record for the year. `net = s2 + x`; if net > 0 the co-op pays the owner, if net < 0 the owner pays the co-op.
- **Step 3** (owner → owner): inter-owner direct payments. The payer (from) must pay.

Each transfer gets a `paid` field (from the payments table) and an `open` field computed client-side.

### 4. Should freeze/unfreeze be gated on all payments confirmed?

No — keep freeze as a soft-lock only. The admin decides when the year is "done." Gating on payments creates friction when partial or out-of-band payments exist. Instead we show a warning badge when outstanding > €0 but allow freezing anyway.

### 5. "Settled outside the app" escape hatch

Rather than a separate UI for marking individual transfers as manually settled, we rely on the existing payment entry flow: the admin adds a payment in the Payments page (already accessible) with a note like "Contant verrekend". The reconciliation automatically picks it up via `payments.year`. No new data model is needed.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `lib/queries/payments.ts` | Modify | Add `getPaymentsByYear(db, year)` returning per-person totals |
| `lib/__tests__/queries_payments.test.ts` | Modify | Add tests for `getPaymentsByYear` |
| `types/index.ts` | Modify | Add `PaymentSummary`, extend `Transfer` with `paid` and `open` fields, add `SettlementPayments` to `SettlementResult` |
| `app/api/settlement/[year]/route.ts` | Modify | Merge payment totals into the settlement response |
| `lib/queries/settlement.ts` | Modify | Annotate each transfer with `paid` and `open` using payment data |
| `app/admin/settlement/page.tsx` | Modify | Add payment status row under each transfer card |
| `lib/i18n/messages/nl.ts` | Modify | Add `settlement.payment_status.*` translation keys |
| `lib/i18n/messages/en.ts` | Modify | Same keys in English |

---

## Task 1: Add `getPaymentsByYear` query + tests

**Files:**
- Modify: `lib/queries/payments.ts`
- Modify: `lib/__tests__/queries_payments.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to lib/__tests__/queries_payments.test.ts

import { getPaymentsByYear } from "../queries/payments";

describe("getPaymentsByYear", () => {
  it("returns empty map when no payments exist for year", () => {
    const db = makeDb();
    seed(db);
    const map = getPaymentsByYear(db, 2025);
    expect(map.size).toBe(0);
  });

  it("sums payments per person for the correct year", () => {
    const db = makeDb();
    seed(db);
    // Alice pays 100 for year 2025 (date 2026-03-01 → year = 2025)
    insertPayment(db, { person_id: 1, date: "2026-03-01", amount: 100, note: null });
    insertPayment(db, { person_id: 1, date: "2026-04-01", amount: 50, note: null });
    // Bob pays for 2025
    insertPayment(db, { person_id: 2, date: "2026-02-01", amount: 75, note: null });
    // Alice pays for 2026 (date 2027-03-01 → year = 2026) — must NOT appear
    insertPayment(db, { person_id: 1, date: "2027-03-01", amount: 999, note: null });

    const map = getPaymentsByYear(db, 2025);
    expect(map.get(1)).toBeCloseTo(150, 2);
    expect(map.get(2)).toBeCloseTo(75, 2);
    expect(map.has(1)).toBe(true);
    expect(map.size).toBe(2);
  });

  it("returns 0 for year with no payments", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 1, date: "2026-03-01", amount: 100, note: null });
    const map = getPaymentsByYear(db, 2024);
    expect(map.size).toBe(0);
  });
});
```

Run the test (expect failure):

```bash
npx vitest run lib/__tests__/queries_payments.test.ts 2>&1 | tail -20
```

Expected: `getPaymentsByYear is not a function` or import error.

- [ ] **Step 2: Implement `getPaymentsByYear`**

Add to `lib/queries/payments.ts`:

```typescript
/**
 * Returns a Map<person_id, total_paid> for all payments in the given settlement year.
 * Payments are associated with a settlement year via the `year` column
 * (set to date.year − 1 at insert time, so a 2026 payment settles 2025).
 */
export function getPaymentsByYear(db: Database.Database, year: number): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT person_id, COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE year = ?
       GROUP BY person_id`
    )
    .all(year) as { person_id: number; total: number }[];
  return new Map(rows.map((r) => [r.person_id, r.total]));
}
```

- [ ] **Step 3: Run tests, expect green**

```bash
npx vitest run lib/__tests__/queries_payments.test.ts 2>&1 | tail -20
```

Expected output: all tests pass, no failures.

- [ ] **Step 4: Commit**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add lib/queries/payments.ts lib/__tests__/queries_payments.test.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "feat(payments): add getPaymentsByYear query for settlement reconciliation (#87)"
```

---

## Task 2: Extend types — `PaymentSummary`, annotated `Transfer`, `SettlementResult`

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add new types**

In `types/index.ts`, after the existing `Transfer` interface, add:

```typescript
export interface TransferPaymentStatus {
  /** Total amount paid toward this transfer (from the payments table). */
  paid: number;
  /** Amount still outstanding: Math.max(0, amount - paid). */
  open: number;
}

export interface AnnotatedTransfer extends Transfer {
  /** Payment status for this transfer, if the payer is a known person (not "co-op"). */
  payment_status: TransferPaymentStatus | null;
}
```

Extend `SettlementResult`:

```typescript
export interface SettlementResult {
  year: number;
  frozen: boolean;
  settled_at: string | null;
  settled_by: string | null;
  members: MemberStatement[];
  transfers: AnnotatedTransfer[];  // was: Transfer[]
  verify_ok: boolean;
  /** Keyed by person_id; total paid for this settlement year. */
  payments_by_person: Record<number, number>;
  /** True when every transfer with a human payer has open === 0. */
  all_paid: boolean;
}
```

- [ ] **Step 2: Run TypeScript check to confirm no regressions**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npx tsc --noEmit 2>&1 | head -40)
```

Expected: zero new errors (there may be pre-existing errors — note the count before vs after).

- [ ] **Step 3: Commit**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add types/index.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "feat(types): add AnnotatedTransfer and TransferPaymentStatus for settlement-payments reconciliation (#87)"
```

---

## Task 3: Integrate payments into `getSettlement`

**Files:**
- Modify: `lib/queries/settlement.ts`
- Modify: `lib/__tests__/settlement.test.ts`

The plan is to:
1. Call `getPaymentsByYear(db, year)` at the end of `getSettlement`.
2. Annotate each transfer with its payment status: look up the payer's person_id and compute `paid` and `open`.
3. Add `payments_by_person` and `all_paid` to the returned object.

We need a helper to resolve a transfer payer's person_id from the `people` table (since transfers use names, not IDs).

- [ ] **Step 1: Write the failing settlement integration tests**

Add to `lib/__tests__/settlement.test.ts` (after existing describes):

```typescript
import { insertPayment } from "../queries/payments";

describe("getSettlement — payment integration", () => {
  it("annotates step-1 transfers with payment status when no payments exist", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    const step1 = result.transfers.filter((t) => t.step === 1);
    // All transfers should have payment_status with paid=0 and open=amount
    for (const t of step1) {
      if (t.payment_status !== null) {
        expect(t.payment_status.paid).toBe(0);
        expect(t.payment_status.open).toBeCloseTo(t.amount, 2);
      }
    }
  });

  it("reflects partial payment in transfer payment_status", () => {
    const db = makeDb();
    seed(db);
    const result0 = getSettlement(db, 2025);
    // Find Carol's step-1 transfer (Carol has s1 < 0 → she owes the co-op)
    const carolTransfer = result0.transfers.find(
      (t) => t.step === 1 && t.from === "Carol"
    );
    if (!carolTransfer) return; // skip if Carol has no debt
    const carolId = 3; // from seed
    // Carol pays half
    const halfAmount = carolTransfer.amount / 2;
    insertPayment(db, {
      person_id: carolId,
      date: "2026-03-01", // year = 2025
      amount: halfAmount,
      note: null,
    });
    const result1 = getSettlement(db, 2025);
    const carolT = result1.transfers.find((t) => t.step === 1 && t.from === "Carol")!;
    expect(carolT.payment_status).not.toBeNull();
    expect(carolT.payment_status!.paid).toBeCloseTo(halfAmount, 2);
    expect(carolT.payment_status!.open).toBeCloseTo(halfAmount, 2);
  });

  it("reports all_paid=false when outstanding payments remain", () => {
    const db = makeDb();
    seed(db);
    const result = getSettlement(db, 2025);
    // No payments recorded → all_paid should be false (assuming any transfers exist)
    if (result.transfers.some((t) => t.payment_status !== null)) {
      expect(result.all_paid).toBe(false);
    }
  });

  it("reports all_paid=true when all transfers are fully paid", () => {
    const db = makeDb();
    seed(db);
    // Settle Carol and Dave fully
    const carolId = 3;
    const daveId = 4;
    const result0 = getSettlement(db, 2025);
    for (const t of result0.transfers) {
      if (t.step === 1 && t.from === "Carol") {
        insertPayment(db, { person_id: carolId, date: "2026-03-01", amount: t.amount, note: null });
      }
      if (t.step === 1 && t.from === "Dave") {
        insertPayment(db, { person_id: daveId, date: "2026-03-01", amount: t.amount, note: null });
      }
      if (t.step === 2 && t.from === "Alice") {
        insertPayment(db, { person_id: 1, date: "2026-03-01", amount: t.amount, note: null });
      }
      if (t.step === 2 && t.from === "Bob") {
        insertPayment(db, { person_id: 2, date: "2026-03-01", amount: t.amount, note: null });
      }
    }
    const result1 = getSettlement(db, 2025);
    expect(result1.all_paid).toBe(true);
  });

  it("includes payments_by_person in the result", () => {
    const db = makeDb();
    seed(db);
    insertPayment(db, { person_id: 3, date: "2026-03-01", amount: 55, note: null });
    const result = getSettlement(db, 2025);
    expect(result.payments_by_person[3]).toBeCloseTo(55, 2);
  });
});
```

Run (expect failure):

```bash
npx vitest run lib/__tests__/settlement.test.ts 2>&1 | tail -30
```

Expected: type errors or `payment_status is undefined`.

- [ ] **Step 2: Implement payment annotation in `getSettlement`**

In `lib/queries/settlement.ts`, add to imports:

```typescript
import { getPaymentsByYear } from "./payments";
```

Add this helper function after `round2`:

```typescript
/**
 * Builds a Map<name, person_id> from the people list for resolving
 * transfer payer/payee names back to IDs.
 */
function buildNameToId(people: PersonRow[]): Map<string, number> {
  return new Map(people.map((p) => [p.name, p.id]));
}
```

At the end of `getSettlement`, before the final `return`, replace the `transfers` construction and add payment annotation. The full revised section (after building `transfers` in steps 13):

```typescript
  // 14. Load payments for this year and annotate transfers
  const paymentsByPerson = getPaymentsByYear(db, year);
  const nameToId = buildNameToId(people);

  const annotatedTransfers = transfers.map((tr) => {
    // Identify the human payer: for step 1/2, the "from" side may be a person
    // or "co-op". For step 3, both sides are owners.
    // We annotate from the payer's perspective (who has to make the bank transfer).
    let payerName: string | null = null;
    if (tr.step === 1) {
      // member owes co-op: from = member name; co-op owes member: from = "co-op"
      payerName = tr.from !== "co-op" ? tr.from : null;
    } else if (tr.step === 2) {
      // co-op owes owner: from = "co-op"; owner owes co-op: from = owner name
      payerName = tr.from !== "co-op" ? tr.from : null;
    } else if (tr.step === 3) {
      // inter-owner: from = the paying owner
      payerName = tr.from;
    }

    if (payerName === null) {
      // co-op is the payer — no payment record to track
      return { ...tr, payment_status: null };
    }

    const payerId = nameToId.get(payerName) ?? null;
    if (payerId === null) {
      return { ...tr, payment_status: null };
    }

    const paid = round2(paymentsByPerson.get(payerId) ?? 0);
    const open = round2(Math.max(0, tr.amount - paid));
    return { ...tr, payment_status: { paid, open } };
  });

  // 15. Compute all_paid flag
  const humanTransfers = annotatedTransfers.filter((t) => t.payment_status !== null);
  const all_paid =
    humanTransfers.length === 0 ||
    humanTransfers.every((t) => (t.payment_status?.open ?? 1) < 0.005);

  // 16. Verify
  const sumS1 = [...S1.values()].reduce((s, v) => s + v, 0);
  const sumS2 = [...S2.values()].reduce((s, v) => s + v, 0);
  const verify_ok = Math.abs(sumS1 + sumS2) < 0.05;

  return {
    year,
    frozen: !!lock,
    settled_at: lock?.settled_at ?? null,
    settled_by: lock?.settled_by ?? null,
    members,
    transfers: annotatedTransfers,
    verify_ok,
    payments_by_person: Object.fromEntries(paymentsByPerson),
    all_paid,
  };
```

Note: remove the old verify section (step 14 in original) which becomes step 16 above.

- [ ] **Step 3: Run settlement tests**

```bash
npx vitest run lib/__tests__/settlement.test.ts 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add lib/queries/settlement.ts lib/__tests__/settlement.test.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "feat(settlement): annotate transfers with payment status from payments table (#87)"
```

---

## Task 4: Add i18n keys for payment status

**Files:**
- Modify: `lib/i18n/messages/nl.ts`
- Modify: `lib/i18n/messages/en.ts`

- [ ] **Step 1: Add Dutch keys**

In `lib/i18n/messages/nl.ts`, after the existing `"settlement.collapse_breakdown"` line, add:

```typescript
  "settlement.payment_due": "Te betalen",
  "settlement.payment_paid": "Betaald",
  "settlement.payment_open": "Openstaand",
  "settlement.payment_all_paid": "Alle overschrijvingen bevestigd",
  "settlement.payment_outstanding": "{count} overschrijving{plural} nog openstaand",
  "settlement.payment_status_title": "Betalingsstatus",
  "settlement.coop_pays": "Coöp betaalt uit",
  "settlement.member_pays": "Lid betaalt",
  "settlement.fully_paid": "Volledig betaald",
  "settlement.partially_paid": "Gedeeltelijk betaald",
  "settlement.unpaid": "Nog niet betaald",
```

- [ ] **Step 2: Add English keys**

In `lib/i18n/messages/en.ts`, after the existing `"settlement.collapse_breakdown"` line, add:

```typescript
  "settlement.payment_due": "Due",
  "settlement.payment_paid": "Paid",
  "settlement.payment_open": "Outstanding",
  "settlement.payment_all_paid": "All transfers confirmed",
  "settlement.payment_outstanding": "{count} transfer{plural} still outstanding",
  "settlement.payment_status_title": "Payment status",
  "settlement.coop_pays": "Co-op pays out",
  "settlement.member_pays": "Member pays",
  "settlement.fully_paid": "Fully paid",
  "settlement.partially_paid": "Partially paid",
  "settlement.unpaid": "Not yet paid",
```

- [ ] **Step 3: TypeScript check**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npx tsc --noEmit 2>&1 | head -20)
```

Expected: no new type errors (the `Messages` type is derived from `nl.ts`, so `en.ts` must have all the same keys — TypeScript will catch any mismatch).

- [ ] **Step 4: Commit**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add lib/i18n/messages/nl.ts lib/i18n/messages/en.ts
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "feat(i18n): add settlement payment status translation keys (#87)"
```

---

## Task 5: Update the settlement page — payment status UI

**Files:**
- Modify: `app/admin/settlement/page.tsx`

The goal is to show, for each transfer in the transfer list, a payment status row:

```
Carol → co-op          € 180,00
  Te betalen: € 180,00  |  Betaald: € 80,00  |  Openstaand: € 100,00
  [●●●●●○○○○○]  44% betaald
```

And a summary banner at the top of the transfer section:
- Green: "Alle overschrijvingen bevestigd" when `all_paid === true`
- Orange: "2 overschrijvingen nog openstaand" when `all_paid === false`

Implementation notes:
- The `settlement.transfers` array now contains `AnnotatedTransfer` objects — use `t.payment_status` directly.
- For transfers where `payment_status === null` (co-op is the payer), show no payment row — the co-op's outbound transfers are tracked separately.
- Keep the existing transfer card structure; add the payment status below the amount line.

- [ ] **Step 1: Add `TransferPaymentRow` component**

In `app/admin/settlement/page.tsx`, add before the `AdminSettlementPage` function:

```typescript
import type { AnnotatedTransfer } from "@/types";

function TransferPaymentRow({
  transfer,
}: {
  transfer: AnnotatedTransfer;
}) {
  const t = useT();
  const ps = transfer.payment_status;
  if (!ps) return null; // co-op is the payer, no tracking

  const pct = transfer.amount > 0 ? Math.min(1, ps.paid / transfer.amount) : 1;
  const barFilled = Math.round(pct * 10);
  const statusColor =
    ps.open < 0.005 ? paper.green : ps.paid > 0.005 ? paper.blue : paper.accent;
  const statusLabel =
    ps.open < 0.005
      ? t("settlement.fully_paid")
      : ps.paid > 0.005
        ? t("settlement.partially_paid")
        : t("settlement.unpaid");

  return (
    <div
      style={{
        padding: "6px 14px 10px",
        borderTop: `1px dashed ${paper.paperDark}`,
        background: paper.paperDeep,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        <span>{t("settlement.payment_due")}: {fmtMoney(transfer.amount)}</span>
        <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: fontMono,
          fontSize: 9,
          color: paper.inkDim,
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        <span>
          {t("settlement.payment_paid")}: {fmtMoney(ps.paid)}
        </span>
        <span style={{ color: ps.open > 0.005 ? paper.accent : paper.inkMute }}>
          {t("settlement.payment_open")}: {fmtMoney(ps.open)}
        </span>
      </div>
      {/* Simple progress bar */}
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          color: statusColor,
          letterSpacing: 2,
        }}
      >
        {"●".repeat(barFilled)}{"○".repeat(10 - barFilled)}
        {" "}
        {Math.round(pct * 100)}%
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `PaymentSummaryBanner` component**

```typescript
function PaymentSummaryBanner({ data }: { data: { all_paid: boolean; transfers: AnnotatedTransfer[] } }) {
  const t = useT();
  const outstanding = data.transfers.filter(
    (tr) => tr.payment_status !== null && (tr.payment_status?.open ?? 0) > 0.005
  );
  const count = outstanding.length;
  const isAllPaid = data.all_paid;

  if (data.transfers.filter((tr) => tr.payment_status !== null).length === 0) return null;

  return (
    <div
      style={{
        padding: "10px 14px",
        background: isAllPaid ? paper.green : paper.accent,
        color: paper.paper,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontFamily: fontMono, fontSize: 12, fontWeight: 700 }}>
        {isAllPaid ? "✓" : "!"}
      </span>
      <span style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 0.5 }}>
        {isAllPaid
          ? t("settlement.payment_all_paid")
          : t("settlement.payment_outstanding", {
              count,
              plural: count === 1 ? "" : "en",
            })}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Update transfer rendering in `AdminSettlementPage`**

Locate the section that renders step-1, step-2, step-3 transfers. Currently the transfer cards show `tr.from → tr.to` and `fmtMoney(tr.amount)`. Update to:

1. Add `<PaymentSummaryBanner data={data} />` after the verify balance bar (before step-3 section or at the very top of the transfer list area, after the verify bar).

2. For each transfer card, append `<TransferPaymentRow transfer={tr} />` below the amount line.

The existing step-1 transfer display is inline in the render loop (not currently shown as individual cards — it's embedded in `NonOwnerMemberCard`). Looking at the current page structure:

- **Steps 1 & 2** are shown via `NonOwnerMemberCard` and `OwnerMemberCard` per-member (not a separate transfer list)
- **Step 3** has an explicit transfer bar at the bottom

The `transfers` array in `SettlementResult` is currently only used for the step-3 inter-owner bar. The per-member payment status is therefore best added **on the member cards themselves**, not on a separate transfer list.

Revised approach — add payment status inline on each member card:

**For `NonOwnerMemberCard`:** below the "Saldo" row in the expanded view, add:

```typescript
{/* Payment status */}
{(() => {
  const transfer = data?.transfers.find(
    (tr) => tr.step === 1 && (tr.from === m.person_name || tr.to === m.person_name)
  );
  if (!transfer?.payment_status) return null;
  return <TransferPaymentRow transfer={transfer} />;
})()}
```

Wait — `NonOwnerMemberCard` receives `m` (the MemberStatement) but not `data` (the full SettlementResult). We need to pass the relevant transfer or payment status as a prop.

**Simpler approach: pass `paymentStatus` as a prop.**

Update `NonOwnerMemberCard` signature:

```typescript
function NonOwnerMemberCard({
  m,
  year,
  bankAccount,
  settlementTransfer,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  settlementTransfer: AnnotatedTransfer | undefined;
})
```

In the caller (`AdminSettlementPage`), find the matching transfer:

```typescript
const transfer = data.transfers.find(
  (tr) => tr.step === 1 && tr.from === m.person_name
);
// Note: if s1 > 0, the co-op pays the member (from = "co-op"), so no human-payer transfer
```

Pass `settlementTransfer={transfer}` to `NonOwnerMemberCard`.

Inside `NonOwnerMemberCard`, at the bottom of the expanded view (after the Saldo section):

```typescript
{settlementTransfer && (
  <div style={{ marginTop: 10 }}>
    <div
      style={{
        fontFamily: fontMono,
        fontSize: 9,
        color: paper.inkDim,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {t("settlement.payment_status_title")}
    </div>
    <TransferPaymentRow transfer={settlementTransfer} />
  </div>
)}
```

Similarly, update `OwnerMemberCard` to accept and display the owner's step-2 transfer:

```typescript
function OwnerMemberCard({
  m,
  year,
  bankAccount,
  settlementTransfer,
}: {
  m: MemberStatement;
  year: number;
  bankAccount: string;
  settlementTransfer: AnnotatedTransfer | undefined;
})
```

Find the owner's step-2 transfer (payer is the one with negative net):

```typescript
const ownerTransfer = data.transfers.find(
  (tr) => tr.step === 2 && tr.from === m.person_name
);
// Only shows if owner owes the co-op (net < 0); if co-op pays owner, no human transfer
```

For **step-3 inter-owner transfers**, update the existing step-3 transfer bar to include `<TransferPaymentRow>` for each:

```typescript
{step3.map((tr, i) => (
  <div key={i} style={{ ... }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: fontMono, fontSize: 9 }}>
        {tr.from} → {tr.to}
      </span>
      <span style={{ fontFamily: fontMono, fontSize: 13, fontWeight: 700 }}>
        {fmtMoney(tr.amount)}
      </span>
    </div>
    <TransferPaymentRow transfer={tr} />
  </div>
))}
```

- [ ] **Step 4: Add `PaymentSummaryBanner` above the finalize button**

In `AdminSettlementPage`, just before the "Afrekening afsluiten" button:

```typescript
{data && <PaymentSummaryBanner data={data} />}
```

- [ ] **Step 5: TypeScript check**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npx tsc --noEmit 2>&1 | head -40)
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add app/admin/settlement/page.tsx
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "feat(settlement-ui): show payment status per transfer on settlement page (#87)"
```

---

## Task 6: Quality check

- [ ] **Step 1: Run full test suite**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npx vitest run 2>&1 | tail -30)
```

Expected: all tests pass.

- [ ] **Step 2: Run linter**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npm run lint 2>&1 | tail -20)
```

Expected: zero errors.

- [ ] **Step 3: TypeScript full check**

```bash
(cd /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 && npx tsc --noEmit 2>&1 | wc -l)
```

Expected: same or fewer errors than before this feature branch.

- [ ] **Step 4: Commit any lint/TS fixes if needed**

```bash
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 add -p
git -C /home/roeland/Projects/CarSharing/.worktrees/feature/issue-87 commit -m "fix(settlement): lint and type cleanup for payments integration (#87)"
```

---

## Summary of design decisions

| Question | Decision |
|---|---|
| Match payments to year? | Via `payments.year` column (already `date.year − 1`) — no date-range matching |
| Handle partial payments? | Sum all payments per person per year; show due/paid/open per transfer |
| 3-step structure + status? | Add `payment_status` to each `AnnotatedTransfer`; co-op-payer transfers get `null` |
| Freeze gated on all paid? | No — soft-lock only; show warning badge but allow freeze regardless |
| Manually mark as settled? | Admin adds a payment record in Payments page with a note — no new UI needed |
| Where does status appear? | On the expanded member card (step 1, 2) and in the step-3 transfer bar |
| Summary indicator? | `PaymentSummaryBanner` above the finalize button — green if all paid, orange if not |
