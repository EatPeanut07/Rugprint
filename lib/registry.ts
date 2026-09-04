import type { ScanResult } from "@/lib/types";
import { aliasSimilarity } from "@/lib/alias";

export type RegistryStatus = "observed" | "elevated" | "high" | "confirmed_adverse";

export type RegistryAlias = {
  platform: string;
  username: string;
  stableId?: string | null;
  profileUrl?: string | null;
  firstSeen?: string | null;
  lastSeen?: string | null;
  confidence?: number | null;
};

export type RegistryCluster = {
  id: string;
  clusterId: string;
  status: RegistryStatus;
  headline: string | null;
  confidence: number;
  linkedLaunches: number;
  adverseEvents: number;
  associatedWallets: number;
  estimatedCreatorExitUsd: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  aliases: RegistryAlias[];
  wallets: string[];
  evidenceCount: number;
  appealStatus: "none" | "open" | "resolved";
  updatedAt: string;
};

const endpoint = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() { return Boolean(endpoint && serviceKey); }

async function supabase(path: string, init?: RequestInit) {
  if (!configured()) throw new Error("RugPrint registry database is not configured yet.");
  const headers = {
    apikey: serviceKey!,
    Authorization: `Bearer ${serviceKey!}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(init?.headers || {})
  };
  const res = await fetch(`${endpoint}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Registry database error (${res.status}): ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function mapCluster(row: unknown): RegistryCluster {
  const data = row as Record<string, unknown>;
  return {
    id: String(data.id),
    clusterId: String(data.cluster_id),
    status: data.status as RegistryStatus,
    headline: data.headline == null ? null : String(data.headline),
    confidence: Number(data.confidence ?? 0),
    linkedLaunches: Number(data.linked_launches ?? 0),
    adverseEvents: Number(data.adverse_events ?? 0),
    associatedWallets: Number(data.associated_wallets ?? 0),
    estimatedCreatorExitUsd: data.estimated_creator_exit_usd == null ? null : Number(data.estimated_creator_exit_usd),
    firstSeen: data.first_seen == null ? null : String(data.first_seen),
    lastSeen: data.last_seen == null ? null : String(data.last_seen),
    aliases: Array.isArray(data.aliases) ? (data.aliases as RegistryAlias[]) : [],
    wallets: Array.isArray(data.wallets) ? (data.wallets as string[]) : [],
    evidenceCount: Number(data.evidence_count ?? 0),
    appealStatus: (data.appeal_status ?? "none") as RegistryCluster["appealStatus"],
    updatedAt: String(data.updated_at ?? "")
  };
}

export async function listPublicClusters(limit = 100): Promise<RegistryCluster[]> {
  if (!configured()) return [] as RegistryCluster[];
  const rows = await supabase(`rugprint_public_clusters?select=*&order=adverse_events.desc,linked_launches.desc,confidence.desc&limit=${Math.min(limit, 250)}`);
  const clusterRows: unknown[] = Array.isArray(rows) ? rows : [];
  return clusterRows.map((row: unknown) => mapCluster(row));
}

export async function lookupRegistry(input: { alias?: string; wallet?: string; clusterId?: string }) {
  const clusters = await listPublicClusters(250);
  const alias = input.alias?.trim();
  const wallet = input.wallet?.trim();
  const clusterId = input.clusterId?.trim().toUpperCase();
  return clusters
    .map((cluster: RegistryCluster) => {
      let bestAliasScore = 0;
      let bestAlias: RegistryAlias | null = null;
      if (alias) for (const candidate of cluster.aliases) {
        const score = aliasSimilarity(alias, candidate.username);
        if (score > bestAliasScore) { bestAliasScore = score; bestAlias = candidate; }
      }
      const walletMatch = Boolean(wallet && cluster.wallets.some((w: string) => w === wallet));
      const clusterMatch = Boolean(clusterId && cluster.clusterId.toUpperCase() === clusterId);
      return { cluster, aliasSimilarity: bestAliasScore, matchedAlias: bestAlias, walletMatch, clusterMatch };
    })
    .filter((x: { cluster: RegistryCluster; aliasSimilarity: number; matchedAlias: RegistryAlias | null; walletMatch: boolean; clusterMatch: boolean }) => x.clusterMatch || x.walletMatch || x.aliasSimilarity >= 72)
    .sort((a: { cluster: RegistryCluster; aliasSimilarity: number; matchedAlias: RegistryAlias | null; walletMatch: boolean; clusterMatch: boolean }, b: { cluster: RegistryCluster; aliasSimilarity: number; matchedAlias: RegistryAlias | null; walletMatch: boolean; clusterMatch: boolean }) => Number(b.clusterMatch)-Number(a.clusterMatch) || Number(b.walletMatch)-Number(a.walletMatch) || b.aliasSimilarity-a.aliasSimilarity)
    .slice(0, 10);
}

export async function recordObservedScan(scan: ScanResult) {
  if (!configured()) return;
  try {
    await supabase("rugprint_scan_observations?on_conflict=scan_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        scan_id: scan.scanId,
        token_mint: scan.token.mint,
        cluster_hint: scan.fingerprint.clusterId,
        creator_wallet: scan.creator.wallet,
        funding_source: scan.creator.fundingSource,
        risk_label: scan.risk.label,
        risk_score: scan.risk.score,
        data_confidence: scan.risk.dataConfidence,
        previous_launches: scan.previousLaunches.length,
        evidence: scan.evidence,
        observed_at: scan.generatedAt
      })
    });
  } catch (error) {
    console.error("RugPrint observation write failed", error);
  }
}

export function registryConfigured() { return configured(); }
