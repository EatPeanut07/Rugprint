create table if not exists rugprint_transaction_wallets (
  wallet text not null,
  signature text not null,
  block_time timestamptz,
  observed_at timestamptz not null default now(),
  primary key (wallet, signature)
);
create index if not exists rugprint_transaction_wallets_signature_idx on rugprint_transaction_wallets(signature);
alter table rugprint_transaction_wallets enable row level security;

create table if not exists rugprint_relationship_evidence (
  wallet_a text not null,
  wallet_b text not null,
  relationship_type text not null,
  signature text not null,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (wallet_a, wallet_b, relationship_type, signature)
);
create index if not exists rugprint_relationship_evidence_wallet_a_idx on rugprint_relationship_evidence(wallet_a);
create index if not exists rugprint_relationship_evidence_wallet_b_idx on rugprint_relationship_evidence(wallet_b);
alter table rugprint_relationship_evidence enable row level security;

update rugprint_alert_subscriptions
set plan='free'
where plan in ('trial','pro');
