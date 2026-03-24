import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { GameClient } from "./_components/game-client";

export default async function GamePage({
  params,
}: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = await params;

  const village = await db.village.findUnique({
    where: { id: villageId },
    select: { status: true },
  });

  if (!village) {
    redirect("/villages");
  }

  if (village.status === "NOT_STARTED" || village.status === "RUINED") {
    redirect(`/villages/${villageId}`);
  }

  return <GameClient villageId={villageId} />;
}
