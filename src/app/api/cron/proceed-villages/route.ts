import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { proceedDay } from "@/server/game/proceed-day";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all IN_PLAY villages whose nextUpdateTime has passed
  const villages = await db.village.findMany({
    where: {
      status: "IN_PLAY",
      nextUpdateTime: { lte: new Date() },
    },
    select: { id: true },
  });

  const results: { villageId: string; success: boolean; error?: string }[] = [];

  for (const village of villages) {
    try {
      await proceedDay(village.id);
      results.push({ villageId: village.id, success: true });
    } catch (error) {
      results.push({
        villageId: village.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
