# Gaps Sort Descending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sort odometer gaps most-recent-first within each year group in the admin inbox.

**Architecture:** Gaps arrive from the query in ASC order (oldest first) because trips are fetched `ORDER BY date ASC`. The `groupByYear` helper in `app/admin/page.tsx` sorts year buckets descending but leaves items within each bucket in arrival order. Fix: sort items within each bucket by `after_date` DESC inside `groupByYear`.

**Tech Stack:** TypeScript, React/Next.js

---

## File Map

- Modify: `app/admin/page.tsx` — `groupByYear` function (lines 22–32)

---

### Task 1: Sort items within year groups descending by date

**Files:**

- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update `groupByYear` to sort items within each bucket DESC**

Change `groupByYear` from:

```tsx
function groupByYear<T extends { date?: string; after_date?: string }>(
  items: T[]
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const year = (item.after_date ?? item.date ?? "").slice(0, 4) || "?";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}
```

To:

```tsx
function groupByYear<T extends { date?: string; after_date?: string }>(
  items: T[]
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const year = (item.after_date ?? item.date ?? "").slice(0, 4) || "?";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(item);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(
      ([yr, bucket]) =>
        [
          yr,
          [...bucket].sort((a, b) =>
            (b.after_date ?? b.date ?? "").localeCompare(a.after_date ?? a.date ?? "")
          ),
        ] as [string, T[]]
    );
}
```

- [ ] **Step 2: TypeScript check**

Run:

```bash
npx tsc --noEmit 2>&1 | grep -v "queries.test.ts"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "fix(admin): sort odometer gaps descending (most recent first)

Closes #192"
```
