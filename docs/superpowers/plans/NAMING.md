# Dutch → English Naming Reference

This document shows the complete Dutch → English mapping applied across all plans.

## Table names

| Dutch (AppSheet) | English (DB + code) |
|---|---|
| Kilometers / ritten | trips |
| Tanken / tankbeurten | fuel_fillups |
| Kosten / Extra Kosten | expenses |
| Betalingen / betaald | payments |
| Personen | people |
| Wagens | cars |
| Reserveringen | reservations |

## Column names

| Dutch | English |
|---|---|
| Naam (person) | name / person_name |
| Wagen | car_short |
| datum | date |
| start | start_odometer |
| eind | end_odometer |
| Kilometers | km |
| Bedrag | amount |
| Locatie | location |
| #liter | liters |
| prijs/liter | price_per_liter |
| kilometerstand | odometer |
| Bonnetje | receipt |
| Kosten (description field) | description |
| Opmerking | note |
| korting | discount |
| korting_long | discount_long |
| prijs (per km) | price_per_km |
| merk | brand |
| kleur | color |
| betaald_bedrag | paid_amount |
| saldo_bedrag | balance |
| rit_aantal | trip_count |
| rit_km | trip_km |
| tank_aantal | fuel_count |
| tank_liter | fuel_liters |
| rit_bedrag | trip_amount |
| tank_bedrag | fuel_amount |
| kost_bedrag | expense_amount |
| totaal_bedrag | total_amount |

## App routes

| Dutch | English |
|---|---|
| /ritten | /trips |
| /tanken | /fuel |
| /kosten | /expenses |
| /betaald | /payments |
| /calendar | /calendar |
| /people | /people |
| /cars | /cars |

## API routes

| Dutch | English |
|---|---|
| /api/ritten | /api/trips |
| /api/tankbeurten | /api/fuel |
| /api/kosten | /api/expenses |
| /api/betaald | /api/payments |

## File names

| Dutch | English |
|---|---|
| app/ritten/ | app/trips/ |
| app/tanken/ | app/fuel/ |
| app/kosten/ | app/expenses/ |
| app/betaald/ | app/payments/ |
| lib/queries/ritten.ts | lib/queries/trips.ts |
| lib/queries/tankbeurten.ts | lib/queries/fuel-fillups.ts |
| lib/queries/kosten.ts | lib/queries/expenses.ts |
| lib/queries/betaald.ts | lib/queries/payments.ts |
| hooks/use-ritten.ts | hooks/use-trips.ts |
| hooks/use-tankbeurten.ts | hooks/use-fuel-fillups.ts |
| hooks/use-kosten.ts | hooks/use-expenses.ts |
| hooks/use-betaald.ts | hooks/use-payments.ts |
| rit-form.tsx | trip-form.tsx |
| tank-form.tsx | fuel-form.tsx |
| kost-form.tsx | expense-form.tsx |
| betaald-form.tsx | payment-form.tsx |

## UI labels (Dutch — kept for users)

The app UI keeps Dutch labels where appropriate (the users are Dutch-speaking):
- "Tanken" tab label
- "Kilometers" tab label  
- "Naam", "Datum", "Bedrag" form labels

Code-level names (variables, files, routes, DB columns) are English throughout.
