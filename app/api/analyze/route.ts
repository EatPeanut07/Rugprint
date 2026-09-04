import { NextResponse } from "next/server";
import { analyzeMint } from "@/lib/solana";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map<string, { at: number; result: ScanResult }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = String(body?.mint || "").trim();
    if (!mint) return NextResponse.json({ error: "Enter a Solana contract address." }, { status: 400 });

    const cached = resultCache.get(mint);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(cached.result, { headers: { "x-rugprint-cache": "HIT" } });
    }

    const result = await analyzeMint(mint);
    resultCache.set(mint, { at: Date.now(), result });
    return NextResponse.json(result, { headers: { "x-rugprint-cache": "MISS" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    if (/429|too many requests|rate.?limit/i.test(message)) {
      return NextResponse.json({
        error: "The Solana data provider is busy. RugPrint automatically retried, but the rate limit is still active. Wait about 20 seconds and trace the token again."
      }, { status: 503, headers: { "Retry-After": "20" } });
    }
    const status = /valid Solana|Enter a Solana|No confirmed/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
