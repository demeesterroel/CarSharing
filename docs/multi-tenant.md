# Multi-Tenant Mode — Developer & Operator Guide

This guide explains how Multi-Tenant mode works in CarSharing, how to enable it, and how to provision and manage new tenant cooperatives.

---

## 1. Architecture Overview

CarSharing uses a **Database-per-Tenant** isolation model:

- **Central Platform DB (`data/platform.db`)**: Manages the tenant registry (`tenants` table) and routing for external integrations (such as Google Calendar webhooks).
- **Tenant Databases (`data/tenants/{slug}.db`)**: Each cooperative tenant operates on an isolated SQLite database containing its own members, cars, trips, fuel fill-ups, expenses, reservations, and settlements.
- **Backward Compatibility**: Single-tenant deployments continue operating seamlessly with zero configuration changes using `data/carsharing.db` mapped to the default tenant slug `primary`.

---

## 2. Enabling Multi-Tenant Mode

Multi-tenant mode requires no complex infrastructure services. Configure your environment variables in `.env` or `.env.local`:

```env
# Default tenant slug for main domain requests or fallback (default: "primary")
DEFAULT_TENANT_SLUG=primary

# Directory where per-tenant SQLite database files are stored
TENANTS_DIR=data/tenants
```

### Request Tenant Resolution Strategy

The application extracts the tenant slug for each HTTP request in the following priority order:

1. **`x-tenant-slug` HTTP Header**: Injected by a reverse proxy (e.g. Nginx, Caddy, Cloudflare, Traefik).
2. **Host Subdomain**:
   - Production: `coop-gent.example.com` extracts tenant slug `coop-gent`.
   - Local Development: `coop-gent.localhost:3000` extracts tenant slug `coop-gent`.
3. **Fallback**: Default tenant slug defined in `DEFAULT_TENANT_SLUG` (`primary`).

---

## 3. Provisioning & Configuring a New Tenant

### Step 1: Register the Tenant in the Platform Database

Run the tenant creation helper via CLI or Node script:

```bash
npx tsx -e '
  import { createTenantRecord } from "./lib/platform-db";
  createTenantRecord("coop-gent", "Cooperative Gent", "admin@coop-gent.be");
  console.log("Tenant registered!");
'
```

### Step 2: Database Initialization

When the new tenant URL (e.g., `http://coop-gent.localhost:3000` or `https://coop-gent.example.com`) receives its first request, the database connection resolver (`lib/db.ts`) will:

1. Automatically create `data/tenants/coop-gent.db`.
2. Apply all SQLite schema migrations (`0001` through latest).

### Step 3: Populate Demo Accounts or Seed Data (Optional)

To populate demo members (`admin`/`admin`, `owner`/`owner`, `alice`, `bob`, `carol`) and sample trips into the new tenant DB:

```bash
DB_PATH=data/tenants/coop-gent.db npx tsx scripts/seed-demo.ts
```

---

## 4. Local Development with Multi-Tenant Mode

### Convenience Seed Script

To reset and seed the platform DB along with all demo tenant databases (`primary`, `coop-a`, `coop-b`) in one command:

```bash
npm run dev:seed
```

This populates `data/platform.db`, `data/tenants/primary.db`, `data/tenants/coop-a.db`, `data/tenants/coop-b.db` and starts the Next.js dev server.

### Local Subdomain URLs

You can test multi-tenant subdomains locally out of the box in modern browsers:

- `http://primary.localhost:3000`
- `http://coop-a.localhost:3000`
- `http://coop-b.localhost:3000`

---

## 5. Backup & Restore Operations

When performing backups in multi-tenant mode, include all platform and tenant database files:

- **Platform Registry**: `data/platform.db` (and `-wal`, `-shm` files)
- **Tenant Databases**: `data/tenants/*.db` (and `-wal`, `-shm` files)
- **Legacy Primary DB**: `data/carsharing.db` (if upgraded from single-tenant)
