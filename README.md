# CarSharing

A self-hosted Progressive Web App (PWA) for managing a car-sharing cooperative. Track mileage trips, fuel fill-ups, maintenance costs, car reservations, and per-member financial balances.

## Getting started

```bash
git clone https://github.com/demeesterroel/CarSharing.git
cd CarSharing
npm install
npm run seed:demo     # creates data/carsharing.db with demo data
npm run dev           # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000).

**Demo accounts** (username = password):

| Account | Role |
|---------|------|
| `admin` | Admin — manages cars, people, settlement |
| `owner` | Car owner (Car BB) |
| `alice` | Member — pays balance in full each year |
| `bob`   | Member — partial payments |
| `carol` | Member — partial payments |

**What's populated:** dashboard with 5-year balances, trips/fuel/expenses across 3 cars, settlement 2021–2024 locked (2025 open).

To reset: delete `data/carsharing.db` and re-run `npm run seed:demo`. The `data/` directory is gitignored.

To seed into an isolated file (e.g. alongside a production-synced DB):

```bash
DB_PATH=./data/demo.db npm run seed:demo
DB_PATH=./data/demo.db npm run dev
```

## Features

- **Kilometers** — log trips with odometer start/end, GPS location, auto-calculated cost
- **Tanken** — log fuel fill-ups with receipt photo, auto-calculated price/litre
- **Calendar** — car reservation system with day/week/month views
- **People** — member management with per-km discount rates
- **Cars** — fleet management with price-per-km
- **Extra Kosten** — maintenance, taxes, and other car expenses
- **Betalingen** — settlement payments
- **Dashboard** — per-member annual balance (credit/debt overview)
- **Offline support** — add entries offline, sync when back online

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- [TanStack Query](https://tanstack.com/query) for data fetching
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for forms
- [SQLite](https://www.sqlite.org/) via `better-sqlite3`
- [Leaflet](https://leafletjs.com/) for GPS maps
- [FullCalendar](https://fullcalendar.io/) for the reservation calendar
- [next-pwa](https://github.com/shadowwalker/next-pwa) for PWA/offline support

## Self-Hosting

The app runs as a single Docker container with SQLite stored on a volume. Designed to sit behind [Traefik](https://traefik.io/) for HTTPS.

```
docker compose up -d
```

See [`docs/superpowers/specs/2026-04-18-autodelen-pwa-design.md`](docs/superpowers/specs/2026-04-18-autodelen-pwa-design.md) for the full design spec.

## License

MIT
