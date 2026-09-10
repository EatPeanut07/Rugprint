# Autonomous Memecoin Studio V5

V5 is the consolidated intelligence build. It is designed so ordinary source setup happens with Railway Variables instead of another GitHub rewrite.

## Automatic now
- DEX Screener Solana discovery
- token profiles and recent updates
- community takeovers, boosts, and trending metas
- pair enrichment and quality filters
- autonomous Solana wallet discovery from tokens the Scout finds
- parsed transaction signer and fee-payer extraction
- cross-token wallet history
- repeat-wallet statistics
- wallet co-occurrence graph and cluster review signals
- source-health monitoring
- public Reddit trend intelligence
- Creator Agent
- Wallet Reputation Agent
- evidence-based blacklist database and appeal workflow
- social draft queue
- treasury proposal layer
- financial kill switch
- audit logging

## Ready by Railway Variables, no code rewrite needed
- custom Solana RPC provider
- X recent-search intelligence
- Telegram private-channel intelligence
- scan intervals and quality thresholds

## Deliberately not inside this web app
- seed phrases or private keys
- unrestricted transaction signer
- autonomous trading
- real token deployment
- real on-chain wallet blocking

Those belong in separate security-reviewed components. A public web process that reads arbitrary social content should not possess the keys to treasury funds.

## Wallet reputation rule
Automatic wallet discovery creates review signals, not accusations. A wallet can be a normal trader, bot, router, service, creator, or other participant. Ordinary buying or selling is never wrongdoing by itself. Restriction requires corroborating documented evidence, high confidence, low false-positive risk, and human-admin approval.

## Existing Railway variables
Keep:
- `ADMIN_TOKEN=<your existing secret>`
- `SIMULATION_ONLY=true`

## Automatic defaults
- `DEXSCREENER_ENABLED=true`
- `DEX_SCAN_SECONDS=300`
- `DEX_MIN_LIQUIDITY_USD=10000`
- `DEX_MIN_VOLUME_H24_USD=25000`
- `DEX_MIN_TXNS_H24=100`
- `SOLANA_DISCOVERY_ENABLED=true`
- `SOLANA_DISCOVERY_SECONDS=180`
- `SOLANA_MAX_TOKENS_PER_SCAN=8`
- `SOLANA_SIGNATURES_PER_TOKEN=20`
- `SOLANA_MAX_TX_FETCHES_PER_SCAN=40`
- `REDDIT_ENABLED=true`

## Optional later
- `SOLANA_RPC_URL=<dedicated RPC endpoint>`
- `X_ENABLED=true`
- `X_BEARER_TOKEN=<Railway secret only>`
- `X_SEARCH_QUERY=(solana OR memecoin OR meme coin) -is:retweet lang:en`
- `TELEGRAM_ENABLED=true`
- `TELEGRAM_API_ID=<Railway secret only>`
- `TELEGRAM_API_HASH=<Railway secret only>`
- `TELEGRAM_SESSION=<Railway secret only>`
- `TELEGRAM_CHANNELS=Channel One|Channel Two`

Never put credentials, API tokens, session strings, seed phrases, or private keys in GitHub or chat.
