---
name: frontend-validation
description: Use after any UI/frontend change before claiming work is done. Validates changed routes via Playwright MCP: screenshots at 3 viewports, a11y check, console errors. For CarSharing (Next.js, localhost:3000) and similar projects.
---

# Frontend Validation

## When to Use

After any change to: `app/`, `components/`, `hooks/`, `styles/`, CSS files, or any file affecting rendered output — before claiming the task is complete.

Pairs with `superpowers:verification-before-completion`: use this skill first, then complete that gate.

## Prerequisites

- Playwright MCP must be connected (verify: `mcp list` shows `playwright`)
- Dev server running at `http://localhost:3000` (or check/start below)

## Step 0 — Identify Changed Routes

```bash
git diff --name-only HEAD
```

Map changed files to affected routes:

| Changed path                    | Routes to check                   |
| ------------------------------- | --------------------------------- |
| `app/trips/`                    | `/trips`                          |
| `app/expenses/`                 | `/expenses`                       |
| `app/fuel/`                     | `/fuel`                           |
| `app/reservations/`             | `/reservations`                   |
| `app/vehicles/`                 | `/vehicles`                       |
| `components/` (shared)          | All routes that use the component |
| `app/layout.tsx`, `globals.css` | All routes                        |
| `app/login/`                    | `/login` (public)                 |

If scope is unclear, validate: `/trips`, `/expenses`, `/fuel`, `/reservations`.

## Step 1 — Ensure Dev Server

```bash
lsof -ti:3000
```

If no process: start the server using `.env.validation` so it runs against `demo.db`:

```bash
(cd ~/Projects/CarSharing && set -a && source .env.validation && set +a && npm run dev) &
sleep 4 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200` or `307` (redirect to login is fine).

**If a server is already running on :3000**, verify it uses `demo.db`:

```bash
lsof -ti:3000 | xargs -I{} sh -c 'cat /proc/{}/environ 2>/dev/null | tr "\0" "\n" | grep DB_PATH'
```

If not using `demo.db`, kill and restart:

```bash
kill $(lsof -ti:3000) && sleep 2
(cd ~/Projects/CarSharing && set -a && source .env.validation && set +a && npm run dev) &
sleep 4 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

## Step 2 — Auth (if testing protected routes)

CarSharing uses iron-session. Playwright MCP browser is NOT authenticated by default.

Use Playwright MCP to POST login before navigating protected routes:

```
playwright_evaluate:
  POST http://localhost:3000/api/auth/login
  body: { username: "test@example.com", password: "changeme" }
```

Or navigate `/login`, fill form, submit. Then proceed to protected routes.

## Step 3 — Screenshot Matrix

For each affected route, capture 3 viewports. Use Playwright MCP:

```
playwright_screenshot at viewport 375x812   (mobile)
playwright_screenshot at viewport 768x1024  (tablet)
playwright_screenshot at viewport 1440x900  (desktop)
```

**What to look for:**

- Text overflow / truncation on mobile
- Layout breaks (elements overlapping, misaligned)
- Button/touch targets too small on mobile (< 44px)
- Missing content (empty states, loading spinners stuck)

## Step 4 — Console Error Check

After navigating each route:

```
playwright_evaluate: () => {
  const errors = window.__consoleErrors || [];
  return errors;
}
```

Or capture via: `page.on('console', ...)` — look for `error` level entries.

**Acceptable:** hydration warnings from third-party libs, preload hints.  
**Not acceptable:** React render errors, unhandled promise rejections, 404s for JS/CSS chunks.

## Step 5 — A11y Spot Check

Inject axe-core on each route via Playwright MCP:

```javascript
playwright_evaluate: async () => {
  // Inject axe-core from CDN
  await new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
  const results = await window.axe.run();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    selector: v.nodes[0]?.target?.join(" ") ?? "",
  }));
};
```

**Block on:** `critical` or `serious` violations (e.g. missing alt text, insufficient color contrast, missing form labels, keyboard trap).  
**Warn on:** `moderate` violations.  
**Skip:** `minor` — log only.

## Step 6 — Report

Output a single markdown block:

```markdown
## Frontend Validation — <route> — <timestamp>

### Viewports

- [ ] 375px — [description or "clean"]
- [ ] 768px — [description or "clean"]
- [ ] 1440px — [description or "clean"]

### Console Errors

- [none | list errors]

### A11y

- [none | list violations with impact level]

### Result: PASS / FAIL
```

**PASS**: no layout breaks, no console errors, no critical/serious a11y violations.  
**FAIL**: state exactly what failed and on which viewport/route.

## Exit Gate

Do NOT claim frontend work complete until all routes in scope show `Result: PASS`.

If FAIL: fix, re-run from Step 2 for the failing route only.

## Quick Reference — Playwright MCP Tools

| Task             | MCP call                         |
| ---------------- | -------------------------------- |
| Navigate         | `playwright_navigate url`        |
| Screenshot       | `playwright_screenshot`          |
| Click element    | `playwright_click selector`      |
| Run JS           | `playwright_evaluate script`     |
| Get page content | `playwright_get_visible_text`    |
| Fill form field  | `playwright_fill selector value` |
