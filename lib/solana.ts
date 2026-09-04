import { createHash } from "node:crypto";
import type { Confidence, CreatorLaunch, EarlyWallet, Evidence, HolderStats, ScanResult, TokenMeta, WalletLink } from "./types";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const LAMPORTS = 1_000_000_000;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
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

function riskLabel(score: number): Exclude<ScanResult["risk"]["label"], "UNRESOLVED"> {
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

function txSignature(tx: ParsedTx) { return tx.transaction.signatures[0] || ""; }

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

  if (process.env.HELIUS_API_KEY?.trim()) {
    try {
      const asset = await rpc<any>("getAsset", { id: mint, displayOptions: { showFungible: true } });
      name = asset?.content?.metadata?.name ?? null;
      symbol = asset?.content?.metadata?.symbol ?? null;
      image = asset?.content?.links?.image ?? asset?.content?.files?.[0]?.uri ?? null;
    } catch {}
  }

  return {
    mint, name, symbol, image, decimals,
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
  return { top1Pct: pct(sum(1), total), top5Pct: pct(sum(5), total), top10Pct: pct(sum(10), total), accountsChecked: values.length };
}

function allInstructions(tx: ParsedTx) {
  const outer = tx.transaction.message.instructions || [];
  const inner = tx.meta?.innerInstructions?.flatMap(g => g.instructions || []) || [];
  return [...outer, ...inner];
}

function programIds(tx: ParsedTx) {
  return new Set(allInstructions(tx).map((ix: any) => ix?.programId || ix?.programIdIndex).filter((v: any) => typeof v === "string"));
}

function parsedSystemTransfers(tx: ParsedTx) {
  const out: Array<{ from: string; to: string; lamports: number; signature: string }> = [];
  for (const ix of allInstructions(tx)) {
    if (ix?.program === "system" && ix?.parsed?.type === "transfer") {
      const info = ix.parsed.info || {};
      if (info.source && info.destination && typeof info.lamports === "number") {
        out.push({ from: info.source, to: info.destination, lamports: info.lamports, signature: txSignature(tx) });
      }
    }
  }
  return out;
}

function parsedMintInitializations(tx: ParsedTx) {
  const mints: string[] = [];
  for (const ix of allInstructions(tx)) {
    const isToken = ix?.program === "spl-token" || TOKEN_PROGRAMS.has(ix?.programId);
    const type = ix?.parsed?.type;
    if (isToken && ["initializeMint", "initializeMint2"].includes(type)) {
      const mint = ix?.parsed?.info?.mint;
      if (mint && isPubkey(mint)) mints.push(mint);
    }
  }
  return [...new Set(mints)];
}

function signerWallets(tx: ParsedTx) {
  return tx.transaction.message.accountKeys
    .filter(k => typeof k !== "string" && k.signer)
    .map(k => keyString(k));
}

function tokenOwnerDeltas(tx: ParsedTx, mint: string) {
  const deltas = new Map<string, number>();
  const before = new Map<string, number>();
  for (const b of tx.meta?.preTokenBalances || []) {
    if (b?.mint !== mint || !b?.owner) continue;
    before.set(b.owner, Number(b?.uiTokenAmount?.uiAmountString ?? b?.uiTokenAmount?.uiAmount ?? 0));
  }
  const after = new Map<string, number>();
  for (const b of tx.meta?.postTokenBalances || []) {
    if (b?.mint !== mint || !b?.owner) continue;
    after.set(b.owner, Number(b?.uiTokenAmount?.uiAmountString ?? b?.uiTokenAmount?.uiAmount ?? 0));
  }
  for (const owner of new Set([...before.keys(), ...after.keys()])) deltas.set(owner, (after.get(owner) || 0) - (before.get(owner) || 0));
  return deltas;
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

function strategicSample<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const head = Math.floor(max * 0.35);
  const tail = Math.floor(max * 0.35);
  const middle = max - head - tail;
  const picked: T[] = [...items.slice(0, head)];
  const start = head;
  const end = items.length - tail;
  const span = Math.max(1, end - start);
  for (let i = 0; i < middle; i++) picked.push(items[start + Math.floor((i * span) / Math.max(1, middle))]);
  picked.push(...items.slice(items.length - tail));
  return picked.filter(Boolean);
}

async function findFundingBefore(wallet: string, cutoff: number | null, pageLimit = 2, txLimit = 90) {
  const sigs = await getSignatures(wallet, pageLimit);
  const eligible = cutoff == null ? sigs : sigs.filter(s => (s.blockTime ?? 0) <= cutoff);
  // Signatures are newest-first. Transactions nearest to cutoff are the most useful for funding provenance.
  const chosen = eligible.slice(0, txLimit);
  const txs = await boundedMap(chosen, 6, async s => { try { return await getTx(s.signature); } catch { return null; } });
  let best: { from: string; to: string; lamports: number; signature: string; blockTime: number | null } | null = null;
  for (const tx of txs) {
    if (!tx) continue;
    for (const t of parsedSystemTransfers(tx)) {
      if (t.to === wallet && t.from !== wallet && t.from !== SYSTEM_PROGRAM) {
        const candidate = { ...t, blockTime: tx.blockTime };
        if (!best || (candidate.blockTime ?? 0) > (best.blockTime ?? 0)) best = candidate;
      }
    }
  }
  return { transfer: best, signatures: sigs.length, parsed: txs.filter(Boolean).length };
}

function scoreRisk(meta: TokenMeta, holders: HolderStats, links: WalletLink[], previous: CreatorLaunch[], creator: string | null, funder: string | null, earlyWallets: EarlyWallet[], creationConfidence: Confidence) {
  let score = 0;
  const reasons: string[] = [];
  const unknowns: string[] = [];

  if (meta.mintAuthority) { score += 12; reasons.push("Mint authority is still enabled"); }
  if (meta.freezeAuthority) { score += 8; reasons.push("Freeze authority is still enabled"); }
  if ((holders.top10Pct ?? 0) >= 70) { score += 25; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }
  else if ((holders.top10Pct ?? 0) >= 50) { score += 15; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }
  else if ((holders.top10Pct ?? 0) >= 30) { score += 7; reasons.push(`Top 10 token accounts hold ${holders.top10Pct?.toFixed(1)}% of supply`); }

  const sharedFunder = earlyWallets.filter(w => w.sharedCreatorFunder).length;
  if (sharedFunder >= 3) { score += 24; reasons.push(`${sharedFunder} early wallets share the creator candidate's funding source`); }
  else if (sharedFunder >= 1) { score += 10; reasons.push(`${sharedFunder} early wallet shares the creator candidate's funding source`); }

  const outflows = links.filter(l => l.kind === "token-outflow").length;
  if (outflows >= 2) { score += 18; reasons.push("Token outflows were observed from multiple creator-adjacent wallets in the early transaction window"); }
  else if (outflows === 1) { score += 8; reasons.push("A token outflow was observed from a creator-adjacent wallet in the early transaction window"); }

  const weightedLinks = links.reduce((a, l) => a + confidenceWeight(l.confidence), 0);
  if (weightedLinks >= 5) { score += 12; reasons.push("Multiple creator-adjacent wallet relationships were observed"); }
  else if (weightedLinks >= 2.5) { score += 6; reasons.push("Several creator-adjacent wallet relationships were observed"); }

  if (previous.length >= 5) { score += 25; reasons.push(`${previous.length} other mint initialisations were found in sampled creator history`); }
  else if (previous.length >= 2) { score += 14; reasons.push(`${previous.length} other mint initialisations were found in sampled creator history`); }
  else if (previous.length === 1) { score += 5; reasons.push("Another mint initialisation was found in sampled creator history"); }

  if (!creator) unknowns.push("Creator wallet not resolved");
  if (creationConfidence === "possible" || creationConfidence === "unknown") unknowns.push("Launch transaction attribution is incomplete");
  if (!funder) unknowns.push("Creator funding source not resolved");
  if (!previous.length) unknowns.push("Creator launch history not established");
  if (!earlyWallets.length) unknowns.push("Early-wallet clustering not established");

  let dataConfidence = 20;
  if (creator) dataConfidence += creationConfidence === "confirmed" ? 25 : creationConfidence === "strong" ? 20 : 10;
  if (funder) dataConfidence += 18;
  if (earlyWallets.length >= 3) dataConfidence += 15;
  else if (earlyWallets.length) dataConfidence += 8;
  if (previous.length) dataConfidence += 12;
  if (holders.accountsChecked >= 10) dataConfidence += 10;
  dataConfidence = Math.min(100, dataConfidence);

  score = Math.min(100, score);
  const unresolved = !creator || dataConfidence < 55 || (!funder && previous.length === 0);
  if (unresolved) {
    if (!reasons.length) reasons.push("No high-weight risk signal was confirmed, but creator intelligence is incomplete");
    return { score: null, label: "UNRESOLVED" as const, reasons, dataConfidence, unknowns };
  }
  if (!reasons.length) reasons.push("No high-weight risk signal was confirmed in the available evidence");
  return { score, label: riskLabel(score), reasons, dataConfidence, unknowns };
}

export async function analyzeMint(mint: string): Promise<ScanResult> {
  if (!isPubkey(mint)) throw new Error("That does not look like a valid Solana address.");

  const maxPages = Math.max(1, Math.min(10, Number(process.env.RUGPRINT_MAX_SIGNATURE_PAGES || 5)));
  const creatorPages = Math.max(1, Math.min(5, Number(process.env.RUGPRINT_CREATOR_SIGNATURE_PAGES || 3)));
  const historyTxSample = Math.max(60, Math.min(300, Number(process.env.RUGPRINT_HISTORY_TX_SAMPLE || 75)));
  const earlyTxSample = Math.max(15, Math.min(80, Number(process.env.RUGPRINT_EARLY_TX_SAMPLE || 20)));

  const [meta, holders, sigs] = await Promise.all([getTokenMeta(mint), getHolderStats(mint), getSignatures(mint, maxPages)]);
  if (!sigs.length) throw new Error("No confirmed transactions were found for this address. Check the contract address and network.");

  const evidence: Evidence[] = [];
  const links: WalletLink[] = [];
  const previousLaunches: CreatorLaunch[] = [];
  const earlyWallets: EarlyWallet[] = [];
  let parsedCount = 0;

  // Search the oldest mint-address activity for a transaction that actually initialises this mint.
  const oldestCandidates = sigs.slice(-Math.min(30, sigs.length)).reverse();
  const oldestTxs = await boundedMap(oldestCandidates, 6, async s => { try { return await getTx(s.signature); } catch { return null; } });
  parsedCount += oldestTxs.filter(Boolean).length;

  let creationTx: ParsedTx | null = null;
  let creationSig: Sig | null = null;
  for (let i = 0; i < oldestTxs.length; i++) {
    const tx = oldestTxs[i];
    if (tx && parsedMintInitializations(tx).includes(mint)) { creationTx = tx; creationSig = oldestCandidates[i]; break; }
  }
  if (!creationTx) {
    creationTx = oldestTxs[0] || null;
    creationSig = oldestCandidates[0] || sigs[sigs.length - 1];
  }

  const launchPrograms = creationTx ? programIds(creationTx) : new Set<string>();
  const platform: ScanResult["launch"]["platform"] = launchPrograms.has(PUMP_FUN_PROGRAM) || mint.endsWith("pump") ? "pump.fun" : "unknown";
  const initializationConfirmed = Boolean(creationTx && parsedMintInitializations(creationTx).includes(mint));
  const creationConfidence: Confidence = initializationConfirmed ? "confirmed" : creationTx ? "possible" : "unknown";
  const creator = creationTx ? (signerWallets(creationTx)[0] || null) : null;

  if (creator && creationSig) {
    evidence.push({
      id: "creator",
      title: initializationConfirmed ? "Launch transaction signer" : "Earliest observed signer",
      detail: initializationConfirmed
        ? `${creator} signed the transaction in which RugPrint observed this mint being initialised. This establishes an on-chain creator candidate, not a real-world identity.`
        : `${creator} signed the oldest mint-address transaction RugPrint could resolve. The mint initialisation itself was not decoded, so attribution remains tentative.`,
      confidence: creationConfidence,
      tx: creationSig.signature,
      wallet: creator
    });
  }

  if (platform === "pump.fun" && creationSig) evidence.push({ id: "launchpad", title: "Pump.fun launch footprint", detail: `The creation transaction references the Pump.fun program or the mint follows the Pump.fun address convention.`, confidence: initializationConfirmed && launchPrograms.has(PUMP_FUN_PROGRAM) ? "confirmed" : "strong", tx: creationSig.signature });

  if (meta.mintAuthority) evidence.push({ id: "mintauth", title: "Mint authority active", detail: `The token mint currently reports ${meta.mintAuthority} as mint authority.`, confidence: "confirmed", wallet: meta.mintAuthority });
  else evidence.push({ id: "mintauth", title: "Mint authority revoked", detail: "The token mint currently has no mint authority.", confidence: "confirmed" });
  if (meta.freezeAuthority) evidence.push({ id: "freezeauth", title: "Freeze authority active", detail: `The token mint currently reports ${meta.freezeAuthority} as freeze authority.`, confidence: "confirmed", wallet: meta.freezeAuthority });
  else evidence.push({ id: "freezeauth", title: "Freeze authority revoked", detail: "The token mint currently has no freeze authority.", confidence: "confirmed" });
  if (holders.top10Pct != null) evidence.push({ id: "holders", title: "Holder concentration", detail: `The 10 largest token accounts hold ${holders.top10Pct.toFixed(2)}% of current supply. Pools, vaults and exchanges can appear here, so concentration is a signal rather than proof of common ownership.`, confidence: "confirmed" });

  let fundingSource: string | null = null;
  let fundingSignature: string | null = null;
  let creatorSignaturesInspected = 0;

  if (creator) {
    const funding = await findFundingBefore(creator, creationSig?.blockTime ?? null, creatorPages, 45);
    creatorSignaturesInspected = funding.signatures;
    parsedCount += funding.parsed;
    if (funding.transfer) {
      fundingSource = funding.transfer.from;
      fundingSignature = funding.transfer.signature;
      const amount = funding.transfer.lamports / LAMPORTS;
      links.push({ from: fundingSource, to: creator, reason: `Funded creator candidate with ${amount.toFixed(4)} SOL before/around launch`, confidence: "strong", tx: fundingSignature, amountSol: amount, kind: "funding" });
      evidence.push({ id: "funding", title: "Pre-launch funding link", detail: `${fundingSource} transferred ${amount.toFixed(4)} SOL to the creator candidate before/around launch.`, confidence: "strong", tx: fundingSignature, wallet: fundingSource });
    }

    // Sample creator history across old, recent and evenly-spaced activity rather than only the newest transactions.
    const creatorSigs = await getSignatures(creator, creatorPages);
    creatorSignaturesInspected = Math.max(creatorSignaturesInspected, creatorSigs.length);
    const sampled = strategicSample(creatorSigs, historyTxSample);
    const historyTxs = await boundedMap(sampled, 7, async s => { try { return await getTx(s.signature); } catch { return null; } });
    parsedCount += historyTxs.filter(Boolean).length;
    const launchMap = new Map<string, CreatorLaunch>();
    for (const tx of historyTxs) {
      if (!tx) continue;
      for (const otherMint of parsedMintInitializations(tx)) {
        if (otherMint === mint) continue;
        launchMap.set(otherMint, { mint: otherMint, firstSeen: tx.blockTime, signature: txSignature(tx), evidence: "Mint initialisation appeared in strategically sampled creator-wallet history" });
      }
      for (const w of signerWallets(tx).filter(w => w !== creator).slice(0, 2)) {
        if (!links.some(l => l.kind === "co-signer" && (l.to === w || l.from === w))) links.push({ from: creator, to: w, reason: "Co-signed a sampled transaction with the creator candidate", confidence: "possible", tx: txSignature(tx), kind: "co-signer" });
      }
    }
    previousLaunches.push(...[...launchMap.values()].sort((a,b)=>(b.firstSeen||0)-(a.firstSeen||0)).slice(0,30));
    if (previousLaunches.length) evidence.push({ id: "history", title: "Other mint initialisations", detail: `${previousLaunches.length} other token mint initialisation(s) appeared in sampled creator-wallet history. This is launch-history evidence, not evidence those projects rugged.`, confidence: "strong", wallet: creator });
  }

  // Inspect the oldest token transactions for early participants and creator-adjacent token outflows.
  const earlySigs = sigs.slice(-Math.min(earlyTxSample, sigs.length)).reverse();
  const earlyTxs = await boundedMap(earlySigs, 7, async s => { try { return await getTx(s.signature); } catch { return null; } });
  parsedCount += earlyTxs.filter(Boolean).length;
  const earlyMap = new Map<string, { firstSeen: number | null; signature: string; tokenDelta: number }>();
  for (const tx of earlyTxs) {
    if (!tx) continue;
    const deltas = tokenOwnerDeltas(tx, mint);
    for (const [wallet, delta] of deltas.entries()) {
      if (!isPubkey(wallet) || wallet === creator || delta <= 0) continue;
      const existing = earlyMap.get(wallet);
      if (!existing) earlyMap.set(wallet, { firstSeen: tx.blockTime, signature: txSignature(tx), tokenDelta: delta });
      else existing.tokenDelta += delta;
    }
    if (creator && (deltas.get(creator) || 0) < 0) {
      links.push({ from: creator, to: mint, reason: `Creator candidate token balance decreased by ${Math.abs(deltas.get(creator) || 0).toLocaleString()} tokens in an early transaction`, confidence: "strong", tx: txSignature(tx), kind: "token-outflow" });
    }
  }

  const earlyCandidates = [...earlyMap.entries()].sort((a,b)=>b[1].tokenDelta-a[1].tokenDelta).slice(0,4);
  const launchCutoff = creationSig?.blockTime ?? null;
  const earlyFunding = await boundedMap(earlyCandidates, 3, async ([wallet, info]) => {
    const f = await findFundingBefore(wallet, launchCutoff, 1, 18).catch(() => ({ transfer: null, signatures: 0, parsed: 0 }));
    parsedCount += f.parsed;
    return { wallet, info, f };
  });
  for (const row of earlyFunding) {
    const funder = row.f.transfer?.from || null;
    const shared = Boolean(funder && fundingSource && funder === fundingSource);
    const item: EarlyWallet = { wallet: row.wallet, firstSeen: row.info.firstSeen, signature: row.info.signature, tokenDelta: row.info.tokenDelta, fundingSource: funder, fundingSignature: row.f.transfer?.signature || null, sharedCreatorFunder: shared };
    earlyWallets.push(item);
    links.push({ from: creator || mint, to: row.wallet, reason: `Early wallet received a positive token balance change of ${Math.round(row.info.tokenDelta).toLocaleString()} tokens`, confidence: "possible", tx: row.info.signature, kind: "early-wallet" });
    if (shared && funder) {
      links.push({ from: funder, to: row.wallet, reason: "This early wallet and the creator candidate share the same observed pre-launch funding source", confidence: "strong", tx: row.f.transfer?.signature, kind: "shared-funder" });
    }
  }
  const sharedCount = earlyWallets.filter(w => w.sharedCreatorFunder).length;
  if (sharedCount) evidence.push({ id: "shared-funder", title: "Shared pre-launch funding", detail: `${sharedCount} early wallet(s) in the sampled launch window share the creator candidate's observed funding source. Shared funding is an association signal, not proof of common ownership.`, confidence: sharedCount >= 2 ? "strong" : "possible", wallet: fundingSource || undefined });

  const risk = scoreRisk(meta, holders, links, previousLaunches, creator, fundingSource, earlyWallets, creationConfidence);
  const provider = process.env.HELIUS_API_KEY?.trim() ? "helius" : "solana-rpc";
  const notes = [
    "RugPrint reports observable relationships; it does not identify a real-world person from a wallet address or social handle.",
    "UNRESOLVED means the available creator intelligence is too incomplete for a low/high risk classification. It does not mean safe.",
    "Holder concentration can include AMM pools, exchange wallets and program-owned accounts.",
    "Early-wallet detection is a bounded sample. Shared funding is evidence of an on-chain relationship, not proof that wallets have the same controller.",
    "Creator history uses strategic sampling to stay within serverless/RPC limits. A missing historical launch is not evidence that none exists."
  ];
  if (sigs.length >= maxPages * 1000) notes.push("The mint hit the configured signature-page cap, so older activity may exist beyond this scan.");
  if (!process.env.HELIUS_API_KEY?.trim()) notes.push("No Helius key is configured. Public Solana RPC may rate-limit scans and token metadata may be sparse.");

  const scanId = createHash("sha256").update(`${mint}:${Date.now()}`).digest("hex").slice(0, 12);
  const fingerprintBasis = [
    creator ? `creator:${creator}` : "creator:unknown",
    fundingSource ? `funder:${fundingSource}` : "funder:unknown",
    `platform:${platform}`,
    ...earlyWallets.filter(w=>w.sharedCreatorFunder).map(w=>`shared:${w.wallet}`).slice(0,6),
    ...links.filter(l=>l.confidence!=="possible").slice(0,10).map(l => `link:${[l.from,l.to].sort().join(":")}:${l.kind || "other"}`),
    `mintAuthority:${Boolean(meta.mintAuthority)}`,
    `freezeAuthority:${Boolean(meta.freezeAuthority)}`,
    `historyBucket:${Math.min(10, previousLaunches.length)}`
  ].sort();
  const dnaHash = createHash("sha256").update(fingerprintBasis.join("|")).digest("hex");
  const clusterId = `RP-${dnaHash.slice(0, 8).toUpperCase()}`;
  const rugDna = dnaHash.match(/.{1,4}/g)?.slice(0, 6).join("-").toUpperCase() || dnaHash.slice(0, 24).toUpperCase();

  return {
    scanId, generatedAt: new Date().toISOString(), network: "mainnet-beta", token: meta,
    launch: { platform, creationConfidence },
    fingerprint: { clusterId, rugDna, basis: fingerprintBasis },
    creator: { wallet: creator, creationSignature: creationSig?.signature || null, firstSeen: creationSig?.blockTime ?? null, fundingSource, fundingSignature },
    holders, earlyWallets, links: links.slice(0,40), previousLaunches, evidence, risk,
    coverage: { provider, signaturesInspected: sigs.length, transactionsParsed: parsedCount, creatorSignaturesInspected, earlyTransactionsParsed: earlyTxs.filter(Boolean).length, notes }
  };
}
