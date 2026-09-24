RUGPRINT HISTORICAL INTELLIGENCE RELEASE

Upload these files to the same paths in GitHub, replacing existing files where applicable.

WHAT THIS RELEASE DOES
- Seeds backfill automatically from RugPrint's existing launch, scan and community evidence.
- Uses Helius enhanced transaction source/type/fee-payer data to improve creator candidate detection.
- Automatically queues creator fee-payers discovered in launch-like transactions.
- Expands only one relationship hop and only when there are at least two independent transaction signatures.
- Raises worker throughput from 3 wallets x 2 pages to 5 wallets x 3 pages per cycle.
- Adds queue-state visibility to intelligence stats.
- Adds a protected /api/intelligence/discover endpoint.
- Keeps all classifications evidence-first. A launch/transfer/swap is not proof of fraud.

Do NOT paste the SQL migration manually. ChatGPT will apply it through Supabase after GitHub upload.
