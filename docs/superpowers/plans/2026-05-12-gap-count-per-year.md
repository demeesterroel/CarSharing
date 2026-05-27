# Gap Count Per Year Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show total gap count right-aligned on each year header in the admin inbox's odometer gaps section.

**Architecture:** The `YearGroup` component in `app/admin/page.tsx` renders a year label above grouped gap cards. Add a `count` prop and make the header row flex with `justifyContent: space-between` so the count appears right-aligned in the same font/size/color as the year label.

**Tech Stack:** React/Next.js, inline styles (paper-theme), TypeScript

---

## File Map

- Modify: `app/admin/page.tsx` — `YearGroup` component (lines 34–55) and its call site (line 369)

---

### Task 1: Add count to YearGroup and display it right-aligned

**Files:**

- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update `YearGroup` signature and layout**

Change the `YearGroup` function from:

```tsx
function YearGroup({ year, children }: { year: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          color: paper.ink,
          letterSpacing: 2,
          textTransform: "uppercase",
          padding: "6px 0 4px",
          borderTop: `1px dashed ${paper.paperDark}`,
          marginBottom: 6,
        }}
      >
        {year}
      </div>
      {children}
    </div>
  );
}
```

To:

```tsx
function YearGroup({
  year,
  count,
  children,
}: {
  year: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: fontMono,
          fontSize: 9,
          fontWeight: 700,
          color: paper.ink,
          letterSpacing: 2,
          textTransform: "uppercase",
          padding: "6px 0 4px",
          borderTop: `1px dashed ${paper.paperDark}`,
          marginBottom: 6,
        }}
      >
        <span>{year}</span>
        <span>{count}</span>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Pass `count` at the call site**

Change the call site from:

```tsx
gapsByYear.map(([yr, items]) => (
  <YearGroup key={yr} year={yr}>
```

To:

```tsx
gapsByYear.map(([yr, items]) => (
  <YearGroup key={yr} year={yr} count={items.length}>
```

- [ ] **Step 3: TypeScript check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): show gap count per year in inbox header

Closes #194"
```
