# CarSharing

A self-hosted Progressive Web App (PWA) for managing a car-sharing cooperative. Track mileage trips, fuel fill-ups, maintenance costs, car reservations, and per-member financial balances.

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
