import { createHash } from "node:crypto";
import type { Confidence, CreatorLaunch, Evidence, HolderStats, ScanResult, TokenMeta, WalletLink } from "./types";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const LAMPORTS = 1_000_000_000;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
]);

function rpcUrl() {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`;
  return process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`RPC ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || "Solana RPC error");
  return body.result as T;
}

function isPubkey(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function pct(value: bigint, total: bigint) {
  if (total === 0n) return null;
  return Number((value * 1_000_000n) / total) / 10_000;
}

function label(score: number): ScanResult["risk"]["label"] {
  if (score >= 75) return "SEVERE";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "GUARDED";
  return "LOW";
}

function confidenceWeight(c: Confidence) {
  return c === "confirmed" ? 1 : c === "strong" ? 0.75 : c === "possible" ? 0.35 : 0;
}

type Sig = { signature: string; blockTime: number | null; err: unknown | null; slot: number };

type ParsedTx = {
  blockTime: number | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>;
      instructions: Array<any>;
    };
  };
  meta?: {
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: any[];
    postTokenBalances?: any[];
    innerInstructions?: Array<{ index: number; instructions: any[] }>;
  } | null;
};

function keyString(k: ParsedTx["transaction"]["message"]["accountKeys"][number]) {
  return typeof k === "string" ? k : k.pubkey;
}

async function getSignatures(address: string, pageLimit = 5) {
  const all: Sig[] = [];
  let before: string | undefined;
  for (let p = 0; p < pageLimit; p++) {
    const batch = await rpc<Sig[]>("getSignaturesForAddress", [address, { commitment: "confirmed", limit: 1000, ...(before ? { before } : {}) }]);
    all.push(...batch);
    if (batch.length < 1000) break;
    before = batch[batch.length - 1]?.signature;
    if (!before) break;
  }
  return all;
}

async function getTx(signature: string): Promise<ParsedTx | null> {
  return rpc<ParsedTx | null>("getTransaction", [signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
}

async function getTokenMeta(mint: string): Promise<TokenMeta> {
  const [supplyRes, accountRes] = await Promise.all([
    rpc<any>("getTokenSupply", [mint, { commitment: "confirmed" }]),
    rpc<any>("getAccountInfo", [mint, { commitment: "confirmed", encoding: "jsonParsed" }])
  ]);
  const parsed = accountRes?.value?.data?.parsed?.info || {};
  const decimals = Number(supplyRes?.value?.decimals ?? parsed?.decimals ?? 0);
  const amountRaw = BigInt(supplyRes?.value?.amount ?? "0");
  let name: string | null = null;
  let symbol: string | null = null;
  let image: string | null = null;

  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) {
    try {
      const asset = await rpc<any>("getAsset", { id: mint, displayOptions: { showFungible: true } });
      name = asset?.content?.metadata?.name ?? null;
      symbol = asset?.content?.metadata?.symbol ?? null;
      image = asset?.content?.links?.image ?? asset?.content?.files?.[0]?.uri ?? null;
    } catch {}
  }

  return {
    mint,
    name,
    symbol,
    image,
    decimals,
    supply: Number(amountRaw) / Math.pow(10, decimals),
    mintAuthority: parsed?.mintAuthority ?? null,
    freezeAuthority: parsed?.freezeAuthority ?? null
  };
}

async function getHolderStats(mint: string): Promise<HolderStats> {
  const [supplyRes, largestRes] = await Promise.all([
    rpc<any>("getTokenSupply", [mint, { commitment: "confirmed" }]),
    rpc<any>("getTokenLargestAccounts", [mint, { commitment: "confirmed" }])
  ]);
  const total = BigInt(supplyRes?.value?.amount ?? "0");
  const values: bigint[] = (largestRes?.value || []).map((x: any) => BigInt(x.amount || "0"));
  const sum = (n: number) => values.slice(0, n).reduce((a, b) => a + b, 0n);
  return {
    top1Pct: pct(sum(1), total),
    top5Pct: pct(sum(5), total),
    top10Pct: pct(sum(10), total),
    accountsChecked: values.length
  };
}

function parsedSystemTransfers(tx: ParsedTx) {
  const out: Array<{ from: string; to: string; lamports: number; signature: string }> = [];
  const sig = tx.transaction.signatures[0];
  const inspect = (ix: any) => {
    if (ix?.program === "system" && ix?.parsed?.type === "transfer") {
      const info = ix.parsed.info || {};
      if (info.source && info.destination && typeof info.lamports === "number") {
        out.push({ from: info.source, to: info.destination, lamports: info.lamports, signature: sig });
      }
    }
  };
  tx.transaction.message.instructions.forEach(inspect);
  tx.meta?.innerInstructions?.forEach(g => g.instructions.forEach(inspect));
  return out;
}

function parsedMintInitializations(tx: ParsedTx) {
  const mints: string[] = [];
  const inspect = (ix: any) => {
    const isToken = ix?.program === "spl-token" || TOKEN_PROGRAMS.has(ix?.programId);
    const type = ix?.parsed?.type;
    if (isToken && ["initializeMint", "initializeMint2"].includes(type)) {
      const mint = ix?.parsed?.info?.mint;
      if (mint && isPubkey(mint)) mints.push(mint);
    }
  };
  tx.transaction.message.instructions.forEach(inspect);
  tx.meta?.innerInstructions?.forEach(g => g.instructions.forEach(inspect));
  return [...new Set(mints)];
}

function signerWallets(tx: ParsedTx) {
  return tx.transaction.message.accountKeys
    .filter(k => typeof k !== "string" && k.signer)
    .map(k => keyString(k));
}

async function boundedMap<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function scoreRisk(meta: TokenMeta, holders: HolderStats, links: WalletLink[], previous: CreatorLaunch[]) {
  let score = 0;
  const reasons: string[] = [];

  if (meta.mintAuthority) { score += 12; reasons.push("Mint authority is still enabled"); }
  if (meta.freezeAuthority) { score += 8; reasons.push("Freeze authority is still enabled"); }
  if ((holders.top10Pct ?? 0) >= 70) { score += 25; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }
  else if ((holders.top10Pct ?? 0) >= 50) { score += 15; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }
  else if ((holders.top10Pct ?? 0) >= 30) { score += 7; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }

  const weightedLinks = links.reduce((a, l) => a + confidenceWeight(l.confidence), 0);
  if (weightedLinks >= 4) { score += 15; reasons.push("Multiple creator-adjacent wallet relationships were observed"); }
  else if (weightedLinks >= 2) { score += 8; reasons.push("Several creator-adjacent wallet relationships were observed"); }

  if (previous.length >= 5) { score += 25; reasons.push(`${previous.length} other mint initialisations were found around the creator wallet history`); }
  else if (previous.length >= 2) { score += 14; reasons.push(`${previous.length} other mint initialisations were found around the creator wallet history`); }
  else if (previous.length === 1) { score += 5; reasons.push("Another mint initialisation was found around the creator wallet history"); }

  score = Math.min(100, score);
  if (!reasons.length) reasons.push("No high-weight risk signal was confirmed in the bounded scan");
  return { score, label: label(score), reasons };
}

export async function analyzeMint(mint: string): Promise<ScanResult> {
  if (!isPubkey(mint)) throw new Error("That does not look like a valid Solana address.");

  const maxPages = Math.max(1, Math.min(10, Number(process.env.RUGPRINT_MAX_SIGNATURE_PAGES || 5)));
  const txSample = Math.max(10, Math.min(100, Number(process.env.RUGPRINT_TX_SAMPLE || 40)));
  const [meta, holders, sigs] = await Promise.all([getTokenMeta(mint), getHolderStats(mint), getSignatures(mint, maxPages)]);

  if (!sigs.length) throw new Error("No confirmed transactions were found for this address. Check the contract address and network.");

  const oldest = sigs[sigs.length - 1];
  const oldestTx = await getTx(oldest.signature);
  const creator = oldestTx ? (signerWallets(oldestTx)[0] || null) : null;
  const evidence: Evidence[] = [];
  const links: WalletLink[] = [];
  const previousLaunches: CreatorLaunch[] = [];
  let parsedCount = oldestTx ? 1 : 0;

  if (creator) {
    evidence.push({ id: "creator", title: "Earliest observed signer", detail: `${creator} signed the oldest mint-address transaction found inside this scan window. This is treated as a creator candidate, not proof of real-world identity.`, confidence: sigs.length < maxPages * 1000 ? "strong" : "possible", tx: oldest.signature, wallet: creator });
  }

  if (meta.mintAuthority) evidence.push({ id: "mintauth", title: "Mint authority active", detail: `The token mint currently reports ${meta.mintAuthority} as mint authority.`, confidence: "confirmed", wallet: meta.mintAuthority });
  else evidence.push({ id: "mintauth", title: "Mint authority revoked", detail: "The token mint currently has no mint authority.", confidence: "confirmed" });

  if (meta.freezeAuthority) evidence.push({ id: "freezeauth", title: "Freeze authority active", detail: `The token mint currently reports ${meta.freezeAuthority} as freeze authority.`, confidence: "confirmed", wallet: meta.freezeAuthority });
  else evidence.push({ id: "freezeauth", title: "Freeze authority revoked", detail: "The token mint currently has no freeze authority.", confidence: "confirmed" });

  if (holders.top10Pct != null) evidence.push({ id: "holders", title: "Holder concentration", detail: `The 10 largest token accounts hold ${holders.top10Pct.toFixed(2)}% of current supply. Token accounts may include pools, program vaults, or exchanges, so this is a concentration signal rather than proof of common ownership.`, confidence: "confirmed" });

  let fundingSource: string | null = null;
  let fundingSignature: string | null = null;

  if (creator) {
    const creatorSigs = (await getSignatures(creator, 1)).slice(0, txSample);
    const txs = await boundedMap(creatorSigs, 5, async s => {
      try { return await getTx(s.signature); } catch { return null; }
    });
    parsedCount += txs.filter(Boolean).length;

    const cutoff = oldest.blockTime ?? Number.MAX_SAFE_INTEGER;
    const priorTxs = txs.filter((tx): tx is ParsedTx => Boolean(tx && (tx.blockTime ?? 0) <= cutoff));
    let bestFunding: { from: string; to: string; lamports: number; signature: string; blockTime: number | null } | null = null;

    for (const tx of priorTxs) {
      for (const t of parsedSystemTransfers(tx)) {
        if (t.to === creator && t.from !== creator && t.from !== SYSTEM_PROGRAM) {
          const candidate = { ...t, blockTime: tx.blockTime };
          if (!bestFunding || (candidate.blockTime ?? 0) > (bestFunding.blockTime ?? 0)) bestFunding = candidate;
        }
      }
    }
    if (bestFunding) {
      fundingSource = bestFunding.from;
      fundingSignature = bestFunding.signature;
      const amount = bestFunding.lamports / LAMPORTS;
      links.push({ from: bestFunding.from, to: creator, reason: `Funded creator candidate with ${amount.toFixed(4)} SOL before/around the earliest observed mint activity`, confidence: "strong", tx: bestFunding.signature, amountSol: amount });
      evidence.push({ id: "funding", title: "Pre-launch funding link", detail: `${bestFunding.from} transferred ${amount.toFixed(4)} SOL to the creator candidate before/around the earliest observed mint activity.`, confidence: "strong", tx: bestFunding.signature, wallet: bestFunding.from });
    }

    const seenLaunches = new Map<string, number | null>();
    for (const tx of txs) {
      if (!tx) continue;
      for (const candidate of parsedMintInitializations(tx)) {
        if (candidate !== mint) seenLaunches.set(candidate, tx.blockTime);
      }
      const signers = signerWallets(tx).filter(w => w !== creator);
      for (const w of signers.slice(0, 3)) {
        if (!links.some(l => l.to === w || l.from === w)) links.push({ from: creator, to: w, reason: "Co-signed a transaction with the creator candidate", confidence: "possible", tx: tx.transaction.signatures[0] });
      }
    }
    for (const [otherMint, firstSeen] of [...seenLaunches.entries()].slice(0, 20)) {
      previousLaunches.push({ mint: otherMint, firstSeen, evidence: "Mint initialisation appeared in the sampled creator-wallet transaction history" });
    }
    if (previousLaunches.length) evidence.push({ id: "history", title: "Other mint initialisations", detail: `${previousLaunches.length} other token mint initialisation(s) appeared in the sampled creator-wallet history. This does not by itself mean those tokens rugged.`, confidence: "strong", wallet: creator });
  }

  const risk = scoreRisk(meta, holders, links, previousLaunches);
  const provider = process.env.HELIUS_API_KEY?.trim() ? "helius" : "solana-rpc";
  const notes = [
    "RugPrint reports observable relationships; it does not identify a real-world person from a wallet address.",
    "Holder concentration can include AMM pools, exchange wallets and program-owned accounts.",
    "Creator history is deliberately bounded to protect RPC limits; deeper indexer-backed history should be treated as a later enrichment, not silently assumed."
  ];
  if (sigs.length >= maxPages * 1000) notes.push("The mint hit the configured signature-page cap, so the earliest observed signer may not be the actual deployer.");
  if (!process.env.HELIUS_API_KEY?.trim()) notes.push("No Helius key is configured. Public Solana RPC may rate-limit scans and token metadata may be sparse.");

  const scanId = createHash("sha256").update(`${mint}:${Date.now()}`).digest("hex").slice(0, 12);
  const fingerprintBasis = [
    creator ? `creator:${creator}` : "creator:unknown",
    fundingSource ? `funder:${fundingSource}` : "funder:unknown",
    ...links.slice(0, 8).map(l => `link:${[l.from,l.to].sort().join(":")}:${l.confidence}`),
    `mintAuthority:${Boolean(meta.mintAuthority)}`,
    `freezeAuthority:${Boolean(meta.freezeAuthority)}`,
    `historyBucket:${Math.min(10, previousLaunches.length)}`
  ].sort();
  const dnaHash = createHash("sha256").update(fingerprintBasis.join("|")).digest("hex");
  const clusterId = `RP-${dnaHash.slice(0, 8).toUpperCase()}`;
  const rugDna = dnaHash.match(/.{1,4}/g)?.slice(0, 6).join("-").toUpperCase() || dnaHash.slice(0, 24).toUpperCase();
  return {
    scanId,
    generatedAt: new Date().toISOString(),
    network: "mainnet-beta",
    token: meta,
    fingerprint: { clusterId, rugDna, basis: fingerprintBasis },
    creator: { wallet: creator, creationSignature: oldest.signature, firstSeen: oldest.blockTime, fundingSource, fundingSignature },
    holders,
    links: links.slice(0, 25),
    previousLaunches,
    evidence,
    risk,
    coverage: { provider, signaturesInspected: sigs.length, transactionsParsed: parsedCount, notes }
  };
}
