
create table if not exists rugprint_watch_state (
  watch_id uuid primary key references rugprint_alert_watches(id) on delete cascade,
  last_signature text,
  last_checked_at timestamptz,
  baseline_ready boolean not null default false,
  last_error text,
  updated_at timestamptz not null default now()
);
create index if not exists rugprint_watch_state_checked_idx on rugprint_watch_state(last_checked_at);
alter table rugprint_watch_state enable row level security;
