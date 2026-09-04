import { NextResponse } from "next/server";
import { lookupRegistry, registryConfigured } from "@/lib/registry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const alias = String(body?.alias || "").trim();
    const wallet = String(body?.wallet || "").trim();
    const clusterId = String(body?.clusterId || "").trim();
    if (!alias && !wallet && !clusterId) return NextResponse.json({ error: "Enter a username, wallet or RugPrint cluster ID." }, { status: 400 });
    const matches = await lookupRegistry({ alias, wallet, clusterId });
    return NextResponse.json({ configured: registryConfigured(), matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registry lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
