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
- **Bookings and payments**:
  - Bookings created from won deals.
  - Payment plans: construction-linked, 20/80, monthly, or custom.
  - Every payment gets its own numbered PDF receipt (amount in words), including each part payment on an installment, plus account statements.
  - Receipts are never deleted. A wrong entry or bounced cheque is cancelled with a reason, the receipt stays on record marked CANCELLED (so receipt numbers have no gaps), and the amount is removed from the schedule.
  - UPI, NEFT, RTGS, IMPS, cheque and DD payments require a transaction or cheque reference.
  - Overdue tracking, and payment-due reminders to the agent and customer (push, email and WhatsApp template).
- **Customer portal**: a private link (optional PIN) where the buyer sees their booking, payment schedule, receipts and shared documents.
- **Documents**: KYC (PAN, Aadhaar, photo), agreements, sale deeds and receipts per lead or booking, in a private Supabase bucket. Files can be previewed, downloaded and shared with the customer.
- **Property brochure PDF**: company logo, brand colour, photos, specs and agent contact (never owner details). Can be shared on WhatsApp as a signed link.
- **Public website** (`/site/<company-slug>`): home page, search, property pages with enquiry form and brochure download. Only published listings appear, and enquiries become leads automatically.
- **Portal integrations**:
  - Facebook and Instagram Lead Ads (webhook).
  - 99acres, MagicBricks and Housing.com lead push URLs.
  - Lead-email forwarding.
  - An integration log.
- **Calls**:
  - Click-to-call through Exotel or Knowlarity, with call recordings and missed-call follow-ups.
  - Manual call logging with outcome.
  - A calls dashboard.
- **Attendance and site visits**:
  - GPS check-in and check-out with distance from the office.
  - Late and absent tracking, team view and CSV export.
  - Site-visit check-in that records distance from the property.
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

## Running it as a SaaS (multi-company)

EstateDesk is multi-tenant: many companies sign up and use the same deployment, each with completely separate data.

- **Data isolation:**
  - Every business table has an `organizationId`, and the app's database client (`src/lib/db.ts`) scopes every query to the signed-in company automatically.
  - It rejects writes that reference another company's records, and throws instead of returning data when no company context exists.
  - Inserts without a company also fail at the database level.
  - `npm run test:isolation` verifies all of this.
- **Sign-up and trial:**
  - `/signup` creates a company on a free trial (`TRIAL_DAYS`, default 14) with its admin user and starter templates, then opens the setup wizard at `/onboarding`.
- **Plans and limits:**
  - Plans (users, leads and properties limits, plus features) are managed in **/admin > Plans**.
  - Features a plan does not include are hidden or show an upgrade screen.
  - Leads from webhooks, the website and portals are never dropped, even over a limit.
- **Billing (Razorpay subscriptions):**
  1. Set the `RAZORPAY_*` env vars.
  2. Run `npm run razorpay:sync-plans`.
  3. Add the webhook `https://your-domain/api/webhooks/razorpay`.
  - Customers subscribe from **Plan & Billing** and get GST tax invoices.
  - Without Razorpay keys, customers are asked to contact you, and you activate plans from /admin.
- **Read-only mode:**
  - When a trial ends or a subscription lapses (after a 3-day grace period for failed payments), the company can still sign in, view and export, but cannot change anything until it subscribes.
  - Incoming leads keep arriving.
  - Suspended companies see a "contact support" screen.
- **Super admin panel (`/admin`):**
  - Only for emails in `SUPER_ADMIN_EMAILS`.
  - Shows MRR, ARR, sign-ups, trial conversion and churn.
  - From each company's page you can extend a trial, activate (paid offline), change plan, suspend or delete it, and record invoices.
  - **Login as** lets you see a company exactly as a user does, for support; it is recorded in the audit log.
  - Plans and invoices are managed here too.
- **Marketing site:** landing page `/`, `/pricing` (plans read from the database), `/contact`, and legal pages `/terms`, `/privacy` and `/refund-policy`. Razorpay requires these for merchant approval; they show a "template" note until you set `NEXT_PUBLIC_LEGAL_NAME`.
- **Branding:** set `NEXT_PUBLIC_APP_NAME` and the other `NEXT_PUBLIC_*` values to rebrand the product. Each customer company also sets its own logo and colour.
- **Per-company URLs:**
  - Public website: `/site/<company-slug>`
  - Customer portal: `/portal/<token>`
  - Lead and telephony webhooks: identified by each company's secret key
  - WhatsApp and Facebook webhooks: use `?org=<company id>` (shown in Settings and Integrations)

### Go-live checklist
1. Create a Supabase project and set the database and storage variables, then run `npm run setup:empty`.
2. Deploy on Vercel with every variable from `.env.example`, including `SUPER_ADMIN_EMAILS` and a strong `AUTH_SECRET`.
3. Sign up your own company at `/signup` with an email listed in `SUPER_ADMIN_EMAILS`, then open `/admin`.
4. Set your prices in /admin > Plans.
5. Add your Razorpay keys, run `npm run razorpay:sync-plans`, and add the Razorpay webhook.
6. Set your legal name, address, GSTIN and support contacts, and review the legal pages with your lawyer.
7. Run `docs/SUPABASE_CRON.sql` (every-5-minute reminders) and configure SMTP and the VAPID keys.

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

Demo logins (after `npm run setup`), all with password `admin123`. Add `admin@estatedesk.com` to `SUPER_ADMIN_EMAILS` to open /admin:

| Role    | Email                   |
|---------|-------------------------|
| Admin   | admin@estatedesk.com    |
| Manager | manager@estatedesk.com  |
| Agent   | rohan@estatedesk.com    |
| Second company (trial), for checking isolation | owner@harbourhomes.in |

With an empty database, open `/signup` to create the first company.

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

## Click-to-call (Exotel / Knowlarity)

1. Go to **Settings > Click-to-call**, choose the provider and enter its credentials.
2. Paste the callback URL shown there into the provider dashboard.
3. Each agent must add their mobile number in **My Profile**. The provider rings the agent first, then connects the customer. Calls and recordings appear on the lead and on the Calls page.

## Portal integrations

Open **Integrations** (Admin/Manager) for each portal's webhook URL, setup steps and a "Send test lead" button.
- **Facebook / Instagram:** add the webhook to your Meta app (Page > `leadgen`) with the verify token, plus a Page access token with `leads_retrieval` permission.
- **99acres / MagicBricks / Housing.com:** share the URL with your portal account manager and ask them to enable lead push to your CRM. Lead-notification emails can also be forwarded to the email webhook.

## Public website and customer portal

- Enable the website in **Settings > Public website**, and switch on "Publish on website" for each property. The site is at `/site`.
- Create a customer portal link from the lead or booking page (optional PIN) and share it on WhatsApp.

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
