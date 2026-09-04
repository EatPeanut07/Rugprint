# RugPrint rate-limit patch

This patch addresses Helius/Solana RPC `429 Too Many Requests` failures by:

- pacing RPC request starts instead of bursting them;
- retrying 429/5xx responses with exponential backoff and jitter;
- honouring `Retry-After` where supplied;
- de-duplicating transaction lookups during one server instance;
- reusing signature-history lookups;
- reducing default deep-scan sample sizes while retaining creator/funder/early-wallet analysis;
- caching completed token reports for five minutes on a warm Vercel instance;
- returning a friendly temporary-provider message instead of a raw RPC error if retries are exhausted.

No new environment variable is required. Existing `HELIUS_API_KEY` continues to work.
