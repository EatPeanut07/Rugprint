
create table if not exists rugprint_community_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text unique not null,
  subject_type text not null check (subject_type in ('x','pumpfun','fomo','wallet','contract')),
  subject_value text not null,
  explanation text not null,
  evidence_links jsonb not null default '[]'::jsonb,
  reporter_key text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','verified','rejected')),
  verified_evidence_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rugprint_community_subject_idx on rugprint_community_reports(subject_type,subject_value);
create index if not exists rugprint_community_status_idx on rugprint_community_reports(status);
alter table rugprint_community_reports enable row level security;
