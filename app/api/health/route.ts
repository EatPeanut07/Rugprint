import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({ ok: true, service: "RugPrint", provider: process.env.HELIUS_API_KEY ? "helius" : "solana-rpc" });
}
