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
};

export type CreatorLaunch = {
  mint: string;
  firstSeen?: number | null;
  evidence: string;
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

export type ScanResult = {
  scanId: string;
  generatedAt: string;
  network: "mainnet-beta";
  token: TokenMeta;
  fingerprint: { clusterId: string; rugDna: string; basis: string[] };
  creator: {
    wallet: string | null;
    creationSignature: string | null;
    firstSeen: number | null;
    fundingSource: string | null;
    fundingSignature: string | null;
  };
  holders: HolderStats;
  links: WalletLink[];
  previousLaunches: CreatorLaunch[];
  evidence: Evidence[];
  risk: {
    score: number;
    label: "LOW" | "GUARDED" | "HIGH" | "SEVERE";
    reasons: string[];
    dataConfidence?: Confidence;
  };
  coverage: {
    provider: "helius" | "solana-rpc";
    signaturesInspected: number;
    transactionsParsed: number;
    notes: string[];
  };
};
