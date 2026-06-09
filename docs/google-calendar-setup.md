# Google Calendar Setup

This guide explains how to configure the optional Google Calendar integration for autodelen.

---

## How it works

Autodelen has a two-way sync with a shared Google Calendar:

- **App → Google Calendar:** Every reservation that is created, updated, or deleted is automatically pushed to a shared Google Calendar. The event shows the car, the member's name, and the reservation dates.
- **Google Calendar → App:** Each car owner receives a personal calendar invite for reservations on their car. When the owner accepts or declines the invite directly in their calendar app, autodelen picks up the RSVP response and updates the reservation status automatically — no app login required.

**Event status mapping:**

| App status | Google Calendar event |
| ---------- | --------------------- |
| Pending    | Tentative             |
| Confirmed  | Confirmed             |
| Rejected   | Cancelled (removed)   |

**Who needs an email address?**
Only car owners — they receive personal invites. Regular members do not need an email address for this feature.

The integration is **opt-in**: it is disabled until both `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (environment variables) and the calendar ID + refresh token (admin settings) are configured.

---

## Prerequisites

- A Google account that owns or has editor access to the shared calendar
- A Google Cloud project (free tier is fine)
- The app must be reachable via a public HTTPS URL (Google sends webhook events here)

---

## Step 1 — Create a Google Cloud project and enable the Calendar API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (e.g. "autodelen").
2. Enable the **Google Calendar API**: APIs & Services → Library → search "Google Calendar API" → Enable.

---

## Step 2 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose user type: **Internal** (Google Workspace org) or **External** (personal accounts).
3. Fill in app name and contact email. Click Save.
4. Under **Scopes**, add `https://www.googleapis.com/auth/calendar`.
5. If you chose _External_, go to **Test users** and add the Google account that owns the shared calendar.

---

## Step 3 — Create an OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
2. Application type: **Web application**.
3. Under **Authorized redirect URIs**, add: `https://developers.google.com/oauthplayground`
4. Click **Create**. Copy the **Client ID** and **Client Secret**.

**Note on accounts:**

- **Client ID + Client Secret** — tied to the Google Cloud project, not a personal account.
- **Refresh token** — tied to the Google account that went through OAuth. This account must have editor access to the shared calendar.
- **Calendar ID** — any Google Calendar. Share it with the OAuth account if it is not owned by it.

---

## Step 4 — Add credentials to your environment

Add to `.env.local` and the `docker-compose.yml` env block:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CRON_SECRET=a-random-secret-string
NEXT_PUBLIC_BASE_URL=https://your-domain
```

`NEXT_PUBLIC_BASE_URL` must be a publicly reachable HTTPS URL — Google sends webhook events here. For local testing, use an ngrok or cloudflared tunnel.

---

## Step 5 — Get a refresh token

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right) → enable **Use your own OAuth credentials** → enter your Client ID and Client Secret.
3. In the left panel, find **Google Calendar API v3** → select `https://www.googleapis.com/auth/calendar` → click **Authorise APIs**.
4. Sign in with the Google account that owns the shared calendar.
5. Click **Exchange authorisation code for tokens** → copy the **Refresh token**.

---

## Step 6 — Find your calendar ID

1. Open [Google Calendar](https://calendar.google.com) with the shared account.
2. In the left sidebar, click the three dots next to the shared calendar → **Settings and sharing**.
3. Scroll down to **Integrate calendar** → copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`).

---

## Step 7 — Configure in admin settings

1. Open the app → **Admin → Settings**.
2. Enter the **Google Calendar ID** from Step 6.
3. Enter the **OAuth Refresh Token** from Step 5.
4. Click **Save**.
5. Click **Test connection** — should return success.
6. Click **Sync upcoming reservations** to backfill all existing confirmed reservations.

---

## Step 8 — Register the webhook

The app uses a push webhook to receive RSVP responses in real time. Register it once after initial setup:

```bash
curl -sf -X GET https://your-domain/api/admin/calendar-renew \
  -H "Authorization: Bearer your-cron-secret"
```

---

## Step 9 — Set up the cron job

The watch channel expires every ~4 weeks. A daily cron job renews it automatically. Add to the VPS crontab (`/etc/cron.d/autodelen` or root crontab):

```cron
0 3 * * * curl -s -X GET https://your-domain/api/admin/calendar-renew \
  -H "Authorization: Bearer your-cron-secret" \
  >> /var/log/autodelen-calendar-renew.log 2>&1
```

---

## Step 10 — Link cars to owners

For owners to receive personal invites:

1. **Admin → Cars** — edit each car and set the **Owner** to the correct person.
2. **Admin → Members** — expand each owner's row and fill in their **email address**.

---

## Ongoing maintenance

| Event                       | Action                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Refresh token expires       | Repeat Step 5 and paste the new token in Admin → Settings           |
| Watch channel stops working | Call `/api/admin/calendar-renew` manually (cron should handle this) |
| New car added               | Set its owner in Admin → Cars; ensure owner email is set            |
| Calendar sync seems stuck   | Click **Sync upcoming reservations** in Admin → Settings            |
