# Access Control (ACL) Reference — CarSharing

This is the authoritative reference for **who may do what** in the API. It is the
spec for the planned central policy module (issue #310). Until that lands,
authorization is enforced per-route via helpers in `lib/api.ts`
(`requireAdmin`, `requireAdminOrOwner`, `requireAdminOrCarOwner`,
`requireCanEdit`, `requireSession`), so this table also doubles as a checklist
for auditing those routes.

> Derived from a security review of `main`. Keep this table in sync when routes
> or roles change — and ideally make it executable as the test fixture for
> `lib/acl.ts` once #310 is implemented.

## Roles

"Owner" and "Member" are **not** separate database flags:

| Role       | How determined                                                                     |
| ---------- | ---------------------------------------------------------------------------------- |
| **Guest**  | No / invalid session                                                               |
| **Member** | `session.personId` set, `is_admin = 0`, owns no car                                |
| **Owner**  | A member who is `owner_person_id` on ≥ 1 car (computed at runtime via `isOwner()`) |
| **Admin**  | `is_admin = 1`                                                                     |

## Scope legend

| Token   | Meaning                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `own`   | The record you created, or your own person row                                                                           |
| `other` | A record belonging to someone else — e.g. an owner acting on a reservation for **their** car that another member created |
| `all`   | Any record                                                                                                               |
| `—`     | Denied                                                                                                                   |

## Permission matrix

| Resource / action                            | Guest       | Member                      | Owner                       | Admin           |
| -------------------------------------------- | ----------- | --------------------------- | --------------------------- | --------------- |
| **Trips** — read list/one                    | —           | all                         | all                         | all             |
| Trips — create                               | —           | own¹                        | own¹                        | all             |
| Trips — edit/delete                          | —           | own                         | own + on-my-car             | all             |
| **Fuel** — read / create / edit-delete       | —           | all / own¹ / own            | all / own¹ / own+my-car     | all / all / all |
| **Expenses** — read / create / edit-delete   | —           | all / own¹ / own            | all / own¹ / own+my-car     | all / all / all |
| **Reservations** — read list                 | —           | all                         | all                         | all             |
| Reservations — read one                      | — / ⚠️ #306 | all                         | all                         | all             |
| Reservations — **create**                    | — / 🔴 #306 | own¹                        | own¹                        | all             |
| Reservations — edit/delete                   | —           | own                         | own + on-my-car             | all             |
| Reservations — **approve/reject status**     | —           | **—**                       | **other** (on-my-car only)  | all             |
| **Payments** — read / create / edit / delete | —           | —                           | —                           | all             |
| **People list** — read                       | — / ⚠️ #306 | all (PII stripped²)         | all (PII stripped²)         | all (full)      |
| **Person [id]** — read                       | —           | all (**PII leaks ⚠️ #307**) | all (**PII leaks ⚠️ #307**) | all             |
| Person — create / edit (admin fields)        | —           | —                           | —                           | all             |
| Person — edit **own profile**                | —           | own                         | own                         | all             |
| Person — invite / revoke-sessions            | —           | —                           | —                           | all             |
| **Vehicles** — read list/one                 | — / ⚠️ #306 | all                         | all                         | all             |
| Vehicles — create                            | —           | —                           | own (forced³)               | all             |
| Vehicles — edit                              | —           | —                           | own car, limited fields⁴    | all fields      |
| Vehicles — delete                            | —           | —                           | own car                     | all             |
| **Settings** — read / write                  | —           | —                           | read / —                    | read+write      |
| **Settlement** — read / lock-unlock          | —           | —                           | read / —                    | read+write      |
| **Admin summary** — read / write             | —           | —                           | read / —⁵                   | read / —⁵       |

> ⚠️ / 🔴 markers are **open gaps** at time of writing, tracked in **#306**
> (missing authentication) and **#307** (field-level authz). They are the
> concrete bugs the ACL refactor (#310) is meant to make structurally
> impossible.

## Footnotes

1. **Integrity gap (request-attributed `person_id`).** The create routes
   `POST /api/trips`, `/api/fuel`, `/api/expenses`, and `/api/reservations` take
   `person_id` from the **request body** and do not verify it equals the caller.
   A member can therefore create a record **attributed to someone else**. The UI
   prevents this; the API does not. The ACL refactor should derive `person_id`
   from the session (admins may override).

2. **(PII stripped).** `GET /api/people` returns names, usernames, and discounts
   to non-admins but removes `email` and `bank_account` (fixed in #268).
   `password_hash` and `session_epoch` are **always** stripped server-side in
   `getPersonById` / `getPeople`, for every caller.

3. **(own forced).** When a non-admin owner creates a vehicle,
   `POST /api/vehicles` ignores any client-supplied `owner_person_id` and forces
   it to the caller's `personId` — an owner cannot create a car owned by someone
   else. Admins may set any owner.

4. **(limited fields).** A non-admin owner editing their own car
   (`PUT /api/vehicles/[id]`) may change only `name`, `price_per_km`, and
   `active` (validated by `ownerCarPatchSchema`); `short`, `brand`, `color`,
   `long_threshold`, `owner_person_id`, and `expected_km` are preserved from the
   existing row. Admins may edit all fields.

5. **(admin summary — nobody writes).** `/api/admin/summary` is a **read-only**
   computed/aggregated view (P&L, km-gaps, contributions). There is no write
   endpoint, so "write" is **N/A for everyone** — it is not "denied to admin"
   specifically. The same read-vs-write split applies to Settings and Settlement:
   owners can **read** but only admins can **write**.

## Related

- `SECURITY-AUDIT.md` — the security review this table came out of.
- **#310** — chore: centralize access control in a policy module (`lib/acl.ts`).
- **#306** — bug: reservation-create + several GET reads are unauthenticated.
- **#307** — bug: `GET /api/people/[id]` leaks email + bank account to any member.
