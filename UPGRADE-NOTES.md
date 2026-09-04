# RugPrint Creator Intelligence Upgrade

This build replaces the original low-confidence scoring behavior with an evidence-first creator investigation flow.

## What changed

- Finds a mint-initialisation transaction among the oldest token activity instead of blindly treating the oldest signer as the creator.
- Detects a Pump.fun creation footprint when the known Pump.fun program is present.
- Traces incoming SOL to the creator candidate before/around launch.
- Samples creator history across old, recent and evenly-spaced transactions instead of only reading the newest transactions.
- Searches sampled creator history for other mint initialisations.
- Inspects the oldest token transactions for early token recipients.
- Checks a bounded set of early wallets for pre-launch funding provenance.
- Flags when early wallets and the creator candidate share an observed funding source.
- Separates `risk score` from `data confidence`.
- Returns `UNRESOLVED` rather than a reassuring low score when creator/funding/history evidence is too incomplete.
- Adds Early Wallets and Social Evidence tabs.
- Keeps social handles/claims as analyst-supplied evidence rather than claiming real-world identity automatically.

## Important limits

RugPrint still performs a bounded live scan. It is not yet a persistent blockchain indexer. A missing previous launch or missing wallet relationship means "not found in this scan", not "does not exist".

For production-scale creator history, the next architectural step is a persistent database/indexer that continuously stores launches, funding edges, wallet clusters and historical results. The UI and result types in this build are structured to support that later.
