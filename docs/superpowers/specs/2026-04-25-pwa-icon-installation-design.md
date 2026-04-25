# PWA Icon & Installation — Design Spec

**Date:** 2026-04-25
**Issue:** #9
**Status:** Approved

---

## Goal

Make the AutoDelen app installable as a PWA on Android and iOS with a proper icon, splash screen, and standalone launch — no browser chrome after install.

---

## Icon Design

**Style:** People + Car — three outline people figures above a simplified car outline. Paper/ink aesthetic: ink `#1a1a1a` strokes on paper `#f5f0e6` background.

**Source:** `public/icons/source.svg` — single SVG master, 200×200 viewBox. All PNG sizes generated from this source via a one-off Node script (`scripts/generate-icons.mjs`) using `sharp`.

**Output files:**

| File | Size | Purpose |
|------|------|---------|
| `public/icons/icon-192.png` | 192×192 | Standard PWA manifest |
| `public/icons/icon-512.png` | 512×512 | Standard PWA manifest |
| `public/icons/icon-maskable-512.png` | 512×512 | Android adaptive icons — icon at 75% scale on ink `#1a1a1a` background |
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home screen |

---

## manifest.json changes

File: `public/manifest.json`

```json
{
  "name": "AutoDelen — Coöperatieve Antwerpen",
  "short_name": "AutoDelen",
  "description": "Eerlijk autodelen voor familie en vrienden",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5f0e6",
  "theme_color": "#1a1a1a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Changes from current:
- `theme_color`: `#1976d2` → `#1a1a1a`
- `background_color`: `#ffffff` → `#f5f0e6`
- `name`: "Autodelen" → "AutoDelen — Coöperatieve Antwerpen"
- `short_name`: "Autodelen" → "AutoDelen"
- Icons: add dedicated maskable entry pointing to `icon-maskable-512.png`

---

## layout.tsx changes

- `appleWebApp.title`: "Autodelen" → "AutoDelen"
- `apple-touch-icon` href: `/icons/icon-192.png` → `/icons/apple-touch-icon.png` (dedicated 180px file)
- `viewport.themeColor`: keep `#f5f0e6` — controls browser chrome colour, separate from manifest `theme_color` which controls splash

---

## Service Worker

`@ducanh2912/next-pwa` is already configured in `next.config.ts` with `dest: "public"`, `register: true`, and `skipWaiting: true`. Generates `public/sw.js` + workbox bundle at build time. No code changes needed — just verify it's included in the Docker production build (it is: the standalone output includes `public/sw.js`).

---

## Icon generation script

`scripts/generate-icons.mjs` — run once after any icon SVG change:

```
node scripts/generate-icons.mjs
```

Uses `sharp` (already a transitive dep via Next.js image optimisation) to rasterise the SVG at each target size. Maskable variant composites the icon at 75% scale onto an ink background.

---

## Out of scope

- Offline mode and cache strategy (issue #8)
- Push notifications
- Background sync

---

## Acceptance criteria

- [ ] Lighthouse PWA audit passes (installable + all manifest fields present)
- [ ] "Add to Home Screen" prompt appears on Android Chrome
- [ ] App launches full-screen after installation (no browser chrome)
- [ ] Icon visible on home screen (not blank/default)
- [ ] iOS: icon appears correctly via `apple-touch-icon`
- [ ] Splash screen shows "AutoDelen" on `#f5f0e6` background
- [ ] `theme-color` matches app chrome on Android
