RUGPRINT INTELLIGENCE ENGINE

1. Run INTELLIGENCE-ENGINE-SCHEMA.sql in Supabase first.
2. Add a long random RUGPRINT_ADMIN_SECRET variable in Railway.
3. Upload the remaining files preserving their folders and deploy.
4. Open /intelligence to check counters.
5. Seed known creator/deployer wallets with POST /api/intelligence/backfill using Authorization: Bearer <RUGPRINT_ADMIN_SECRET>.
6. The service processes bounded historical batches every 10 minutes.

IMPORTANT
A transfer, swap or launch is not fraud. An observed wallet relationship is not proof of shared ownership. This release deliberately stores those as evidence signals and does not auto-merge identities or auto-label counterparties as ruggers.

NEXT: evidence review/identity promotion + meaningful intelligence alerts. News comes after core intelligence is proven.