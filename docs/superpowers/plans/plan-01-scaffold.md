# CarSharing — Plan 01: Project Scaffold

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan.

**Goal:** Bootstrap a Next.js 15 project in the existing CarSharing repo with the same toolchain as sacred-fire-songs.

**Architecture:** Next.js App Router, TypeScript strict, Tailwind v4, Radix UI, TanStack Query, React Hook Form + Zod, Vitest, Sonner, Lucide.

**Tech Stack:** Node 20, Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Vitest.

---

### Task 1: Install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Initialise package.json**

Run from `/home/roeland/Projects/CarSharing`:
```bash
npm init -y
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install next@^15 react@19 react-dom@19 typescript @types/node @types/react @types/react-dom
npm install better-sqlite3 @types/better-sqlite3
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-tabs @radix-ui/react-slot
npm install @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install lucide-react sonner clsx tailwind-merge class-variance-authority
npm install leaflet @types/leaflet react-leaflet
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
npm install next-pwa
npm install --save-dev tailwindcss @tailwindcss/postcss postcss vitest @vitejs/plugin-react
```

- [ ] **Step 3: Update scripts in package.json**

Replace the scripts section:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dependencies"
```

---

### Task 2: TypeScript & PostCSS config

**Files:**
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `next.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Create postcss.config.mjs**

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

- [ ] **Step 3: Create next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

Note: `serverExternalPackages` tells Next.js not to bundle `better-sqlite3` — it must run as a native module.

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json postcss.config.mjs next.config.ts vitest.config.ts
git commit -m "chore: add typescript, postcss, next, vitest config"
```

---

### Task 3: App shell — layout, global CSS, providers

**Files:**
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/providers.tsx`

- [ ] **Step 1: Create app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **Step 2: Create app/providers.tsx**

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Autodelen",
  description: "Car sharing cooperative",
  manifest: "/manifest.json",
  themeColor: "#1976d2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create placeholder home page app/page.tsx**

```tsx
export default function HomePage() {
  return <main className="p-4"><h1 className="text-2xl font-bold">Autodelen</h1></main>;
}
```

- [ ] **Step 5: Run dev server to verify it starts**

```bash
npm run dev
```
Expected: server starts at http://localhost:3000, page shows "Autodelen".

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat: app shell with providers and layout"
```
