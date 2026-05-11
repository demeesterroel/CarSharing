# End-user Guide

This guide walks you through using the car sharing app as a member — from accepting your invite to logging trips and reading your costs.

> Looking for the car owner documentation? See the [Owner Guide](owner-guide.md).

---

## 1. Accepting your invite

The owner sends you a personal invite link by email or message. Click the link to open the app.

The owner generates this link from the **Members** page in the admin panel — you will receive it directly.

![Admin copying an invite link from the members page](screenshots/01-invite-link.png)

You will land on a login page pre-filled for your account. Set a password and log in.

![First login / set password screen](screenshots/02-first-login.png)

---

## 2. Setting up your profile

After logging in, open your profile via the menu (top-right corner).

![Profile menu entry](screenshots/03-profile-menu.png)

Fill in two required fields:

| Field                   | Why it matters                                 |
| ----------------------- | ---------------------------------------------- |
| **Email address**       | Used for settlement notifications              |
| **Bank account (IBAN)** | Used to send or receive payments at settlement |

![Profile edit form with email and IBAN fields](screenshots/04-profile-edit.png)

Save your changes. You can update these at any time.

---

## 3. Dashboard

The dashboard is your home page. It shows a summary of recent activity across all cars you have access to.

![Full dashboard view](screenshots/05-dashboard.png)

### What you see

- **Recent trips** — your latest recorded drives
- **Fuel entries** — recent fill-ups
- **Cost summary** — your current balance at a glance

### Filters

Use the filter bar at the top to narrow the view by:

- **Car** — show data for one specific car
- **Date range** — limit to a specific period

![Dashboard filter bar open](screenshots/06-dashboard-filters.png)

---

## 4. Trips page

The trips page lists all recorded drives.

![Trips page full view](screenshots/07-trips.png)

### Filters

| Filter         | Description                     |
| -------------- | ------------------------------- |
| **Car**        | Show trips for one car only     |
| **Driver**     | Show trips by a specific member |
| **Date range** | Limit to a start and end date   |

![Trips filter panel open](screenshots/08-trips-filters.png)

Each trip card shows: date, driver, car, distance (km), and any notes.

![Single trip card](screenshots/09-trip-card.png)

---

## 5. Fuel page

The fuel page lists all recorded fill-ups.

![Fuel page full view](screenshots/10-fuel.png)

### Filters

| Filter         | Description                        |
| -------------- | ---------------------------------- |
| **Car**        | Show fuel entries for one car only |
| **Date range** | Limit to a start and end date      |

![Fuel filter panel open](screenshots/11-fuel-filters.png)

Each fuel entry shows: date, car, litres, price per litre, total cost, and who paid.

![Single fuel card](screenshots/12-fuel-card.png)

---

## 6. Cost page

The cost page breaks down what you owe or are owed.

![Cost page full view](screenshots/13-cost.png)

Costs are split by category (trips, fuel, expenses) and show your share versus the group total.

### Filters

| Filter            | Description                  |
| ----------------- | ---------------------------- |
| **Car**           | Costs for one car only       |
| **Period / year** | Limit to a settlement period |

![Cost filter panel open](screenshots/14-cost-filters.png)

---

## 7. Adding data with the FAB

The **FAB** (Floating Action Button) is the **+** button at the bottom-right of the screen. It is the fastest way to log new information.

![FAB button collapsed](screenshots/15-fab-closed.png)

Tap the FAB to expand it. On the dashboard it shows all options; on individual pages it shows the relevant action for that page.

![FAB expanded showing options (trip, fuel, expense)](screenshots/16-fab-expanded.png)

---

## 8. Adding a new trip

Tap the FAB → **Add trip** (or use the button on the Trips page).

![FAB expanded with Add trip highlighted](screenshots/17-fab-add-trip.png)

Fill in the form:

| Field            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| **Car**          | Which car was driven                                               |
| **Date**         | Date of the trip                                                   |
| **Driver**       | Who drove (defaults to you)                                        |
| **Start km**     | Odometer reading at the start of the trip                          |
| **End km**       | Odometer reading at the end (distance is calculated automatically) |
| **Parking note** | Optional note about where the car is parked                        |

![New trip form filled in](screenshots/18-trip-form.png)

Tap **Save**. The trip appears immediately in the list.

![Trips list with new trip at top](screenshots/19-trips-after-add.png)

---

## 9. Adding a fuel entry

Tap the FAB → **Add fuel** (or use the button on the Fuel page).

![FAB expanded with Add fuel highlighted](screenshots/20-fab-add-fuel.png)

Fill in the form:

| Field          | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| **Car**        | Which car was refuelled                                            |
| **Date**       | Date of the fill-up                                                |
| **Driver**     | Who paid at the pump (defaults to you)                             |
| **Amount (€)** | Total amount paid                                                  |
| **Litres**     | Amount of fuel added (price per litre is calculated automatically) |

![New fuel form filled in](screenshots/21-fuel-form.png)

Tap **Save**. The entry appears on the Fuel page and is included in cost calculations.

![Fuel list with new entry at top](screenshots/22-fuel-after-add.png)
