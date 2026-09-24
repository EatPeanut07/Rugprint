RugPrint Core Intelligence Bundle

Upload these files preserving their paths. Replace existing files when GitHub asks:
- worker.mjs
- instrumentation.ts
- lib/intelligence-engine.ts
- lib/alert-store.ts
- lib/telegram.ts
- app/api/telegram/webhook/route.ts
- app/alerts/page.tsx

Do NOT upload RUGPRINT-CORE-MIGRATION.sql into the app as code. Run its contents once in Supabase SQL Editor.

This bundle:
- moves historical backfill out of the Next.js web process
- fixes the Helius API key query parameter
- improves backfill error visibility
- records wallet-to-transaction provenance
- stores relationship evidence separately
- fixes intelligence stats counting
- records actual pages processed
- removes Trial/Pro alert quotas and Pro Telegram/UI wording
- keeps community reports and identity evidence separate from verified on-chain findings
