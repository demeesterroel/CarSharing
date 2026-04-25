# PWA Icon & Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proper PWA icon (people + car, paper/ink style) and correct manifest so the app is installable on Android and iOS with the right splash colour, icon, and name.

**Architecture:** Update the existing `scripts/generate-icons.mjs` with the final SVG and all required output sizes, run it to produce PNGs, then update `public/manifest.json` and `app/layout.tsx`. No new dependencies needed — `sharp` is already available.

**Tech Stack:** sharp (SVG→PNG rasterisation), Next.js metadata API, `@ducanh2912/next-pwa` (already configured)

---

### Task 1: Update icon generation script and produce all PNG sizes

**Files:**
- Modify: `scripts/generate-icons.mjs`
- Create: `public/icons/source.svg`
- Output: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png`

- [ ] **Step 1: Replace `scripts/generate-icons.mjs` with the final script**

```js
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";

await mkdir("public/icons", { recursive: true });

// People + Car SVG — paper #f5f0e6 background, ink #1a1a1a strokes
const iconSvg = `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#f5f0e6"/>
  <!-- Three people -->
  <circle cx="62" cy="40" r="11" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M44 72 Q44 56 62 56 Q80 56 80 72" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="100" cy="35" r="12" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M80 68 Q80 52 100 52 Q120 52 120 68" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="138" cy="40" r="11" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M120 72 Q120 56 138 56 Q156 56 156 72" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <!-- Car body -->
  <path d="M26 150 L26 139 Q26 133 33 133 L46 133 L59 111 Q66 100 82 98 L120 98 Q138 98 146 111 L159 133 L167 133 Q175 133 175 139 L175 150 Q175 155 169 155 L159 155 Q157 166 146 166 Q135 166 133 155 L69 155 Q67 166 56 166 Q45 166 43 155 L33 155 Q26 155 26 150 Z"
        fill="none" stroke="#1a1a1a" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Car window -->
  <path d="M57 133 L65 113 Q72 103 84 101 L118 101 Q132 101 138 113 L147 133 Z"
        fill="none" stroke="#1a1a1a" stroke-width="3.5" stroke-linejoin="round"/>
  <line x1="101" y1="101" x2="101" y2="133" stroke="#1a1a1a" stroke-width="3.5"/>
  <!-- Wheels -->
  <circle cx="56" cy="158" r="12" fill="none" stroke="#1a1a1a" stroke-width="4.5"/>
  <circle cx="56" cy="158" r="4" fill="#1a1a1a"/>
  <circle cx="146" cy="158" r="12" fill="none" stroke="#1a1a1a" stroke-width="4.5"/>
  <circle cx="146" cy="158" r="4" fill="#1a1a1a"/>
</svg>`;

// Maskable: icon at 75% scale on ink background (Android adaptive icon safe zone)
const maskableSvg = `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#1a1a1a"/>
  <g transform="translate(25,25) scale(0.75)">
    <circle cx="62" cy="40" r="11" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M44 72 Q44 56 62 56 Q80 56 80 72" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="100" cy="35" r="12" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M80 68 Q80 52 100 52 Q120 52 120 68" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="138" cy="40" r="11" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M120 72 Q120 56 138 56 Q156 56 156 72" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <path d="M26 150 L26 139 Q26 133 33 133 L46 133 L59 111 Q66 100 82 98 L120 98 Q138 98 146 111 L159 133 L167 133 Q175 133 175 139 L175 150 Q175 155 169 155 L159 155 Q157 166 146 166 Q135 166 133 155 L69 155 Q67 166 56 166 Q45 166 43 155 L33 155 Q26 155 26 150 Z"
          fill="none" stroke="#f5f0e6" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M57 133 L65 113 Q72 103 84 101 L118 101 Q132 101 138 113 L147 133 Z"
          fill="none" stroke="#f5f0e6" stroke-width="4" stroke-linejoin="round"/>
    <line x1="101" y1="101" x2="101" y2="133" stroke="#f5f0e6" stroke-width="4"/>
    <circle cx="56" cy="158" r="12" fill="none" stroke="#f5f0e6" stroke-width="5.5"/>
    <circle cx="56" cy="158" r="4" fill="#f5f0e6"/>
    <circle cx="146" cy="158" r="12" fill="none" stroke="#f5f0e6" stroke-width="5.5"/>
    <circle cx="146" cy="158" r="4" fill="#f5f0e6"/>
  </g>
</svg>`;

const iconBuf     = Buffer.from(iconSvg);
const maskableBuf = Buffer.from(maskableSvg);

await writeFile("public/icons/source.svg", iconSvg);
await sharp(iconBuf).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(iconBuf).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(iconBuf).resize(180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(maskableBuf).resize(512).png().toFile("public/icons/icon-maskable-512.png");

console.log("✓ icon-192.png");
console.log("✓ icon-512.png");
console.log("✓ apple-touch-icon.png");
console.log("✓ icon-maskable-512.png");
console.log("✓ source.svg");
```

- [ ] **Step 2: Run the script**

```bash
node scripts/generate-icons.mjs
```

Expected output:
```
✓ icon-192.png
✓ icon-512.png
✓ apple-touch-icon.png
✓ icon-maskable-512.png
✓ source.svg
```

- [ ] **Step 3: Verify the files exist and have the right sizes**

```bash
python3 -c "
from PIL import Image
for f, expected in [
  ('public/icons/icon-192.png', (192,192)),
  ('public/icons/icon-512.png', (512,512)),
  ('public/icons/apple-touch-icon.png', (180,180)),
  ('public/icons/icon-maskable-512.png', (512,512)),
]:
    img = Image.open(f)
    status = '✓' if img.size == expected else '✗'
    print(f'{status} {f}: {img.size}')
"
```

Expected: all lines show `✓`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-icons.mjs public/icons/
git commit -m "feat(pwa): generate people+car icons in all required sizes"
```

---

### Task 2: Update manifest.json

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Replace `public/manifest.json` with the correct content**

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

- [ ] **Step 2: Verify the JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8')); console.log('✓ valid JSON')"
```

Expected: `✓ valid JSON`

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "feat(pwa): update manifest — AutoDelen name, paper/ink colours, maskable icon"
```

---

### Task 3: Update layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `appleWebApp.title` and `apple-touch-icon` href**

In `app/layout.tsx`, update the `metadata` export and the `apple-touch-icon` link:

```tsx
export const metadata: Metadata = {
  title: "Autodelen — Coöperatieve Antwerpen",
  description: "Eerlijk autodelen voor familie en vrienden",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AutoDelen",          // was "Autodelen"
  },
};
```

And in the `<head>` block, change:
```tsx
// Before:
<link rel="apple-touch-icon" href="/icons/icon-192.png" />

// After:
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(pwa): apple-touch-icon 180px, appleWebApp title AutoDelen"
```

---

### Task 4: Verify PWA in production build

**Files:** none — verification only

- [ ] **Step 1: Build the app**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes with no errors. Confirm `public/sw.js` exists (generated by next-pwa):

```bash
ls -lh public/sw.js public/workbox-*.js
```

Expected: both files present and non-zero.

- [ ] **Step 2: Start the production server and check manifest is served**

```bash
npm run start &
sleep 3
curl -s http://localhost:3000/manifest.json | python3 -m json.tool | grep -E "short_name|theme_color|background_color"
```

Expected:
```
"short_name": "AutoDelen",
"theme_color": "#1a1a1a",
"background_color": "#f5f0e6",
```

- [ ] **Step 3: Check service worker is served**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sw.js
```

Expected: `200`

- [ ] **Step 4: Stop the server**

```bash
kill %1
```

- [ ] **Step 5: Close issue #9**

```bash
gh issue close 9 --repo demeesterroel/CarSharing --comment "PWA icon (people+car, paper/ink), manifest (AutoDelen, #f5f0e6 splash, #1a1a1a theme), maskable icon, and apple-touch-icon all implemented. Service worker already registered via @ducanh2912/next-pwa."
```
