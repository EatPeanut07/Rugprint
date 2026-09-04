import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Direct public registry writes are disabled. RugPrint records scan observations server-side and publishes creator clusters only after evidence review."
  }, { status: 403 });
}
