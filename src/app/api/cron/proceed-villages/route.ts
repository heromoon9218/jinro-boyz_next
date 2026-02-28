import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Phase 3 — Query villages where nextUpdateTime <= now and status = IN_PLAY,
  // then call proceedDay for each.

  return NextResponse.json({ ok: true });
}
