alter table public.rugprint_backfill_queue add column if not exists priority integer not null default 0;
create index if not exists rugprint_backfill_queue_priority_idx on public.rugprint_backfill_queue(status,priority desc,updated_at asc);

insert into public.rugprint_launch_outcomes(launch_signature,creator_wallet,token_mint,outcome,evidence_confidence,creator_sell_signatures,evidence)
select l.signature,l.creator_wallet,l.token_mint,'unclassified',l.confidence,'{}'::text[],'[]'::jsonb
from public.rugprint_launch_observations l
left join public.rugprint_launch_outcomes o on o.launch_signature=l.signature
where o.launch_signature is null
on conflict(launch_signature) do nothing;

notify pgrst,'reload schema';
