# CarSharing — Plan 04: Shared UI Components

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Build the reusable UI components used across all pages: NavDrawer, BottomTabBar, CarToggle, PersonSelect, FAB, GroupedList, and BalanceIndicator.

**Architecture:** All components are client components in `components/`. They accept props only — no direct data fetching. Pages feed them data via TanStack Query hooks. Two persistent chrome elements wrap every page: the `NavDrawer` (hamburger → full side sheet) for secondary screens, and the `BottomTabBar` (fixed two-tab footer) with the primary data-entry flows **Kilometers** and **Tanken** always one tap away.

**Tech Stack:** React 19, Tailwind v4, Radix UI, Lucide icons.

---

### Task 1: NavDrawer

**Files:**
- Create: `components/nav-drawer.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create components/nav-drawer.tsx**

```tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LayoutDashboard, Car, Users, Wrench, CreditCard, CalendarDays } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// /trips and /fuel are promoted to the BottomTabBar, so they are intentionally
// omitted here to avoid duplicating primary actions in two places.
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/people", label: "People", icon: Users },
  { href: "/cars", label: "Cars", icon: Car },
  { href: "/expenses", label: "Extra Kosten", icon: Wrench },
  { href: "/payments", label: "Betalingen", icon: CreditCard },
];

export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="p-2 rounded-md hover:bg-gray-100" aria-label="Menu">
          <Menu className="w-5 h-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
        <Dialog.Content className="fixed left-0 top-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b">
            <div className="w-10 h-10 rounded border-2 border-blue-600 flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-lg font-semibold">Autodelen</span>
            <Dialog.Close asChild>
              <button className="ml-auto p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                  pathname === href ? "text-blue-600 bg-blue-50 border-l-4 border-blue-600" : "text-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Create components/page-header.tsx**

```tsx
import { NavDrawer } from "./nav-drawer";

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 bg-white z-30">
      <NavDrawer />
      <h1 className="text-lg font-semibold flex-1">{title}</h1>
    </header>
  );
}
```

- [ ] **Step 3: Update app/layout.tsx to host the persistent BottomTabBar**

Pages each render their own `<PageHeader>`. The layout reserves 64 px of bottom space (`pb-16`) so list content never hides behind the tab bar, and mounts `<BottomTabBar>` once at root so every route gets it for free.

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomTabBar } from "@/components/bottom-tab-bar";

export const metadata: Metadata = {
  title: "Autodelen",
  description: "Car sharing cooperative",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm pb-16">
            {children}
          </div>
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Update app/page.tsx to use PageHeader**

```tsx
import { PageHeader } from "@/components/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <main className="p-4">
        <p className="text-gray-500">Dashboard coming soon.</p>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```
Open http://localhost:3000 — hamburger menu opens drawer with all nav links.

- [ ] **Step 6: Commit**

```bash
git add components/ app/layout.tsx app/page.tsx
git commit -m "feat: nav drawer and page header"
```

---

### Task 2: CarToggle

**Files:**
- Create: `components/car-toggle.tsx`

- [ ] **Step 1: Create components/car-toggle.tsx**

```tsx
"use client";
import type { Car } from "@/types";

interface Props {
  cars: Car[];
  value: number | null;
  onChange: (carId: number) => void;
}

export function CarToggle({ cars, value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {cars.map((car) => (
        <button
          key={car.id}
          type="button"
          onClick={() => onChange(car.id)}
          className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
            value === car.id
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
          }`}
        >
          {car.short}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/car-toggle.tsx
git commit -m "feat: car toggle button group component"
```

---

### Task 3: PersonSelect & FAB

**Files:**
- Create: `components/person-select.tsx`
- Create: `components/fab.tsx`

- [ ] **Step 1: Create components/person-select.tsx**

```tsx
"use client";
import type { Person } from "@/types";

interface Props {
  people: Person[];
  value: number | null;
  onChange: (personId: number) => void;
  placeholder?: string;
}

export function PersonSelect({ people, value, onChange, placeholder = "Selecteer persoon" }: Props) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="" disabled>{placeholder}</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Create components/fab.tsx**

```tsx
"use client";
import { Plus } from "lucide-react";

interface Props {
  onClick: () => void;
  label?: string;
}

export function Fab({ onClick, label = "Toevoegen" }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-20 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-20"
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/person-select.tsx components/fab.tsx
git commit -m "feat: person select and floating action button"
```

---

### Task 4: GroupedList

**Files:**
- Create: `components/grouped-list.tsx`

- [ ] **Step 1: Create components/grouped-list.tsx**

Groups an array of records by `year-month` key and renders a section header with a total badge per group.

```tsx
interface GroupedListProps<T> {
  items: T[];
  getKey: (item: T) => string;        // e.g. item.datum.slice(0,7) → "2026-04"
  getGroupLabel: (key: string) => string; // e.g. "2026-4"
  getGroupTotal: (items: T[]) => number;
  renderItem: (item: T) => React.ReactNode;
}

export function GroupedList<T>({
  items,
  getKey,
  getGroupLabel,
  getGroupTotal,
  renderItem,
}: GroupedListProps<T>) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  return (
    <div>
      {sortedKeys.map((key) => {
        const groupItems = groups.get(key)!;
        const total = getGroupTotal(groupItems);
        return (
          <div key={key}>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-t">
              <span className="text-sm font-medium text-gray-600">{getGroupLabel(key)}</span>
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                {total.toLocaleString("nl-BE", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {groupItems.map(renderItem)}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/grouped-list.tsx
git commit -m "feat: grouped list component with month headers and totals"
```

---

### Task 5: BottomTabBar

**Files:**
- Create: `components/bottom-tab-bar.tsx`

The bar is a two-tab footer pinned to the bottom of the viewport, matching the width constraint of the main content wrapper (`max-w-2xl`). Active-state styling is driven by `usePathname()`; the root layout already reserves 64 px of bottom padding so list content never sits beneath it.

- [ ] **Step 1: Create components/bottom-tab-bar.tsx**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, Fuel } from "lucide-react";

const TABS = [
  { href: "/trips", label: "Kilometers", icon: Route },
  { href: "/fuel", label: "Tanken", icon: Fuel },
];

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-30 border-t bg-white"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-2 h-16">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={active ? "font-medium" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000. The bottom tab bar is visible on every route. Tapping **Kilometers** routes to `/trips`, **Tanken** to `/fuel`; the active tab shows in blue. FAB on those pages sits just above the bar (bottom-20). Scrolling a long list does not hide content behind the bar (layout `pb-16` reserves the space).

- [ ] **Step 3: Commit**

```bash
git add components/bottom-tab-bar.tsx app/layout.tsx
git commit -m "feat: persistent bottom tab bar for trips and fuel"
```
