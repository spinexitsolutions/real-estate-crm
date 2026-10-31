-- Run follow-up reminders every 5 minutes using Supabase (pg_cron + pg_net).
-- Vercel Hobby only allows one cron per day, so this is the recommended way to get
-- timely push reminders. Run this once in Supabase: Dashboard > SQL Editor.
--
-- 1. Replace YOUR_APP_URL with your deployed URL (e.g. https://crm.yourcompany.com)
-- 2. Replace YOUR_CRON_SECRET with the CRON_SECRET environment variable value

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove an old schedule with the same name (safe to run again)
select cron.unschedule('estatedesk-reminders')
where exists (select 1 from cron.job where jobname = 'estatedesk-reminders');

select cron.schedule(
  'estatedesk-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'YOUR_APP_URL/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Check recent runs:
-- select * from cron.job_run_details order by start_time desc limit 10;
-- select id, status_code, content from net._http_response order by created desc limit 10;
