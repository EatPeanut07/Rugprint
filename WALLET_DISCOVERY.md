# Autonomous Wallet Discovery

No manually maintained wallet list is required.

Flow:
1. DEX Scout discovers a Solana token.
2. The token is stored in `discovered_tokens`.
3. Wallet Discovery requests recent signatures involving that mint from Solana RPC.
4. It fetches parsed transactions.
5. It extracts signers and fee payers.
6. It stores wallet/token history.
7. It compares wallets across multiple discovered tokens.
8. It builds wallet co-occurrence edges.
9. It generates repeat and cluster review signals.

The score is not proof of misconduct. Participation alone is not grounds for restriction.
