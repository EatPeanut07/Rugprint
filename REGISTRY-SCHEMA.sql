-- RugPrint persistent creator registry for Supabase/Postgres.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists rugprint_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_id text unique not null,
  status text not null default 'observed' check (status in ('observed','elevated','high','confirmed_adverse')),
  headline text,
  confidence integer not null default 0 check (confidence between 0 and 100),
  linked_launches integer not null default 0,
  adverse_events integer not null default 0,
  associated_wallets integer not null default 0,
  estimated_creator_exit_usd numeric,
  first_seen timestamptz,
  last_seen timestamptz,
  aliases jsonb not null default '[]'::jsonb,
  wallets jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 0,
  appeal_status text not null default 'none' check (appeal_status in ('none','open','resolved')),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists rugprint_scan_observations (
  id uuid primary key default gen_random_uuid(),
  scan_id text unique not null,
  token_mint text not null,
  cluster_hint text,
  creator_wallet text,
  funding_source text,
  risk_label text,
  risk_score integer,
  data_confidence integer,
  previous_launches integer not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists rugprint_evidence_events (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references rugprint_clusters(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text not null,
  confidence integer not null check (confidence between 0 and 100),
  source_url text,
  tx_signature text,
  wallet text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists rugprint_appeals (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references rugprint_clusters(id) on delete cascade,
  contact text,
  statement text not null,
  status text not null default 'open' check (status in ('open','reviewing','accepted','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace view rugprint_public_clusters as
select id, cluster_id, status, headline, confidence, linked_launches, adverse_events,
       associated_wallets, estimated_creator_exit_usd, first_seen, last_seen,
       aliases, wallets, evidence_count, appeal_status, updated_at
from rugprint_clusters
where is_public = true and status in ('elevated','high','confirmed_adverse');

alter table rugprint_clusters enable row level security;
alter table rugprint_scan_observations enable row level security;
alter table rugprint_evidence_events enable row level security;
alter table rugprint_appeals enable row level security;

-- No anonymous write policies are created. RugPrint server writes with the Supabase service role.
