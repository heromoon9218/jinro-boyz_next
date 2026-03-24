"use client";

import Link from "next/link";
import type { VillageStatus, Winner } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Timer } from "./timer";

interface GameHeaderProps {
  village: {
    id: string;
    name: string;
    day: number;
    status: VillageStatus;
    winner: Winner | null;
    nextUpdateTime: Date | string | null;
  };
}

export function GameHeader({ village }: GameHeaderProps) {
  const dayLabel =
    village.status === "ENDED" || village.status === "RUINED"
      ? "エピローグ"
      : `${village.day}日目`;

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-3">
        <Link
          href={`/villages/${village.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr;
        </Link>
        <h1 className="truncate text-lg font-bold">{village.name}</h1>
        <Badge variant="secondary">{dayLabel}</Badge>
      </div>
      <div className="flex items-center gap-3">
        {village.status === "ENDED" && village.winner && (
          <Badge variant={village.winner === "HUMANS" ? "default" : "destructive"}>
            {village.winner === "HUMANS" ? "村人勝利" : "人狼勝利"}
          </Badge>
        )}
        {village.status === "IN_PLAY" && (
          <Timer villageId={village.id} nextUpdateTime={village.nextUpdateTime} />
        )}
      </div>
    </div>
  );
}
