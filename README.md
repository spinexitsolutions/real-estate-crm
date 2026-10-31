# EstateDesk CRM

A real estate CRM built with Next.js and Supabase to manage leads and follow-ups and close more deals.

## Features

- **Dashboard**: KPIs, a 30-day lead trend, the pipeline funnel, today's agenda, hot leads going cold, lead sources, team target and leaderboard, and recent activity.
- **Leads**:
  - List view and Kanban pipeline with drag and drop.
  - Filters, bulk actions, CSV import with duplicate detection, and CSV export.
  - Lead scoring, an activity timeline, lost reasons and automatic property matching.
- **Properties**:
  - Grid and table views with filters.
  - Photo upload to Supabase Storage: drag and drop, automatic compression, reorder and set cover.
  - Interested and matching leads, and share on WhatsApp.
- **Follow-up reminders**:
  - Overdue, Today, Upcoming and Completed tabs, plus a calendar.
  - Completion with an outcome, and auto-scheduling of the next follow-up.
  - In-app reminder pop-ups, browser and phone push notifications, and a daily email digest (plus an optional WhatsApp digest) for every agent.
- **Deals**: a stage board, commission tracking and win rate. When a deal is won, the lead and property status update automatically.
- **WhatsApp**:
  - Click-to-chat with templates.
  - Two-way inbox for customer replies via the Cloud API webhook.
  - Approved Meta templates, handling of the 24-hour window, broadcast, and delivery and read ticks.
- **Reports**: source ROI, conversion funnel, revenue, agent leaderboard with targets, lost reasons and inventory. CSV export and print to PDF.
- **Team and roles**: Admin, Manager and Agent roles. Agents see only their own data. Monthly targets, and reassignment when someone is deactivated.
- **Security**:
  - Hashed passwords and signed sessions.
  - Login rate limiting (5 failed attempts per email in 15 minutes).
  - Forgot and reset password by email.
  - Security headers.
  - Row Level Security that locks Supabase's public REST API.
- **Data**: a full JSON backup download for admins, and CSV exports.
- **Extras**:
  - Lead capture webhook for website forms.
  - Global search (Ctrl + K) and EMI calculator.
  - Installable as an app on phones (PWA).
  - One business timezone for everyone (default India).

## Tech stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Supabase: PostgreSQL database and Storage, with Prisma ORM
- Tailwind CSS v4, lucide icons, Recharts
- Web Push (VAPID), SMTP email (nodemailer), WhatsApp Cloud API
- Vitest unit tests

## Setup with Supabase

### 1. Create the Supabase project
1. Create a project at https://supabase.com. Choose the **Mumbai (ap-south-1)** region for Indian users.
2. Go to **Project Settings > Database > Connection string** and copy the connection strings:
   - **Transaction pooler** (port 6543) goes in `DATABASE_URL`. Add `?pgbouncer=true&connection_limit=1` to the end.
   - **Session pooler / direct** (port 5432) goes in `DIRECT_URL`.
3. Go to **Project Settings > API** and copy:
   - the Project URL into `SUPABASE_URL`
   - the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY` (secret, server only)

### 2. Configure and install
```bash
npm install
```
```bash
cp .env.example .env
```
Fill in `.env`. At minimum you need the database URLs, the Supabase keys, `AUTH_SECRET` and `APP_URL`.

### 3. Create the tables
To load demo data:
```bash
npm run setup
```
To start with an empty CRM instead:
```bash
npm run setup:empty
```
Both commands create the tables and enable Row Level Security on every table. RLS blocks Supabase's public REST API, while the app connects as the database owner and keeps full access. After any later schema change, run `npm run db:push`, then `npm run db:secure`.

The storage bucket `property-images` is created automatically on the first photo upload.

### 4. Run
```bash
npm run dev
```
For production:
```bash
npm run build
```
```bash
npm start
```

Demo logins (after `npm run setup`), all with password `admin123`:

| Role    | Email                   |
|---------|-------------------------|
| Admin   | admin@estatedesk.com    |
| Manager | manager@estatedesk.com  |
| Agent   | rohan@estatedesk.com    |

With an empty database, open `/register` to create the first admin account.

## Deploying to Vercel

1. Import the repository in Vercel and add every variable from `.env.example`.
2. Deploy. `vercel.json` already schedules the daily digest at 8 AM IST.
3. **Follow-up reminders every 5 minutes:** Vercel Hobby allows only daily crons, so use Supabase instead. Open the Supabase **SQL Editor** and run `docs/SUPABASE_CRON.sql` after putting your app URL and `CRON_SECRET` into it.

## Notifications

| Channel | Setup |
|---------|-------|
| In-app pop-ups | None needed. They work whenever the CRM is open. |
| Push (browser and phone) | Run `npm run vapid` and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Each user enables push from the bell icon or their Profile. |
| Daily email digest | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. Gmail (app password), Zoho, Brevo, Resend or SES all work. This also enables "Forgot password". |
| WhatsApp digest to agents | Create an approved Meta template with 3 variables (agent name, due today, overdue) and enter its name in Settings. |

**Settings > Notifications** shows what is configured and can send a test notification.

## WhatsApp

- **Without the API:** every message opens WhatsApp with the text pre-filled. No setup is needed.
- **With the Cloud API:**
  1. Go to **Settings > WhatsApp Cloud API** and enter the Phone Number ID and access token.
  2. In your Meta app, set the webhook to `https://your-domain/api/webhooks/whatsapp` with the verify token shown in Settings, and subscribe to `messages`.
  3. Replies then appear in **WhatsApp > Inbox**.
- **Approved templates:** WhatsApp lets you send free text only within 24 hours of the customer's last message. For anything else, including broadcasts, add the approved Meta template name and parameter order to the template in **WhatsApp > Templates**.

## Lead capture webhook

Copy the URL from **Settings > Lead capture webhook**:

```bash
curl -X POST "https://your-domain.com/api/webhooks/lead?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rahul Verma","phone":"9876543210","source":"WEBSITE","message":"Looking for 2 BHK"}'
```

New leads are assigned to the agent with the fewest open leads, and a call reminder is created for 15 minutes later.

## Backups

- Supabase backs up the database daily on paid plans. Enable Point-in-Time Recovery for minute-level restore.
- Admins can download a full JSON backup at any time from **Settings > Data & backup**.

## Timezone

All dates use `APP_TIMEZONE` (default `Asia/Kolkata`), whatever the server or browser timezone is.

## Tests

```bash
npm test
```
