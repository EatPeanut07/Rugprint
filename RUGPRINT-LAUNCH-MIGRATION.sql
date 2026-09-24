create table if not exists public.rugprint_telegram_link_tokens(id uuid primary key default gen_random_uuid(),token text not null unique,user_key text not null,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
alter table public.rugprint_telegram_link_tokens enable row level security;
create index if not exists rugprint_telegram_link_tokens_token_idx on public.rugprint_telegram_link_tokens(token) where used_at is null;
notify pgrst,'reload schema';
