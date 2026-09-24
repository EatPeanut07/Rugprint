alter table public.rugprint_alert_subscriptions drop constraint if exists rugprint_alert_subscriptions_plan_check;
alter table public.rugprint_alert_subscriptions alter column plan set default 'free';
alter table public.rugprint_alert_subscriptions add constraint rugprint_alert_subscriptions_plan_check check(plan in ('free','pro'));
create table if not exists public.rugprint_pro_payments(id uuid primary key default gen_random_uuid(),user_key text not null,signature text not null unique,payer_wallet text not null,treasury_wallet text not null,expected_sol numeric not null,received_sol numeric,status text not null default 'pending' check(status in ('pending','verified','rejected')),verified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.rugprint_pro_payments enable row level security;
create index if not exists rugprint_pro_payments_user_key_idx on public.rugprint_pro_payments(user_key,created_at desc);
notify pgrst,'reload schema';