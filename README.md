# EstateDesk CRM

A real estate CRM built with Next.js to manage leads and follow-ups and close more deals.

## Features

- **Dashboard**: KPIs (active leads, follow-ups due, pipeline value, revenue closed), a 30-day lead trend, the pipeline funnel, today's agenda, hot leads going cold, lead sources, team target and leaderboard, and recent activity.
- **Lead management**:
  - List view with search, filters, sorting and pagination.
  - Kanban pipeline with drag and drop.
  - Bulk status, priority and assign changes, and bulk delete.
  - CSV import with duplicate detection, and CSV export.
  - Lead scoring, an activity timeline (notes, calls, meetings, emails) and a status stepper that records lost reasons.
  - Shortlisted properties and automatic property matching.
- **Property management**:
  - Grid and table views with filters for type, sale or rent, status, city, BHK and price.
  - Image gallery, amenities and owner details.
  - Lists of interested and matching leads.
  - Share on WhatsApp and copy details.
- **Follow-up reminders**:
  - Overdue, Today, Upcoming and Completed tabs, plus a month calendar.
  - Quick-schedule chips, completion with an outcome, and auto-scheduling of the next follow-up.
  - Snooze and reschedule, and a notification bell with the count of due reminders.
- **Deals**: a Kanban board by stage with a list view, expected commission, and win rate. When a deal is won, the lead and the property status update automatically.
- **WhatsApp integration**:
  - One-click click-to-chat with templates and variables (`{{name}}`, `{{property}}`, `{{price}}`, and others), with a live preview.
  - Template manager, a broadcast to filtered leads, and a full message log.
  - Optional WhatsApp Cloud API for sending directly from the CRM.
- **Reports and analytics**:
  - Date ranges and an agent filter.
  - Source ROI, conversion funnel, revenue by month, agent leaderboard with targets, lost reasons, inventory, and follow-up discipline.
  - CSV export and print to PDF.
- **Team and roles**: Admin, Manager and Agent roles. Agents see only their own leads and deals. Each person can have a monthly target, and when someone is deactivated their leads can be reassigned.
- **Lead capture webhook**: website and landing-page forms can post leads straight into the CRM. New leads are assigned round-robin, and a call reminder is created automatically.
- **Extras**:
  - Global search (Ctrl + K).
  - EMI and affordability calculator.
  - Profile and password change.
  - Company settings and currency.

## Tech stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript
- Prisma ORM with SQLite by default (PostgreSQL ready)
- Tailwind CSS v4, lucide icons, Recharts
- JWT session auth (jose) with bcrypt-hashed passwords

## Getting started

```bash
npm install
cp .env.example .env      # then set AUTH_SECRET
npm run setup             # creates the database and loads demo data
npm run dev
```

Open http://localhost:3000.

Demo logins (password `admin123`):

| Role    | Email                   |
|---------|-------------------------|
| Admin   | admin@estatedesk.com    |
| Manager | manager@estatedesk.com  |
| Agent   | rohan@estatedesk.com    |

To start with an empty CRM, run `npx prisma db push --force-reset` without seeding. Then open `/register` to create the first admin account.

## Production

```bash
npm run build
npm start
```

For PostgreSQL, set `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at your database, and run `npx prisma db push`.
Always set a long random `AUTH_SECRET` in production.

## WhatsApp Cloud API (optional)

Without the API, every message opens WhatsApp (web or app) with the text pre-filled. This works with no setup.
To send directly from the CRM, go to **Settings > WhatsApp Cloud API**, turn it on, and enter your Phone Number ID and permanent access token from Meta for Developers.

## Lead capture webhook

The URL is in **Settings > Lead capture webhook**:

```bash
curl -X POST "https://your-domain.com/api/webhooks/lead?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rahul Verma","phone":"9876543210","source":"WEBSITE","message":"Looking for 2 BHK"}'
```
