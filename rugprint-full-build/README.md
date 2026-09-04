# RugPrint

**They can change the name. Not the footprint.**

RugPrint is an evidence-first Solana research tool for tracing token creator candidates, pre-launch funding, wallet relationships, holder concentration and other mint initialisations found in a creator wallet's sampled history.

It is intentionally **not** a "this person is a scammer" machine. Wallet clustering is probabilistic. A wallet can be an exchange, router, market maker, multisig, pool or program account. RugPrint therefore exposes its evidence and confidence level instead of converting uncertain relationships into accusations.

## What the first build already does

- Paste a Solana token contract address and scan it from the browser.
- Read mint supply, mint authority and freeze authority.
- Calculate top-1 / top-5 / top-10 token-account concentration.
- Walk backwards through mint-address signatures within a configurable safety cap.
- Use the earliest observed signer as a **creator candidate**, with an explicit coverage warning when the scan cannot prove it reached genesis.
- Inspect sampled creator-wallet transactions.
- Look for SOL funding into the creator candidate before/around earliest mint activity.
- Surface co-signing wallet relationships as lower-confidence links.
- Detect other SPL mint initialisations in sampled creator-wallet history.
- Generate a deterministic **Rug DNA** fingerprint and `RP-XXXXXXXX` cluster ID from the currently observed creator/funder/link pattern. The same evidence pattern yields the same ID; it is a clustering aid, not proof of common ownership.
- Produce an explainable 0–100 risk score.
- Link evidence to Solscan.
- Keep a separate manual social-evidence notebook for historical handles / public claims.
- Export a Markdown investigation report.
- Work without a wallet connection or private key.

## Architecture

- Next.js 16 App Router
- React 19
- TypeScript
- Server-side Solana JSON-RPC calls
- Optional Helius RPC/DAS enrichment
- No database required for the starter deployment

## Run locally

1. Install Node.js 22 or newer.
2. Clone this repository.
3. Copy `.env.example` to `.env.local`.
4. Add a Helius API key if you have one. It is strongly recommended for reliability.
5. Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

```bash
HELIUS_API_KEY=
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
RUGPRINT_MAX_SIGNATURE_PAGES=5
RUGPRINT_TX_SAMPLE=40
```

`HELIUS_API_KEY` stays server-side. Never expose it using a `NEXT_PUBLIC_` prefix.

## Deploy on Vercel

1. Push the repo to GitHub.
2. In Vercel, choose **Add New → Project** and import the RugPrint repository.
3. Add the environment variable `HELIUS_API_KEY`.
4. Deploy.

The API route is `POST /api/analyze` with JSON:

```json
{ "mint": "SOLANA_MINT_ADDRESS" }
```

Health check: `GET /api/health`.

## How the score works

The scoring code is deliberately readable in `lib/solana.ts`. Current signals include:

- active mint authority
- active freeze authority
- token-account concentration
- number / strength of creator-adjacent wallet relationships
- other mint initialisations found in sampled creator-wallet history

A high score means **the configured signals deserve investigation**. It does not establish fraud, intent, common ownership or criminal conduct.

## Important limitations

### "Creator candidate" is not identity

RugPrint starts from the earliest mint-address transaction it can reach and examines its signer. That wallet may be a deployer, launchpad, program-mediated actor or another participant. The UI deliberately says *candidate*.

### Public RPC history is bounded

`getSignaturesForAddress` is paginated and providers can rate-limit. `RUGPRINT_MAX_SIGNATURE_PAGES` prevents a single request from walking unlimited history. If the cap is hit, RugPrint tells the user that it may not have reached the true creation transaction.

### Holder concentration needs context

Large token accounts can be liquidity pools, program vaults or exchanges. Top-10 concentration is a factual account-level metric, not a claim that ten humans control the supply.

### X / social identities

RugPrint does not scrape X and does not infer a real-world identity from username changes. The Social Notebook intentionally stores analyst-supplied observations separately from chain evidence. A future social-history integration should use licensed/publicly lawful data sources and preserve source URLs + timestamps.

## High-value improvements to build next

- indexer-backed full mint genesis detection
- Pump.fun / launchpad-specific parsers
- AMM pool identification so liquidity accounts can be excluded from holder concentration
- token transfer flow graph and realised creator-cluster sell analysis
- exchange / bridge / router labels
- temporal wallet clustering and shared-funder graph traversal
- persistent investigations + signed evidence snapshots
- a public creator-cluster ID derived from evidence, with merge/split and appeal workflows
- social-history connectors using licensed APIs / archives
- claim-vs-chain checks with human-review gates
- API keys, rate limits and third-party bot/wallet integrations

## Responsible use

RugPrint is a blockchain research aid. Do not use its output to harass, threaten or dox people. Publish transaction evidence and methodology, distinguish observation from inference, and give subjects a way to challenge incorrect associations.

## License

Choose a license before public launch. MIT is simple and permissive; AGPL-3.0 is worth considering if you want hosted derivatives to keep server-side modifications open. This repository intentionally does not pick one for you.
