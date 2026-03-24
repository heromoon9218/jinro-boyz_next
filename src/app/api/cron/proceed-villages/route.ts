import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { proceedDay } from "@/server/game/proceed-day";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const villages = await db.village.findMany({
    where: {
      status: "IN_PLAY",
      nextUpdateTime: { lte: now },
    },
    select: { id: true },
  });

  const results: { villageId: string; ok: boolean; error?: string }[] = [];

  for (const village of villages) {
    try {
      await proceedDay(village.id);
      results.push({ villageId: village.id, ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`proceedDay failed for ${village.id}:`, message);
      results.push({ villageId: village.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
