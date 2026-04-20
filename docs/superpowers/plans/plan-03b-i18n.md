# CarSharing — Plan 03b: i18n Module

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisite:** plans 01, 02, 03 completed. (Plan 00 may be done in parallel — no dependency either way.)

**Goal:** Introduce a lightweight i18n module so that every user-facing string in the app resolves through a single `t(key, params?)` helper. Dutch values live in `lib/i18n/messages/nl.ts`; keys are English and namespaced (`nav.*`, `page.*`, `form.*`, `action.*`, `validation.*`, `toast.*`, `state.*`, `error.*`, `balance.*`, `brand.*`). No i18n library — a ~15-line helper.

**Architecture:** One dictionary object per locale (today: `nl` only). The `t()` helper is typed against the dictionary so unknown keys fail at compile time. `{param}` placeholders are replaced at call time. Adding `en.ts` later is a file-add plus a locale switch; existing call sites don't change. All subsequent plans (04–09) wire their inline Dutch strings through `t()` — this plan defines the contract they all consume.

**Tech Stack:** TypeScript, Vitest. Zero runtime dependencies.

---

### Task 1: Create the Dutch message dictionary

**Files:**
- Create: `lib/i18n/messages/nl.ts`

- [ ] **Step 1: Create lib/i18n/messages/nl.ts**

This dictionary enumerates every user-facing string that plans 04–09 will render. Keep it flat (no nested objects) — flat keys give the cleanest `keyof` type and the simplest lookup.

```ts
export const nl = {
  // Brand
  "brand.app": "Autodelen",
  "brand.description": "Autodelen voor een coöperatieve",

  // Primary navigation (drawer + bottom tab bar)
  "nav.menu": "Menu",
  "nav.primary": "Hoofdnavigatie",
  "nav.dashboard": "Dashboard",
  "nav.calendar": "Kalender",
  "nav.people": "Personen",
  "nav.cars": "Wagens",
  "nav.expenses": "Extra Kosten",
  "nav.payments": "Betalingen",
  "nav.trips": "Kilometers",
  "nav.fuel": "Tanken",

  // Page headers (shown inside <PageHeader title={...} />)
  "page.dashboard": "Dashboard",
  "page.dashboard_coming_soon": "Dashboard binnenkort beschikbaar.",
  "page.calendar": "Kalender",
  "page.people": "Personen",
  "page.cars": "Wagens",
  "page.trips": "Kilometers",
  "page.fuel": "Tanken",
  "page.expenses": "Extra Kosten",
  "page.payments": "Betalingen",

  // Dialog titles / FAB aria-labels (reused in both slots — same action, same copy)
  "page.person_add": "Persoon toevoegen",
  "page.person_edit": "Persoon bewerken",
  "page.car_add": "Wagen toevoegen",
  "page.car_edit": "Wagen bewerken",
  "page.trip_add": "Rit toevoegen",
  "page.trip_edit": "Rit bewerken",
  "page.fuel_add": "Tankbeurt toevoegen",
  "page.fuel_edit": "Tankbeurt bewerken",
  "page.expense_add": "Kost toevoegen",
  "page.expense_edit": "Kost bewerken",
  "page.payment_add": "Betaling toevoegen",
  "page.payment_edit": "Betaling bewerken",
  "page.reservation_add": "Reservering toevoegen",
  "page.reservation_edit": "Reservering bewerken",

  // Actions (buttons, generic FAB)
  "action.add": "Toevoegen",
  "action.save": "Opslaan",
  "action.cancel": "Annuleer",
  "action.delete": "Verwijderen",

  // Form labels (asterisked keys are required; non-asterisked are optional)
  "form.name": "Naam *",
  "form.discount": "Korting (0–1)",
  "form.discount_long": "Korting lang (0–1)",
  "form.active_member": "Actief lid",
  "form.car": "Wagen *",
  "form.car_short": "Code (ETH/JF/LEW) *",
  "form.price_per_km": "Prijs/km *",
  "form.price_per_liter": "Prijs/liter",
  "form.brand": "Merk",
  "form.color": "Kleur",
  "form.date": "Datum *",
  "form.date_from": "Van *",
  "form.date_to": "Tot *",
  "form.start_odometer": "Start *",
  "form.end_odometer": "Eind *",
  "form.odometer": "Kilometerstand",
  "form.km": "KM",
  "form.amount": "Bedrag",
  "form.amount_euro_required": "Bedrag (€) *",
  "form.amount_euro": "Bedrag (€)",
  "form.liters": "# Liter *",
  "form.location": "Locatie",
  "form.location_placeholder": "Klik op kaart of gebruik GPS",
  "form.receipt": "Bonnetje",
  "form.receipt_add": "Bonnetje toevoegen",
  "form.description": "Omschrijving",
  "form.description_placeholder": "bv. Verkeersbelasting",
  "form.note": "Opmerking",
  "form.note_placeholder": "bv. Vereffening 2025",
  "form.select_person_placeholder": "Selecteer persoon",

  // Form validation messages (shown under fields)
  "validation.name_required": "Naam is verplicht",
  "validation.person_required": "Kies een persoon",
  "validation.car_required": "Kies een wagen",
  "validation.end_gte_start": "Eind moet ≥ start zijn",
  "validation.end_date_gte_start": "Einde moet op of na start liggen",

  // Toast notifications
  "toast.saved": "Opgeslagen",
  "toast.deleted": "Verwijderd",
  "toast.person_added": "Persoon toegevoegd",
  "toast.car_added": "Wagen toegevoegd",
  "toast.trip_saved": "Rit opgeslagen",
  "toast.trip_deleted": "Rit verwijderd",
  "toast.fuel_saved": "Tankbeurt opgeslagen",
  "toast.payment_saved": "Betaling opgeslagen",
  "toast.reservation_saved": "Reservering opgeslagen",

  // UI states
  "state.loading": "Laden...",
  "state.uploading": "Uploaden...",

  // Errors shown inline
  "error.gps_unavailable": "GPS niet beschikbaar",

  // Dashboard balance labels (take {amount} placeholder)
  "balance.settled": "vereffend",
  "balance.credit": "Je krijgt €{amount}",
  "balance.debt": "Je bent €{amount} verschuldigd",
} as const;

export type Messages = typeof nl;
export type MessageKey = keyof Messages;
```

- [ ] **Step 2: Commit**

```bash
git add lib/i18n/messages/nl.ts
git commit -m "feat(i18n): dutch message dictionary"
```

---

### Task 2: Create the t() helper

**Files:**
- Create: `lib/i18n/index.ts`

- [ ] **Step 1: Create lib/i18n/index.ts**

The helper accepts a typed key and an optional params object. `{name}` placeholders in a value are substituted via a single regex pass. Unknown `{param}` placeholders (i.e. the param was not supplied) are left visible (`{x}`) so the bug shows up in UI rather than silently rendering as `undefined`.

```ts
import { nl, type MessageKey, type Messages } from "./messages/nl";

type Params = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function t(key: MessageKey, params?: Params): string {
  const template: Messages[MessageKey] = nl[key];
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type { MessageKey } from "./messages/nl";
```

- [ ] **Step 2: Commit**

```bash
git add lib/i18n/index.ts
git commit -m "feat(i18n): t() helper with typed keys and {param} substitution"
```

---

### Task 3: Tests for t()

**Files:**
- Create: `lib/__tests__/i18n.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { t } from "@/lib/i18n";

describe("t()", () => {
  it("returns the Dutch value for a known key", () => {
    expect(t("action.save")).toBe("Opslaan");
  });

  it("returns the value unchanged when no params are passed", () => {
    expect(t("balance.settled")).toBe("vereffend");
  });

  it("substitutes {param} placeholders", () => {
    expect(t("balance.credit", { amount: "12.34" })).toBe("Je krijgt €12.34");
    expect(t("balance.debt", { amount: "5.00" })).toBe("Je bent €5.00 verschuldigd");
  });

  it("accepts numeric params and stringifies them", () => {
    expect(t("balance.credit", { amount: 7 })).toBe("Je krijgt €7");
  });

  it("leaves unknown placeholders visible when the param is missing", () => {
    // Caller forgot to pass {amount} — we render the placeholder literally
    // so the bug is visible in the UI rather than silently becoming 'undefined'.
    expect(t("balance.credit")).toBe("Je krijgt €{amount}");
    expect(t("balance.credit", {})).toBe("Je krijgt €{amount}");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test lib/__tests__/i18n.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/i18n.test.ts
git commit -m "test(i18n): t() helper behaviour"
```

---

### Task 4: Document the module (NAMING.md hand-off)

**Files:**
- Modify: `docs/superpowers/plans/NAMING.md`

- [ ] **Step 1: Verify NAMING.md now points to this module**

Plan 03b-i18n's companion change is in NAMING.md — the "UI labels (Dutch — kept for users)" section is replaced with a short pointer to `lib/i18n/`. If NAMING.md has already been updated alongside this plan, nothing to do; otherwise, open it and replace the last section with:

```markdown
## UI labels — routed through the i18n module

All user-facing strings resolve through `t(key, params?)` from `lib/i18n/`. Keys are English and namespaced (`nav.*`, `page.*`, `form.*`, `action.*`, `validation.*`, `toast.*`, `state.*`, `error.*`, `balance.*`, `brand.*`). Dutch values live in `lib/i18n/messages/nl.ts`. See plan-03b-i18n.md for the full key list and the helper's contract.

Code-level names (variables, files, routes, DB columns) remain English — unchanged.
```

- [ ] **Step 2: Commit (only if this plan also changes NAMING.md)**

```bash
git add docs/superpowers/plans/NAMING.md
git commit -m "docs: point NAMING.md UI-labels section to i18n module"
```

---

### Task 5: Usage contract for plans 04–09

No code in this task — this is the reference plans 04–09 cite when they switch from inline Dutch to `t()`.

**Import:**
```ts
import { t } from "@/lib/i18n";
```

**Use for:**
- JSX text content: `<h1>{t("page.dashboard")}</h1>`
- Attribute values: `aria-label={t("nav.menu")}`, `placeholder={t("form.location_placeholder")}`
- Dialog/FAB labels: `<Fab label={t("page.person_add")} />`
- Toast bodies: `toast.success(t("toast.trip_saved"))`
- Zod validation messages: `z.number({ required_error: t("validation.person_required") })`
- Parameterised strings: `t("balance.credit", { amount: balance.toFixed(2) })`

**Module-scope constants** (e.g. `const NAV_ITEMS = [...]` in `NavDrawer`, `const TABS = [...]` in `BottomTabBar`) may call `t()` in their initialisers — the helper is synchronous and has no React dependency, so it is safe at import time.

**Do not:**
- Concatenate a translated fragment with an inline Dutch fragment — put the whole sentence in the dictionary.
- Pass `t("…")` into `z.string().min(1, …)` at module scope inside a plain Zod schema if the schema is exported across a client/server boundary and then re-serialised — in our plans this is not an issue because the schemas are co-located with the form that uses them.
- Call `t()` with a dynamic key (`t(someVar)`). Always pass a string literal so TypeScript can check it.

**Adding `en.ts` later:** create `lib/i18n/messages/en.ts` mirroring `nl.ts`, have `lib/i18n/index.ts` pick the dictionary from an env var or cookie, and export the *same* `t()` signature. Call sites stay unchanged — that's the whole point of this module.

---

### Self-review checklist

- [ ] Every inline Dutch string identified in plans 04–09 appears as a key in `nl.ts`.
- [ ] Every key used in the usage-contract examples (Task 5) is defined in `nl.ts`.
- [ ] `balance.credit` and `balance.debt` both use the `{amount}` placeholder (not `{euros}` or `{value}`) — this is the name plan-09 will pass.
- [ ] The `t()` helper has no React import — it must be callable from Zod schemas, server utilities, and module-scope constants.
