# RugPrint Creator Registry upgrade

This upgrade adds a persistent creator-registry architecture, alias-resistant lookup and a public evidence-led risk index.

## What is new
- `/registry` public catalogue and Top 10 Risk Index.
- Search by alias, wallet or `RP-...` cluster ID.
- Username similarity engine catches small edits, separators, trailing digits and common lookalike characters.
- Similarity alone never creates a high-risk record.
- Scan observations can be stored server-side for future cluster review.
- Supabase schema for clusters, observations, evidence events and appeals.
- Public registry starts empty until reviewed records are intentionally published.

## Vercel environment variables
Add these after creating a Supabase project:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep the service-role key server-side. Never prefix it with `NEXT_PUBLIC_`.

## Supabase setup
Open Supabase -> SQL Editor -> New query. Paste the full contents of `REGISTRY-SCHEMA.sql` and run it once.

## Publication rule
Do not set `is_public=true` for a cluster solely because of a username match or scanner risk score. A reviewed evidence trail should support the association and adverse-event classification.
