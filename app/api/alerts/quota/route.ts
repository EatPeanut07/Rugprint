import { NextRequest, NextResponse } from "next/server";
import { alertAllowance } from "@/lib/alerts";
export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan") === "pro" ? "pro" : "trial";
  const used = Math.max(0, Number(req.nextUrl.searchParams.get("used") || 0));
  return NextResponse.json({ plan, used, ...alertAllowance(plan, used) });
}
