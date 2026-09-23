-- Add to the existing RugPrint Supabase schema.
create table if not exists rugprint_alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null,
  telegram_chat_id text,
  plan text not null default 'trial' check (plan in ('trial','pro')),
  alerts_used integer not null default 0,
  quota_month date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rugprint_alert_plan_idx on rugprint_alert_subscriptions(plan);
alter table rugprint_alert_subscriptions enable row level security;
-- Server/service-role only. Trial allowance: 3 delivered alerts per calendar month.
