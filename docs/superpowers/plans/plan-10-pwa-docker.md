# CarSharing — Plan 10: PWA & Docker

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.
> **Prerequisites:** plans 01–09 completed.

**Goal:** Add PWA support (installable, offline-capable) and Docker deployment with Traefik integration in cloud-infra.

**Architecture:** Use `@ducanh2912/next-pwa` (maintained fork of the abandoned `next-pwa`, compatible with Next 15). Docker uses a multi-stage build that compiles `better-sqlite3` in the builder stage and copies the resulting `.node` binary into a slim runner that doesn't need python/make/g++.

**Tech Stack:** @ducanh2912/next-pwa, sharp (icon generation), Docker multi-stage, Traefik.

---

### Task 1: PWA manifest & icons

**Files:**
- Create: `public/manifest.json`
- Create: `scripts/generate-icons.mjs`

- [ ] **Step 1: Create public/manifest.json**

```json
{
  "name": "Autodelen",
  "short_name": "Autodelen",
  "description": "Car sharing cooperative tracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Install sharp as dev dependency**

```bash
npm install --save-dev sharp
```

- [ ] **Step 3: Create scripts/generate-icons.mjs**

```js
import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1976d2" rx="64"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="white" font-family="sans-serif">🚗</text>
</svg>`;

const svgBuffer = Buffer.from(svg);
await sharp(svgBuffer).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(svgBuffer).resize(512).png().toFile("public/icons/icon-512.png");
console.log("Icons generated");
```

- [ ] **Step 4: Generate the icons**

```bash
node scripts/generate-icons.mjs
```
Expected: `public/icons/icon-192.png` and `public/icons/icon-512.png` created.

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json public/icons/ scripts/generate-icons.mjs package.json package-lock.json
git commit -m "feat: PWA manifest and icons"
```

---

### Task 2: Service worker with @ducanh2912/next-pwa

`next-pwa` is unmaintained since 2023 and produces runtime warnings with Next 15. `@ducanh2912/next-pwa` is the actively maintained fork with Next 15 + Workbox 7 support.

**Files:**
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Update next.config.ts to enable the PWA wrapper**

```ts
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  workboxOptions: { skipWaiting: true },
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/:path*" },
    ];
  },
};

export default withPWA(nextConfig);
```

- [ ] **Step 2: Add apple meta + viewport to app/layout.tsx**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Autodelen",
  description: "Car sharing cooperative",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Autodelen",
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Append service-worker artifacts to .gitignore**

```
# @ducanh2912/next-pwa generated files
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
```

- [ ] **Step 4: Build and verify PWA**

```bash
npm run build
npm run start
```

Open http://localhost:3000 in Chrome. DevTools → Application → Manifest — manifest loads with correct icons. Application → Service Workers — one registered SW, `activated and is running`. Trigger "Add to Home Screen" on a mobile device; the installed app opens in standalone mode.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts app/layout.tsx .gitignore
git commit -m "feat: PWA service worker via @ducanh2912/next-pwa"
```

---

### Task 3: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

The build stage needs `python3 make g++` so `npm ci` can compile `better-sqlite3` from source. Once the `.node` binary is built, it ships inside `node_modules` and the runtime does not need the build toolchain.

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

# Stage 1 — builder: compile native modules and build Next.js
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 builds from source on alpine; it needs python/make/g++
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies; keeps the compiled better-sqlite3 .node binary
RUN npm prune --omit=dev

# Stage 2 — runner: minimal image, no build toolchain
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone server bundle + static assets + public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# better-sqlite3 is marked serverExternal, so standalone doesn't bundle it —
# copy the pruned node_modules so `require("better-sqlite3")` resolves at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings        ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Writable data + uploads mount points
RUN mkdir -p /app/data /app/uploads && chown -R nextjs:nodejs /app/data /app/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create .dockerignore**

```
node_modules
.next
data
uploads
.git
.env*
docs
cloud-infra
```

- [ ] **Step 3: Build the image locally**

```bash
docker build -t carsharing:local .
```
Expected: image builds successfully, final size ~180–220 MB (no python/make in runner).

- [ ] **Step 4: Smoke test the image**

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/uploads:/app/uploads" \
  -e DB_PATH=/app/data/autodelen.db \
  carsharing:local
```

Open http://localhost:3000 — the app runs and SQLite creates `./data/autodelen.db` on first request.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: multi-stage dockerfile with native module compile in builder"
```

---

### Task 4: Docker Compose + Traefik labels

**Files:**
- Create: `cloud-infra/stacks/autodelen/docker-compose.yml`

- [ ] **Step 1: Discover the Traefik network name used in cloud-infra**

```bash
docker network ls | grep -i traefik
ls /home/roeland/Projects/cloud-infra/stacks/
```

Inspect one existing stack's compose file to see what external network name and entrypoint labels it uses. Record those and use the same values below.

- [ ] **Step 2: Create the stack directory and data/uploads bind mounts**

```bash
mkdir -p /home/roeland/Projects/cloud-infra/stacks/autodelen/data
mkdir -p /home/roeland/Projects/cloud-infra/stacks/autodelen/uploads
touch /home/roeland/Projects/cloud-infra/stacks/autodelen/data/.gitkeep
touch /home/roeland/Projects/cloud-infra/stacks/autodelen/uploads/.gitkeep
```

- [ ] **Step 3: Create cloud-infra/stacks/autodelen/docker-compose.yml**

Replace `autodelen.yourdomain.com` and `traefik_proxy` with the values from step 1.

```yaml
services:
  autodelen:
    image: ghcr.io/demeesterroel/carsharing:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/autodelen.db
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.autodelen.rule=Host(`autodelen.yourdomain.com`)"
      - "traefik.http.routers.autodelen.entrypoints=websecure"
      - "traefik.http.routers.autodelen.tls.certresolver=letsencrypt"
      - "traefik.http.services.autodelen.loadbalancer.server.port=3000"
    networks:
      - traefik_proxy

networks:
  traefik_proxy:
    external: true
```

- [ ] **Step 4: Commit cloud-infra stack**

```bash
cd /home/roeland/Projects/cloud-infra
git add stacks/autodelen/
git commit -m "feat: autodelen docker stack with traefik labels"
```

---

### Task 5: GitHub Actions CI — build & publish image

**Files:**
- Create: `.github/workflows/docker.yml`

- [ ] **Step 1: Create .github/workflows/docker.yml**

```yaml
name: Build and push Docker image

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/demeesterroel/carsharing:latest
            ghcr.io/demeesterroel/carsharing:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/docker.yml
git commit -m "ci: build and publish docker image on push to main"
git push origin main
```

Expected: workflow runs green at https://github.com/demeesterroel/CarSharing/actions, image published at `ghcr.io/demeesterroel/carsharing:latest`.

---

### Task 6: Deploy

- [ ] **Step 1: Pull and start on the server**

On the host running cloud-infra:

```bash
cd /path/to/cloud-infra/stacks/autodelen
docker compose pull
docker compose up -d
docker compose logs -f autodelen
```

Expected: container is healthy, Traefik routes `autodelen.yourdomain.com` to it with a Let's Encrypt certificate, the app loads.

- [ ] **Step 2: Verify data persistence**

Add one trip via the UI, restart the stack (`docker compose restart autodelen`), reload the page — the trip is still there. Confirms the `./data/autodelen.db` bind mount.
