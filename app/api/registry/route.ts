import { NextResponse } from "next/server";
import { listPublicClusters, registryConfigured } from "@/lib/registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    const clusters = await listPublicClusters(100);
    return NextResponse.json({ configured: registryConfigured(), clusters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registry unavailable";
    return NextResponse.json({ configured: registryConfigured(), clusters: [], error: message }, { status: 500 });
  }
}
