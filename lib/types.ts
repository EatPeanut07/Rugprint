export type Confidence = "confirmed" | "strong" | "possible" | "unknown";

export type Evidence = {
  id: string;
  title: string;
  detail: string;
  confidence: Confidence;
  tx?: string;
  wallet?: string;
};

export type WalletLink = {
  from: string;
  to: string;
  reason: string;
  confidence: Confidence;
  tx?: string;
  amountSol?: number;
  kind?: "funding" | "shared-funder" | "co-signer" | "early-wallet" | "token-outflow" | "other";
};

export type CreatorLaunch = {
  mint: string;
  firstSeen?: number | null;
  evidence: string;
  signature?: string | null;
};

export type TokenMeta = {
  mint: string;
  name?: string | null;
  symbol?: string | null;
  image?: string | null;
  decimals?: number | null;
  supply?: number | null;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
};

export type HolderStats = {
  top1Pct: number | null;
  top5Pct: number | null;
  top10Pct: number | null;
  accountsChecked: number;
};

export type EarlyWallet = {
  wallet: string;
  firstSeen: number | null;
  signature: string;
  tokenDelta: number | null;
  fundingSource: string | null;
  fundingSignature: string | null;
  sharedCreatorFunder: boolean;
};

export type ScanResult = {
  scanId: string;
  generatedAt: string;
  network: "mainnet-beta";
  token: TokenMeta;
  launch: {
    platform: "pump.fun" | "unknown";
    creationConfidence: Confidence;
  };
  fingerprint: {
    clusterId: string;
    rugDna: string;
    basis: string[];
  };
  creator: {
    wallet: string | null;
    creationSignature: string | null;
    firstSeen: number | null;
    fundingSource: string | null;
    fundingSignature: string | null;
  };
  holders: HolderStats;
  earlyWallets: EarlyWallet[];
  links: WalletLink[];
  previousLaunches: CreatorLaunch[];
  evidence: Evidence[];
  risk: {
    score: number | null;
    label: "LOW" | "GUARDED" | "HIGH" | "SEVERE" | "UNRESOLVED";
    reasons: string[];
    dataConfidence: number;
    unknowns: string[];
  };
  coverage: {
    provider: "helius" | "solana-rpc";
    signaturesInspected: number;
    transactionsParsed: number;
    creatorSignaturesInspected: number;
    earlyTransactionsParsed: number;
    notes: string[];
  };
};
