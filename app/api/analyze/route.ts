import { NextResponse } from "next/server";
import { analyzeMint } from "@/lib/solana";
import { recordObservedScan } from "@/lib/registry";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mint = String(body?.mint || "").trim();
    if (!mint) return NextResponse.json({ error: "Enter a Solana contract address." }, { status: 400 });

    const result = await analyzeMint(mint);

    // Persist the observation server-side. A database problem must not break a user's scan.
    const persistence = await recordObservedScan(result);

    return NextResponse.json({ ...result, persistence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    const status = /valid Solana|Enter a Solana|No confirmed/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
