import { NextResponse } from "next/server";
import { databaseHealth } from "@/lib/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseHealth();
  const ok = database.configured && database.reachable && database.schemaReady;

  return NextResponse.json({
    ok,
    service: "RugPrint",
    provider: process.env.HELIUS_API_KEY ? "helius" : "solana-rpc",
    database,
    features: {
      registry: true,
      scanPersistence: true,
      creatorIdentityStore: true,
      usernameHistory: true,
      alertSchema: true
    },
    checkedAt: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
