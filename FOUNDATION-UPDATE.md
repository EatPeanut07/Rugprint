# RugPrint foundation max update

This bundle replaces/adds the files needed for the next development phase.

## Included now
- Uses `SUPABASE_SECRET_KEY`, with legacy service-role fallback.
- `/api/health` performs a real server-side Supabase connection + schema check.
- `/api/analyze` now persists successful scan observations into Supabase.
- Creator identity upsert helper is ready for Pump.fun, Fomo and X.
- Username history is automatically recorded when an identity is upserted.
- Alert allowance helper retains the 3-alert trial / unlimited Pro model.
- Creator-platform normalization/adaptor boundary is ready for provider integrations.
- No secret values are included in this ZIP.
- Public direct registry writes remain disabled.

## Why Pump.fun/Fomo network calls are not hard-coded in this bundle
Those external endpoints must be verified before production use. The storage and identity layer is ready so the provider can be plugged in without another database redesign.

## Upload
Upload the CONTENTS of this ZIP to the ROOT of `EatPeanut07/Rugprint`.
Preserve the folders exactly. Choose replace/overwrite for existing files.

Files that replace existing repo files:
- `lib/registry.ts`
- `lib/alerts.ts`
- `app/api/health/route.ts`
- `app/api/analyze/route.ts`

New file:
- `lib/creator-platforms.ts`

After committing, Railway should automatically deploy.
Then open `/api/health`. A healthy setup should return HTTP 200 with:
`database.configured=true`, `database.reachable=true`, `database.schemaReady=true`.
