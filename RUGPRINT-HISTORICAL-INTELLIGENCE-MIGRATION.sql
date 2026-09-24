create index if not exists rugprint_backfill_queue_status_updated_idx on public.rugprint_backfill_queue(status, updated_at);
create index if not exists rugprint_launch_observations_creator_idx on public.rugprint_launch_observations(creator_wallet, launched_at desc);
create index if not exists rugprint_scan_observations_creator_idx on public.rugprint_scan_observations(creator_wallet);
create index if not exists rugprint_relationship_evidence_wallet_a_idx on public.rugprint_relationship_evidence(wallet_a);
create index if not exists rugprint_relationship_evidence_wallet_b_idx on public.rugprint_relationship_evidence(wallet_b);
create index if not exists rugprint_transaction_wallets_wallet_idx on public.rugprint_transaction_wallets(wallet, block_time desc);
notify pgrst, 'reload schema';
