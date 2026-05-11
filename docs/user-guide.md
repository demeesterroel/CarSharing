# End-user Guide

This guide walks you through using the car sharing app as a member — from accepting your invite to logging trips and managing reservations.

> Looking for the car owner documentation? See the [Owner Guide](owner-guide.md).

---

## 1. Accepting your invite

The car owner sends you a personal invite link by email or message. The link looks like:

```
/invite/a3f2c1d4e5b6...
```

Click the link to open the app. You will land on a **Set password** screen.

![Invite page — set your password to get started](screenshots/member-02-invite-page.png)

Choose a password (minimum 8 characters), confirm it, and click **Set password**. You are logged in immediately and land on your profile page to fill in your details.

---

## 2. Setting up your profile

After logging in, hover over your **name** in the top-right corner of any page to reveal the pencil icon, then click it.

![Hover over your name to reveal the edit pencil](screenshots/member-03-profile-menu.png)

Fill in two required fields:

| Field                   | Why it matters                                 |
| ----------------------- | ---------------------------------------------- |
| **Email address**       | Used for settlement notifications              |
| **Bank account (IBAN)** | Used to send or receive payments at settlement |

![Profile edit form with email and IBAN fields](screenshots/member-04-profile-edit.png)

Save your changes. You can update these at any time.

---

## 3. Dashboard

The dashboard is your home page. It shows an overview of all cars you have access to.

![Full dashboard view](screenshots/member-05-dashboard.png)

The dashboard contains:

- **Balance** — your running cost balance across all cars
- **Car locations** — where each car is currently parked
- **Recent trips, fuel, and expenses** — the latest entries with an **All** link to the full page
- **Upcoming reservations** — your next confirmed and pending reservations

### Year summary

Scroll down to see a breakdown by year — total distance driven, fuel cost, and your share of expenses.

![Dashboard year summary section](screenshots/member-06-dashboard-filters.png)

---

## 4. Trips page

The trips page lists all recorded drives.

![Trips page full view](screenshots/member-07-trips.png)

### Filters

| Filter   | Description                 |
| -------- | --------------------------- |
| **Car**  | Show trips for one car only |
| **Year** | Limit to a specific year    |
| **Mine** | Show only your own trips    |

![Trips filter panel open](screenshots/member-08-trips-filters.png)

Each trip card shows: destination, driver, date, odometer range, and cost. Click a trip to view and edit its details.

![Single trip card](screenshots/member-09-trip-card.png)

![Trip detail view](screenshots/member-34-trip-detail.png)

---

## 5. Fuel page

The fuel page lists all recorded fill-ups.

![Fuel page full view](screenshots/member-10-fuel.png)

### Filters

| Filter   | Description                        |
| -------- | ---------------------------------- |
| **Car**  | Show fuel entries for one car only |
| **Year** | Limit to a specific year           |
| **Mine** | Show only fill-ups you paid for    |

![Fuel filter panel open](screenshots/member-11-fuel-filters.png)

Each fuel entry shows: date, car, litres, price per litre, total cost, and who paid. Click an entry to view and edit its details.

![Single fuel card](screenshots/member-12-fuel-card.png)

![Fuel detail view](screenshots/member-35-fuel-detail.png)

---

## 6. Expenses page

The expenses page lists all one-off costs — parking fees, maintenance contributions, accessories, and other shared costs.

![Expenses page full view](screenshots/member-13-cost.png)

### Filters

| Filter   | Description                        |
| -------- | ---------------------------------- |
| **Car**  | Show expenses for one car only     |
| **Mine** | Show only your own expense entries |
| **Year** | Limit to a specific year           |

![Expenses filter panel open](screenshots/member-14-cost-filters.png)

Each expense card shows: date, car, amount, description, and category. Click an expense to view and edit its details.

![Single expense card](screenshots/member-23-expense-card.png)

![Expense detail view](screenshots/member-36-expense-detail.png)

---

## 7. Reservations

The reservations page lets you request dates for a car in advance. The car owner confirms or rejects requests.

![Reservations page — timeline and upcoming list](screenshots/member-24-reservation-list.png)

The timeline uses these indicators:

| Symbol | Meaning               |
| ------ | --------------------- |
| □      | Day is available      |
| ▦      | Pending reservation   |
| ■      | Confirmed reservation |

### Viewing and editing a reservation

Tap any reservation card in the Upcoming list to open it. You can change the dates, car, or note — or cancel the reservation.

![Reservation detail view](screenshots/member-37-reservation-detail.png)

### Creating a reservation

There are three ways to open the reservation form:

**1. FAB button** — tap the **+** button at the bottom-right of any page and choose **Add reservation**. The form opens with no dates selected.

![Reservation form opened via FAB — no dates pre-filled](screenshots/member-25-reservation-form-empty.png)

**2. "+ Add reservation" button** — tap the button in the Upcoming list header. Same as the FAB: no dates pre-filled.

**3. Calendar pick** — tap a day in the per-car timeline to start a range; tap the end day. The form opens with those dates already filled in.

![Reservation form with dates from calendar pick](screenshots/member-26-reservation-form-calendar.png)

### Overlapping reservations

If you select dates that overlap an existing reservation for the same car, a warning appears. You can still submit — the owner sees the overlap and decides.

![Reservation form showing conflict warning](screenshots/member-27-reservation-conflict.png)

### Reservation status

| Status        | Meaning                                          |
| ------------- | ------------------------------------------------ |
| **Pending**   | Submitted, waiting for owner to confirm          |
| **Confirmed** | Owner approved — the car is yours on those dates |
| **Rejected**  | Owner declined                                   |

Pending reservations appear with an amber indicator; confirmed ones appear in black.

![Pending and confirmed reservation cards in the upcoming list](screenshots/member-28-reservation-cards.png)

---

## 8. Adding data with the FAB

The **FAB** (Floating Action Button) is the **+** button at the bottom-right of the screen. It is the fastest way to log new information.

![FAB button collapsed](screenshots/member-15-fab-closed.png)

Tap the FAB to expand it. On the dashboard it shows all options; on individual pages it shows the action relevant to that page.

![FAB expanded showing options (trip, fuel, expense, reservation)](screenshots/member-16-fab-expanded.png)

---

### 8.1 Adding a new trip

Tap the FAB → **Add trip** (or use the button on the Trips page).

![FAB expanded with Add trip highlighted](screenshots/member-17-fab-add-trip.png)

Fill in the form:

| Field            | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| **Car**          | Which car was driven                                               |
| **Date**         | Date of the trip                                                   |
| **Driver**       | Who drove (defaults to you)                                        |
| **Start km**     | Odometer reading at the start of the trip                          |
| **End km**       | Odometer reading at the end (distance is calculated automatically) |
| **Parking note** | Optional note about where the car is parked                        |

![New trip form filled in](screenshots/member-18-trip-form.png)

Tap **Save**. The trip appears immediately in the list.

![Trips list with new trip at top](screenshots/member-19-trips-after-add.png)

---

### 8.2 Adding a fuel entry

Tap the FAB → **Add fuel** (or use the button on the Fuel page).

![FAB expanded with Add fuel highlighted](screenshots/member-20-fab-add-fuel.png)

Fill in the form:

| Field          | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| **Car**        | Which car was refuelled                                            |
| **Date**       | Date of the fill-up                                                |
| **Driver**     | Who paid at the pump (defaults to you)                             |
| **Amount (€)** | Total amount paid                                                  |
| **Litres**     | Amount of fuel added (price per litre is calculated automatically) |

![New fuel form filled in](screenshots/member-21-fuel-form.png)

Tap **Save**. The entry appears on the Fuel page and is included in cost calculations.

![Fuel list with new entry at top](screenshots/member-22-fuel-after-add.png)

---

### 8.3 Adding an expense

Tap the FAB → **Add expense** (or use the button on the Expenses page).

![FAB expanded with Add expense highlighted](screenshots/member-30-fab-add-expense.png)

Fill in the form:

| Field           | Description                                  |
| --------------- | -------------------------------------------- |
| **Car**         | Which car the expense relates to             |
| **Date**        | Date of the expense                          |
| **Amount (€)**  | Total amount paid                            |
| **Description** | What the expense was for                     |
| **Category**    | Type of expense (parking, maintenance, etc.) |

![New expense form filled in](screenshots/member-31-expense-form.png)

Tap **Save**. The entry appears on the Expenses page and is included in settlement calculations.

![Expenses list with new entry at top](screenshots/member-32-expense-after-add.png)

---

### 8.4 Adding a reservation

Tap the FAB → **Add reservation** (or use the button on the Reservations page).

![FAB expanded with Add reservation highlighted](screenshots/member-33-fab-add-reservation.png)

The reservation form opens with no dates selected. Select a date range using the calendar grid, choose the car, add an optional note, and tap **Request** (or **Confirm** if you are an admin).

The car owner will be notified and can confirm or reject the request.

> See [Section 7](#7-reservations) for a full description of the form, calendar pick flow, and reservation statuses.
