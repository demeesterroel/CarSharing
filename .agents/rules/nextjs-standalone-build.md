---
trigger: always_on
---

# Next.js Standalone Production Build Rules

When building and testing Next.js standalone production builds locally (or setting up standalone deployment servers) for this CarSharing project, always follow these setup steps after running `npm run build`:

## 1. Required Symlinks in `.next/standalone`

Next.js `output: 'standalone'` builds do not copy project root `data/`, `public/`, or `.next/static/` assets into `.next/standalone/` by default. Symlinks **MUST** be created to prevent `404 Not Found` errors on CSS/JS bundles and database access failures:

```bash
# 1. Create directory structure if needed
mkdir -p .next/standalone/.next

# 2. Symlink root data directory (SQLite databases)
ln -sf "$(pwd)/data" .next/standalone/data

# 3. Symlink public assets (manifest, icons, images)
ln -sf "$(pwd)/public" .next/standalone/public

# 4. Symlink dynamic tenants config
ln -sf "$(pwd)/tenants.json" .next/standalone/tenants.json

# 5. Symlink compiled static CSS and JS assets (CRITICAL for visual styling & JS hydration)
rm -rf .next/standalone/.next/static
ln -sf "$(pwd)/.next/static" .next/standalone/.next/static
```

## 2. Server Launch Command & Environment Variables

Always pass `NEXT_PUBLIC_TENANTS_CONFIG` (for Edge Runtime middleware tenant host resolution) and `SESSION_PASSWORD` when starting the standalone server:

```bash
PORT=4<issue#> \
NODE_ENV=production \
NEXT_PUBLIC_TENANTS_CONFIG="$(cat tenants.json 2>/dev/null || cat tenants.example.json)" \
SESSION_PASSWORD=secret_test_password_for_standalone_build_32_bytes \
node .next/standalone/server.js
```
