create table if not exists public.rugprint_launch_outcomes(
id uuid primary key default gen_random_uuid(),
launch_signature text not null unique,
creator_wallet text not null,
token_mint text,
outcome text not null default 'unclassified' check(outcome in ('unclassified','active','failed','adverse','rug_like')),
evidence_confidence integer not null default 0 check(evidence_confidence between 0 and 100),
creator_sell_signatures text[] not null default '{}',
evidence jsonb not null default '[]'::jsonb,
assessed_at timestamptz,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now());
alter table public.rugprint_launch_outcomes enable row level security;
create index if not exists rugprint_launch_outcomes_creator_idx on public.rugprint_launch_outcomes(creator_wallet,outcome);
notify pgrst,'reload schema';