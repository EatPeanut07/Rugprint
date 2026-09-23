# RugPrint Scanner Max Upgrade

Upload the CONTENTS of this ZIP to the root of `EatPeanut07/Rugprint` and overwrite matching files.

## Replaces
- `lib/solana.ts`
- `app/api/health/route.ts`

## Included
- Helius automatically becomes the primary Solana RPC when `HELIUS_API_KEY` exists.
- Automatic retry/backoff for HTTP 429 and provider 5xx responses.
- Honors provider retry conditions with bounded retries.
- Short-lived in-memory RPC cache to avoid duplicate calls.
- Lower, bounded transaction concurrency to reduce burst rate limiting.
- Reduced signature page sizes and bounded creator-history sampling.
- Human-readable provider errors instead of raw 429 dumps.
- Health endpoint reports Helius/retry/cache state.
- Existing Supabase scan persistence remains intact.
- Existing creator identity/history and alert foundations remain intact.

## Pump.fun
The repo already has the provider-adapter boundary from the previous foundation update.
Pump.fun's current profile endpoints appear to require authenticated/internal request context.
This update intentionally does not embed an undocumented Pump.fun bearer token or scrape credentials.
We will integrate a verified creator-data source behind the adapter rather than commit fragile credentials.

## After deploy
1. Open `/api/health`
2. Confirm `provider` is `helius` and `scanner.heliusConfigured` is true.
3. Scan a Solana token contract again.
4. A successful scan should return `persistence.recorded: true`.
