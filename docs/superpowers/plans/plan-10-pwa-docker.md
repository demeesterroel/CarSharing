# CarSharing — Plan 10: PWA & Docker

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Add PWA support (installable, offline-capable) and Docker deployment with Traefik integration in cloud-infra.

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

- [ ] **Step 2: Generate icons**

Install sharp if not already installed:
```bash
npm install --save-dev sharp
```

Create `scripts/generate-icons.mjs`:
```js
import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

// Create a simple blue car icon SVG
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1976d2" rx="64"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="white" font-family="sans-serif">🚗</text>
</svg>`;

const svgBuffer = Buffer.from(svg);
await sharp(svgBuffer).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(svgBuffer).resize(512).png().toFile("public/icons/icon-512.png");
console.log("Icons generated");
```

Run:
```bash
node scripts/generate-icons.mjs
```
Expected: `public/icons/icon-192.png` and `public/icons/icon-512.png` created.

- [ ] **Step 3: Commit**

```bash
git add public/ scripts/generate-icons.mjs
git commit -m "feat: PWA manifest and icons"
```

---

### Task 2: Service worker with next-pwa

**Files:**
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update next.config.ts to enable next-pwa**

```ts
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/static/:path*",
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

- [ ] **Step 2: Add viewport and apple meta tags to app/layout.tsx**

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

- [ ] **Step 3: Build and verify PWA**

```bash
npm run build
npm run start
```

Open http://localhost:3000 in Chrome. Open DevTools → Application → Manifest — verify manifest loads. Check Service Workers tab — verify SW is registered.

On mobile: open in browser, use "Add to Home Screen" — app should install and open in standalone mode.

- [ ] **Step 4: Add generated SW files to .gitignore**

Append to `.gitignore`:
```
# next-pwa generated files
public/sw.js
public/workbox-*.js
public/sw.js.map
public/workbox-*.js.map
```

- [ ] **Step 5: Commit**

```bash
git add next.config.ts app/layout.tsx .gitignore
git commit -m "feat: PWA service worker via next-pwa"
```

---

### Task 3: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# better-sqlite3 needs python3/make at runtime for native module
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: Enable Next.js standalone output — update next.config.ts**

Add `output: "standalone"` to the nextConfig object:

```ts
import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/uploads/:path*", destination: "/api/static/:path*" },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

- [ ] **Step 3: Create .dockerignore**

```
node_modules
.next
data
uploads
.git
.env*
```

- [ ] **Step 4: Build Docker image to verify**

```bash
docker build -t carsharing:local .
```
Expected: build succeeds, image ~300MB.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore next.config.ts
git commit -m "feat: dockerfile with standalone next.js build"
```

---

### Task 4: Docker Compose + Traefik labels

**Files:**
- Create: `cloud-infra/stacks/autodelen/docker-compose.yml`

- [ ] **Step 1: Create cloud-infra/stacks/autodelen/ directory**

```bash
mkdir -p /home/roeland/Projects/cloud-infra/stacks/autodelen/data
mkdir -p /home/roeland/Projects/cloud-infra/stacks/autodelen/uploads
touch /home/roeland/Projects/cloud-infra/stacks/autodelen/data/.gitkeep
touch /home/roeland/Projects/cloud-infra/stacks/autodelen/uploads/.gitkeep
```

- [ ] **Step 2: Create cloud-infra/stacks/autodelen/docker-compose.yml**

Replace `autodelen.yourdomain.com` with your actual domain. Check other stacks in `cloud-infra/stacks/` for the correct Traefik network name and entrypoint names used in your setup.

```yaml
services:
  autodelen:
    image: ghcr.io/demeesterroel/carsharing:latest
    # Or build locally: build: context: /path/to/CarSharing
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

- [ ] **Step 3: Verify Traefik network name**

```bash
docker network ls | grep traefik
```
Update the `networks` section in docker-compose.yml to match the actual network name.

- [ ] **Step 4: Test local Docker run**

```bash
docker run -p 3000:3000 \
  -e DB_PATH=/app/data/autodelen.db \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  carsharing:local
```
Expected: app runs at http://localhost:3000, DB is created in `./data/`.

- [ ] **Step 5: Commit cloud-infra stack**

```bash
cd /home/roeland/Projects/cloud-infra
git add stacks/autodelen/
git commit -m "feat: autodelen docker stack with traefik labels"
```

- [ ] **Step 6: Commit CarSharing repo**

```bash
cd /home/roeland/Projects/CarSharing
git add .
git commit -m "chore: final cleanup and plan docs"
git push origin main
```

---

### Task 5: GitHub Actions CI (optional)

**Files:**
- Create: `.github/workflows/docker.yml`

- [ ] **Step 1: Create .github/workflows/docker.yml**

```yaml
name: Build and push Docker image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

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
          tags: ghcr.io/demeesterroel/carsharing:latest
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: build and push docker image on push to main"
git push origin main
```

Expected: GitHub Actions runs, image is published to `ghcr.io/demeesterroel/carsharing:latest`. Check https://github.com/demeesterroel/CarSharing/actions.
